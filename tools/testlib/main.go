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
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/cleanup"
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
	Calls    int           `json:"calls"`
	Turns    int           `json:"turns"`
}

type ManifestSet struct {
	Title     string `json:"title"`
	Questions int    `json:"questions"`
}

// openURI is a SQLite file URI for path with the given query.
func openURI(path string, q url.Values) string {
	u := url.URL{Scheme: "file", Path: path, RawQuery: q.Encode()}
	return u.String()
}

// openFrozen opens a database that nothing else writes, read-only and
// immutable, so opening it creates no -wal or -shm beside it.
func openFrozen(path string) (*sql.DB, error) {
	return sql.Open("sqlite", openURI(path, url.Values{"mode": {"ro"}, "immutable": {"1"}}))
}

func snapshot(args []string) error {
	fl := flag.NewFlagSet("snapshot", flag.ExitOnError)
	from := fl.String("from", share("pset"), "the library to read")
	to := fl.String("to", share("pset-test-library"), "where the snapshot goes")
	if err := fl.Parse(args); err != nil {
		return err
	}
	src, dst := mustAbs(*from), mustAbs(*to)
	if src == dst || inside(dst, src) || inside(src, dst) {
		return fmt.Errorf("-to %s and -from %s are the same or one is inside the other", dst, src)
	}
	if err := plainPath(src, dst); err != nil {
		return err
	}
	if _, err := os.Stat(dst); err == nil {
		if _, err := os.Stat(filepath.Join(dst, "MANIFEST.json")); err != nil {
			return fmt.Errorf("%s exists and is not a test library (no MANIFEST.json): not replacing it", dst)
		}
	}
	ctx := context.Background()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + fmt.Sprintf(".tmp-%d", os.Getpid())
	cleanup.RemoveAll(tmp)
	if err := os.MkdirAll(tmp, 0o700); err != nil {
		return err
	}
	ok := false
	defer func() {
		if !ok {
			cleanup.RemoveAll(tmp)
		}
	}()

	// The source is opened read-only; VACUUM INTO writes only the copy. With a
	// -wal beside the database a PSet has it open, and a plain read-only
	// connection reads through the WAL. Without one, a read-only open of a WAL
	// database would create -wal and -shm in the source, so it is opened
	// immutable, which touches nothing.
	q := url.Values{"mode": {"ro"}}
	if _, err := os.Stat(filepath.Join(src, "pset.db-wal")); err == nil {
		q.Set("_pragma", "busy_timeout(5000)")
	} else {
		q.Set("immutable", "1")
	}
	before, err := listing(src)
	if err != nil {
		return err
	}
	ro, err := sql.Open("sqlite", openURI(filepath.Join(src, "pset.db"), q))
	if err != nil {
		return err
	}
	_, err = ro.ExecContext(ctx, "VACUUM INTO ?", filepath.Join(tmp, "pset.db"))
	cleanup.Close(ro)
	if err != nil {
		return fmt.Errorf("copy database: %w", err)
	}

	file := filepath.Join(tmp, "pset.db")
	d, err := db.Open(file)
	if err != nil {
		return err
	}
	secrets, err := Strip(ctx, d)
	if err == nil {
		// One plain file, no -wal or -shm beside it.
		_, err = d.ExecContext(ctx, "PRAGMA journal_mode = DELETE")
	}
	cleanup.Close(d)
	if err != nil {
		return err
	}

	if err := copyTree(filepath.Join(src, "books"), filepath.Join(tmp, "books"), false); err != nil {
		return err
	}
	if err := copyTree(filepath.Join(src, "cache", "pages"), filepath.Join(tmp, "cache", "pages"), false); err != nil {
		return err
	}

	// Check the file as it will be left: reopened, frozen, nothing pending.
	f, err := openFrozen(file)
	if err != nil {
		return err
	}
	defer cleanup.Close(f)
	if err := Check(ctx, f, tmp, file, secrets); err != nil {
		return err
	}
	for _, n := range []string{"-wal", "-shm"} {
		if _, err := os.Stat(file + n); err == nil {
			return fmt.Errorf("pset.db%s is left beside the snapshot", n)
		}
	}
	if after, err := listing(src); err != nil || after != before {
		return fmt.Errorf("the source %s changed during the snapshot (err %w)", src, err)
	}
	m, err := manifest(ctx, f, src, tmp)
	cleanup.Close(f)
	if err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(m, "", "  ")
	if err := os.WriteFile(filepath.Join(tmp, "MANIFEST.json"), append(raw, '\n'), 0o644); err != nil {
		return err
	}

	// Swap into place: set the old snapshot aside, move the new one in.
	old := dst + fmt.Sprintf(".old-%d", os.Getpid())
	if _, err := os.Stat(dst); err == nil {
		// Directories only: the files are shared with seeded worktrees by
		// hardlink, and a mode change would reach them.
		makeDirsWritable(dst)
		if err := os.Rename(dst, old); err != nil {
			cleanup.Log("make the snapshot read-only", readOnly(dst))
			return err
		}
	}
	if err := os.Rename(tmp, dst); err != nil {
		if os.Rename(old, dst) == nil {
			cleanup.Log("make the snapshot read-only", readOnly(dst))
		}
		return err
	}
	ok = true
	cleanup.RemoveAll(old)
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

// plainPath refuses paths SQLite would read as URI syntax.
func plainPath(paths ...string) error {
	for _, p := range paths {
		if strings.ContainsAny(p, "?#%") {
			return fmt.Errorf("%s has a question mark, hash or percent sign in it: pick a path without", p)
		}
	}
	return nil
}

// inside reports whether p is under dir.
func inside(p, dir string) bool {
	return strings.HasPrefix(p, dir+string(filepath.Separator))
}

// resolve is p with symlinks followed, as far as p exists.
func resolve(p string) string {
	p = mustAbs(p)
	var tail []string
	for cur := p; ; cur = filepath.Dir(cur) {
		if r, err := filepath.EvalSymlinks(cur); err == nil {
			for i := len(tail) - 1; i >= 0; i-- {
				r = filepath.Join(r, tail[i])
			}
			return r
		}
		if cur == filepath.Dir(cur) {
			return p
		}
		tail = append(tail, filepath.Base(cur))
	}
}

// listing is pset.db and every file under books/ with its size and mtime: what
// must be the same before and after a snapshot. The -wal and -shm, the logs and
// the caches are left out, so a PSet running on the source does not abort it.
func listing(root string) (string, error) {
	var b strings.Builder
	st, err := os.Stat(filepath.Join(root, "pset.db"))
	if err != nil {
		return "", err
	}
	fmt.Fprintf(&b, "pset.db %d %d\n", st.Size(), st.ModTime().UnixNano())
	err = filepath.WalkDir(filepath.Join(root, "books"), func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		st, err := e.Info()
		if err != nil {
			return err
		}
		fmt.Fprintf(&b, "%s %d %d\n", p, st.Size(), st.ModTime().UnixNano())
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
			cleanup.Close(rows)
			return m, err
		}
		bks = append(bks, b)
	}
	cleanup.Close(rows)
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
				cleanup.Close(sr)
				return m, err
			}
			mb.Sets = append(mb.Sets, s)
		}
		cleanup.Close(sr)
		if err := d.QueryRowContext(ctx, `SELECT
			(SELECT count(*) FROM turns WHERE book_id = ?1),
			(SELECT count(*) FROM calls c WHERE (c.subject_type = 'book' AND c.subject_id = ?1)
				OR (c.subject_type = 'turn' AND c.subject_id IN (SELECT id FROM turns WHERE book_id = ?1))
				OR (c.subject_type = 'set' AND c.subject_id IN (SELECT id FROM homework WHERE book_id = ?1))
				OR (c.subject_type = 'question' AND c.subject_id IN (SELECT q.id FROM questions q JOIN homework h ON h.id = q.homework_id WHERE h.book_id = ?1)))`,
			b.id).Scan(&mb.Turns, &mb.Calls); err != nil {
			return m, err
		}
		m.Books = append(m.Books, mb)
	}
	m.DBBytes = size(filepath.Join(dir, "pset.db"))
	m.BooksBytes = size(filepath.Join(dir, "books"))
	m.CacheBytes = size(filepath.Join(dir, "cache"))
	return m, nil
}

