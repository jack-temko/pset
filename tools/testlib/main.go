// Command testlib makes and seeds the test library: one snapshot of Jack's
// books, with a small sample of homework and no secrets, that agents copy
// into a worktree's data dir instead of starting empty or using his own
// library. Two commands:
//
//	go run ./tools/testlib snapshot [-from ~/.local/share/pset] [-to ~/.local/share/pset-test-library]
//	go run ./tools/testlib seed <data-dir> [-from ~/.local/share/pset-test-library] [-force]
//
// The source of a snapshot is only ever read. Nothing about a key is printed.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/db"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
	}
	var err error
	switch os.Args[1] {
	case "snapshot":
		err = snapshot(os.Args[2:])
	case "seed":
		err = seed(os.Args[2:])
	default:
		printUsage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "testlib:", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, "usage: testlib snapshot [-from dir] [-to dir]\n       testlib seed <data-dir> [-from dir] [-force]")
	os.Exit(2)
}

func share(name string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return name
	}
	return filepath.Join(home, ".local", "share", name)
}

// Manifest is MANIFEST.json: what a snapshot holds.
type Manifest struct {
	MadeAt        string         `json:"madeAt"`
	Source        string         `json:"source"`
	SchemaVersion string         `json:"schemaVersion"`
	Books         []ManifestBook `json:"books"`
	DBBytes       int64          `json:"dbBytes"`
	BooksBytes    int64          `json:"booksBytes"`
	CacheBytes    int64          `json:"cacheBytes"`
}

type ManifestBook struct {
	Title    string        `json:"title"`
	PDFBytes int64         `json:"pdfBytes"`
	Sets     []ManifestSet `json:"sets"`
}

type ManifestSet struct {
	Title     string `json:"title"`
	Questions int    `json:"questions"`
}

func snapshot(args []string) error {
	fl := flag.NewFlagSet("snapshot", flag.ExitOnError)
	from := fl.String("from", share("pset"), "the library to read")
	to := fl.String("to", share("pset-test-library"), "where the snapshot goes")
	fl.Parse(args)
	src, dst := mustAbs(*from), mustAbs(*to)
	if src == dst || strings.HasPrefix(dst, src+string(filepath.Separator)) {
		return fmt.Errorf("-to %s is the source or inside it", dst)
	}
	ctx := context.Background()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + fmt.Sprintf(".tmp-%d", os.Getpid())
	os.RemoveAll(tmp)
	if err := os.MkdirAll(tmp, 0o700); err != nil {
		return err
	}
	ok := false
	defer func() {
		if !ok {
			os.RemoveAll(tmp)
		}
	}()

	// The source is opened read-only; VACUUM INTO writes only the copy. With a
	// -wal beside the database a PSet has it open, and a plain read-only
	// connection reads through the WAL. Without one, a read-only open of a WAL
	// database would create -wal and -shm in the source, so it is opened
	// immutable, which touches nothing.
	mode := "mode=ro&immutable=1"
	if _, err := os.Stat(filepath.Join(src, "pset.db-wal")); err == nil {
		mode = "mode=ro&_pragma=busy_timeout(5000)"
	}
	before, err := listing(src)
	if err != nil {
		return err
	}
	ro, err := sql.Open("sqlite", "file:"+filepath.Join(src, "pset.db")+"?"+mode)
	if err != nil {
		return err
	}
	_, err = ro.ExecContext(ctx, "VACUUM INTO ?", filepath.Join(tmp, "pset.db"))
	ro.Close()
	if err != nil {
		return fmt.Errorf("copy database: %w", err)
	}

	d, err := db.Open(filepath.Join(tmp, "pset.db"))
	if err != nil {
		return err
	}
	if err := Strip(ctx, d); err != nil {
		d.Close()
		return err
	}
	// One plain file, no -wal or -shm beside it.
	if _, err := d.ExecContext(ctx, "PRAGMA journal_mode = DELETE"); err != nil {
		d.Close()
		return err
	}

	if err := copyTree(filepath.Join(src, "books"), filepath.Join(tmp, "books"), false); err != nil {
		d.Close()
		return err
	}
	if err := copyTree(filepath.Join(src, "cache", "pages"), filepath.Join(tmp, "cache", "pages"), false); err != nil {
		d.Close()
		return err
	}
	if err := Check(ctx, d, tmp); err != nil {
		d.Close()
		return err
	}
	if after, err := listing(src); err != nil || after != before {
		d.Close()
		return fmt.Errorf("the source %s changed during the snapshot (err %v)", src, err)
	}
	m, err := manifest(ctx, d, src, tmp)
	d.Close()
	if err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(m, "", "  ")
	if err := os.WriteFile(filepath.Join(tmp, "MANIFEST.json"), append(raw, '\n'), 0o644); err != nil {
		return err
	}
	for _, s := range []string{"-wal", "-shm"} {
		os.Remove(filepath.Join(tmp, "pset.db"+s))
	}

	// Swap into place: set the old snapshot aside, move the new one in.
	old := dst + fmt.Sprintf(".old-%d", os.Getpid())
	if _, err := os.Stat(dst); err == nil {
		makeWritable(dst)
		if err := os.Rename(dst, old); err != nil {
			return err
		}
	}
	if err := os.Rename(tmp, dst); err != nil {
		os.Rename(old, dst)
		return err
	}
	ok = true
	os.RemoveAll(old)
	if err := readOnly(dst); err != nil {
		return err
	}
	fmt.Printf("snapshot %s: %d books, db %s, books %s, page renders %s, check passed\n",
		dst, len(m.Books), human(m.DBBytes), human(m.BooksBytes), human(m.CacheBytes))
	for _, b := range m.Books {
		fmt.Printf("  %s (%s): %d sets", b.Title, human(b.PDFBytes), len(b.Sets))
		for _, s := range b.Sets {
			fmt.Printf(" [%s: %d q]", s.Title, s.Questions)
		}
		fmt.Println()
	}
	return nil
}

// listing is every file under root with its size and mtime, and every
// directory's name: what must be the same before and after a snapshot.
func listing(root string) (string, error) {
	var b strings.Builder
	err := filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		st, err := e.Info()
		if err != nil {
			return err
		}
		if st.IsDir() {
			fmt.Fprintf(&b, "%s/\n", p)
		} else {
			fmt.Fprintf(&b, "%s %d %d\n", p, st.Size(), st.ModTime().UnixNano())
		}
		return nil
	})
	return b.String(), err
}

func manifest(ctx context.Context, d *sql.DB, src, dir string) (Manifest, error) {
	m := Manifest{MadeAt: time.Now().UTC().Format(time.RFC3339), Source: src}
	if err := d.QueryRowContext(ctx, `SELECT coalesce((SELECT name FROM schema_migrations ORDER BY applied_at DESC, rowid DESC LIMIT 1), '')`).Scan(&m.SchemaVersion); err != nil {
		return m, err
	}
	rows, err := d.QueryContext(ctx, `SELECT id, title FROM books ORDER BY title`)
	if err != nil {
		return m, err
	}
	type bk struct{ id, title string }
	var bks []bk
	for rows.Next() {
		var b bk
		if err := rows.Scan(&b.id, &b.title); err != nil {
			rows.Close()
			return m, err
		}
		bks = append(bks, b)
	}
	rows.Close()
	for _, b := range bks {
		mb := ManifestBook{Title: b.title, Sets: []ManifestSet{}}
		if st, err := os.Stat(filepath.Join(dir, "books", b.id+".pdf")); err == nil {
			mb.PDFBytes = st.Size()
		}
		sr, err := d.QueryContext(ctx, `SELECT h.title, (SELECT count(*) FROM questions q WHERE q.homework_id = h.id)
			FROM homework h WHERE h.book_id = ? ORDER BY h.created_at DESC, h.id DESC`, b.id)
		if err != nil {
			return m, err
		}
		for sr.Next() {
			var s ManifestSet
			if err := sr.Scan(&s.Title, &s.Questions); err != nil {
				sr.Close()
				return m, err
			}
			mb.Sets = append(mb.Sets, s)
		}
		sr.Close()
		m.Books = append(m.Books, mb)
	}
	m.DBBytes = size(filepath.Join(dir, "pset.db"))
	m.BooksBytes = size(filepath.Join(dir, "books"))
	m.CacheBytes = size(filepath.Join(dir, "cache"))
	return m, nil
}