func seed(args []string) error {
	fl := flag.NewFlagSet("seed", flag.ExitOnError)
	from := fl.String("from", share("pset-test-library"), "the snapshot to copy")
	force := fl.Bool("force", false, "replace a library already in the data dir")
	var dir string
	for {
		if err := fl.Parse(args); err != nil {
			return err
		}
		if fl.NArg() == 0 {
			break
		}
		if dir != "" {
			return fmt.Errorf("one data dir, got %q and %q", dir, fl.Arg(0))
		}
		dir, args = fl.Arg(0), fl.Args()[1:]
	}
	if dir == "" {
		printUsage()
	}
	src, dst := mustAbs(*from), resolve(dir)
	if _, err := os.Stat(filepath.Join(src, "pset.db")); err != nil {
		return fmt.Errorf("no test library at %s: make it with `make test-library`", src)
	}
	// Never seed into the snapshot or Jack's own library, however the path is
	// spelled, and never into a folder that holds either.
	protectedDirs := []string{resolve(src), resolve(share("pset"))}
	if v := os.Getenv("PSET_DATA"); v != "" {
		protectedDirs = append(protectedDirs, resolve(v))
	}
	if v := os.Getenv("XDG_DATA_HOME"); v != "" {
		protectedDirs = append(protectedDirs, resolve(filepath.Join(v, "pset")))
	}
	if err := plainPath(src, dst); err != nil {
		return err
	}
	for _, protected := range protectedDirs {
		if dst == protected || inside(dst, protected) || inside(protected, dst) {
			return fmt.Errorf("%s is, holds or is inside %s: not seeding there", dst, protected)
		}
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
	// A seed that stopped halfway left its marker or pset.db.tmp; only then
	// are its leftover books and caches cleared. Otherwise a folder that
	// already holds books or caches is not ours to empty.
	marker := filepath.Join(dst, ".seeding")
	tmp := filepath.Join(dst, "pset.db.tmp")
	if exists(marker) || exists(tmp) {
		for _, n := range []string{"books", "cache"} {
			if err := os.RemoveAll(filepath.Join(dst, n)); err != nil {
				return err
			}
		}
	}
	for _, n := range []string{"books", "cache"} {
		if es, _ := os.ReadDir(filepath.Join(dst, n)); len(es) > 0 {
			return fmt.Errorf("%s/%s is not empty and has no pset.db: not seeding over it", dst, n)
		}
	}
	if err := os.MkdirAll(dst, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(marker, nil, 0o600); err != nil {
		return err
	}
	// The database goes last, by rename, so a seed that stops halfway leaves no
	// pset.db and the next one starts clean.
	if err := copyTree(filepath.Join(src, "books"), filepath.Join(dst, "books"), true); err != nil {
		return err
	}
	if err := copyTree(filepath.Join(src, "cache"), filepath.Join(dst, "cache"), true); err != nil {
		return err
	}
	cleanup.Remove(tmp)
	if err := copyFile(filepath.Join(src, "pset.db"), tmp); err != nil {
		return err
	}
	defer cleanup.Remove(tmp)
	f, err := openFrozen(tmp)
	if err != nil {
		return err
	}
	err = Check(context.Background(), f, dst, tmp, nil)
	cleanup.Close(f)
	if err != nil {
		return err
	}
	if err := os.Rename(tmp, filepath.Join(dst, "pset.db")); err != nil {
		return err
	}
	cleanup.Remove(marker)
	fmt.Printf("seeded %s from the test library\n", dst)
	return nil
}

// copyTree copies a directory tree, following symlinks; with link it hardlinks
// each file where it can and copies where it can't. Directories are made
// private and writable whatever the source's mode.
func copyTree(from, to string, link bool) error {
	if _, err := os.Stat(from); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return filepath.WalkDir(from, func(p string, _ fs.DirEntry, err error) error {
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
	defer cleanup.Close(in)
	out, err := os.OpenFile(to, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		cleanup.Close(out)
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

func exists(p string) bool {
	_, err := os.Lstat(p)
	return err == nil
}

func makeDirsWritable(root string) {
	cleanup.Log("make directories writable", filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err == nil && e.IsDir() {
			cleanup.Log("make writable", os.Chmod(p, 0o700))
		}
		return nil
	}))
}

func makeWritable(root string) {
	cleanup.Log("make writable", filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err == nil && e.Type()&fs.ModeSymlink == 0 {
			cleanup.Log("make writable", os.Chmod(p, 0o700))
		}
		return nil
	}))
}

func size(root string) int64 {
	var n int64
	cleanup.Log("measure the library", filepath.WalkDir(root, func(_ string, e fs.DirEntry, err error) error {
		if err == nil && !e.IsDir() {
			if st, err := e.Info(); err == nil {
				n += st.Size()
			}
		}
		return nil
	}))
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