func seed(args []string) error {
	var dir string
	var rest []string
	for _, a := range args {
		if dir == "" && !strings.HasPrefix(a, "-") {
			dir = a
		} else {
			rest = append(rest, a)
		}
	}
	if dir == "" {
		printUsage()
	}
	fl := flag.NewFlagSet("seed", flag.ExitOnError)
	from := fl.String("from", share("pset-test-library"), "the snapshot to copy")
	force := fl.Bool("force", false, "replace a library already in the data dir")
	fl.Parse(rest)
	src, dst := mustAbs(*from), mustAbs(dir)
	if _, err := os.Stat(filepath.Join(src, "pset.db")); err != nil {
		return fmt.Errorf("no test library at %s: make it with `make test-library`", src)
	}
	if src == dst || strings.HasPrefix(dst, src+string(filepath.Separator)) {
		return fmt.Errorf("data dir %s is the snapshot or inside it", dst)
	}
	if _, err := os.Stat(filepath.Join(dst, "pset.db")); err == nil {
		if !*force {
			return fmt.Errorf("%s already has a pset.db; use -force to replace it", dst)
		}
		for _, n := range []string{"pset.db", "pset.db-wal", "pset.db-shm", "books", "cache"} {
			if err := os.RemoveAll(filepath.Join(dst, n)); err != nil {
				return err
			}
		}
	}
	if err := os.MkdirAll(dst, 0o700); err != nil {
		return err
	}
	if err := copyFile(filepath.Join(src, "pset.db"), filepath.Join(dst, "pset.db")); err != nil {
		return err
	}
	if err := copyTree(filepath.Join(src, "books"), filepath.Join(dst, "books"), true); err != nil {
		return err
	}
	if err := copyTree(filepath.Join(src, "cache"), filepath.Join(dst, "cache"), true); err != nil {
		return err
	}
	d, err := db.Open(filepath.Join(dst, "pset.db"))
	if err != nil {
		return err
	}
	defer d.Close()
	if err := Check(context.Background(), d, dst); err != nil {
		return err
	}
	fmt.Printf("seeded %s from the test library\n", dst)
	return nil
}

// copyTree copies a directory tree, following symlinks; with link it hardlinks
// each file where it can and copies where it can't. Directories are made
// private and writable whatever the source's mode.
func copyTree(from, to string, link bool) error {
	return filepath.WalkDir(from, func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		out := filepath.Join(to, rel)
		st, err := os.Stat(p)
		if err != nil {
			return err
		}
		if st.IsDir() {
			return os.MkdirAll(out, 0o700)
		}
		if link {
			if os.Link(p, out) == nil {
				return nil
			}
		}
		return copyFile(p, out)
	})
}

func copyFile(from, to string) error {
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(to, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func readOnly(root string) error {
	return filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err != nil || e.Type()&fs.ModeSymlink != 0 {
			return err
		}
		st, err := e.Info()
		if err != nil {
			return err
		}
		return os.Chmod(p, st.Mode().Perm()&^0o222)
	})
}

func makeWritable(root string) {
	filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err == nil && e.Type()&fs.ModeSymlink == 0 {
			os.Chmod(p, 0o700)
		}
		return nil
	})
}

func size(root string) int64 {
	var n int64
	filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err == nil && !e.IsDir() {
			if st, err := e.Info(); err == nil {
				n += st.Size()
			}
		}
		return nil
	})
	return n
}

func human(n int64) string {
	const mb = 1 << 20
	return fmt.Sprintf("%.1f MB", float64(n)/mb)
}

func mustAbs(p string) string {
	a, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return filepath.Clean(a)
}
