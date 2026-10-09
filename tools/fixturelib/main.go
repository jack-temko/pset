// Command fixturelib builds the public fixture library the jump guard
// (make jumps-check, and CI) audits: two books from testdata/, each with
// homework sets, written and unwritten guides, answered Ask turns and the
// usage calls they cost, with no model call, no key and none of Jack's books.
//
//	go run ./tools/fixturelib DATA_DIR
//
// It refuses a directory that already holds a pset.db, and Jack's library and
// the test library however the path is spelled. Run it from the repo root.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/ask"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/homework"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/memory"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/usage"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: fixturelib <data-dir>")
		os.Exit(2)
	}
	if err := build(context.Background(), os.Args[1], time.Now().UTC()); err != nil {
		fmt.Fprintln(os.Stderr, "fixturelib:", err)
		os.Exit(1)
	}
	fmt.Println("fixture library in", os.Args[1])
}

// A book of the fixture: its sample PDF and the sections taken from the
// manifest.
type book struct {
	id, file, title, author, kind string
	pages                         int
	sections                      []section
}

type section struct {
	title      string
	level      int
	start, end int
}

// manifest is the part of testdata/manifest.json the fixture reads.
type manifest struct {
	Digital entry `json:"digital"`
	Flat    entry `json:"flat"`
}

type entry struct {
	File    string `json:"file"`
	SHA     string `json:"sha256"`
	Pages   int    `json:"pages"`
	Title   string `json:"title"`
	Author  string `json:"author"`
	Outline []head `json:"outline"`
	Heads   []head `json:"headings"`
}

type head struct {
	Title string `json:"title"`
	Page  int    `json:"page"`
	Level int    `json:"level"`
}

func share(name string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return name
	}
	return filepath.Join(home, ".local", "share", name)
}

func resolve(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		abs = p
	}
	// The deepest part that exists is resolved, so a symlink can't hide a
	// protected folder.
	rest := ""
	for cur := abs; ; cur = filepath.Dir(cur) {
		if r, err := filepath.EvalSymlinks(cur); err == nil {
			return filepath.Join(r, rest)
		}
		if filepath.Dir(cur) == cur {
			return abs
		}
		rest = filepath.Join(filepath.Base(cur), rest)
	}
}

func inside(p, dir string) bool {
	rel, err := filepath.Rel(dir, p)
	return err == nil && rel != "." && !strings.HasPrefix(rel, "..")
}

// refuse says why dir may not be built into, or returns nil.
func refuse(dir string) error {
	dst := resolve(dir)
	if _, err := os.Stat(filepath.Join(dst, "pset.db")); err == nil {
		return fmt.Errorf("%s already has a pset.db: not building over it", dst)
	}
	protected := []string{resolve(share("pset")), resolve(share("pset-test-library"))}
	if v := os.Getenv("PSET_DATA"); v != "" {
		protected = append(protected, resolve(v))
	}
	if v := os.Getenv("XDG_DATA_HOME"); v != "" {
		protected = append(protected, resolve(filepath.Join(v, "pset")))
	}
	for _, p := range protected {
		if dst == p || inside(dst, p) || inside(p, dst) {
			return fmt.Errorf("%s is, holds or is inside %s: not building there", dst, p)
		}
	}
	return nil
}

func build(ctx context.Context, dir string, now time.Time) error {
	if err := refuse(dir); err != nil {
		return err
	}
	raw, err := os.ReadFile(filepath.Join("testdata", "manifest.json"))
	if err != nil {
		return fmt.Errorf("run it from the repo root: %w", err)
	}
	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(dir, "books"), 0o700); err != nil {
		return err
	}
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		return err
	}
	defer d.Close()
	var migs []db.Migration
	for _, ms := range [][]db.Migration{jobs.Migrations(), settings.Migrations(), usage.Migrations(), library.Migrations(),
		memory.Migrations(), homework.Migrations(), ask.Migrations(), activity.Migrations()} {
		migs = append(migs, ms...)
	}
	if err := db.Migrate(ctx, d, migs); err != nil {
		return err
	}
	books := []book{
		{id: "fx-digital", file: m.Digital.File, title: m.Digital.Title, author: m.Digital.Author, kind: "digital", pages: m.Digital.Pages, sections: sections(m.Digital.Outline, m.Digital.Pages)},
		{id: "fx-flat", file: m.Flat.File, title: m.Flat.Title, author: m.Flat.Author, kind: "digital", pages: m.Flat.Pages, sections: sections(m.Flat.Heads, m.Flat.Pages)},
	}
	shas := map[string]string{"fx-digital": m.Digital.SHA, "fx-flat": m.Flat.SHA}
	for i, b := range books {
		// Staggered, so the shelf has an order.
		at := now.Add(-time.Duration(48+i*24) * time.Hour)
		if err := addBook(ctx, d, dir, b, shas[b.id], at); err != nil {
			return fmt.Errorf("%s: %w", b.id, err)
		}
		if err := addHomework(ctx, d, b, now, at); err != nil {
			return fmt.Errorf("%s: %w", b.id, err)
		}
	}
	// Two answered turns on the first book.
	for i, q := range []string{"What is the Voss Register?", "How often must a collar be re-silvered?"} {
		id := fmt.Sprintf("fx-turn-%d", i+1)
		at := now.Add(-time.Duration(5-i) * time.Hour)
		answer := blocks(fmt.Sprintf(`{"type":"para","text":"The book answers this on page %d [p. %d]."}`, 3+i, 3+i))
		if _, err := d.ExecContext(ctx, `INSERT INTO turns (id, book_id, question, answer, state, created_at, updated_at) VALUES (?, 'fx-digital', ?, ?, 'done', ?, ?)`,
			id, q, answer, at.Format(time.RFC3339), at.Format(time.RFC3339)); err != nil {
			return err
		}
		if err := addCalls(ctx, d, "turn", id, at, turnCalls); err != nil {
			return err
		}
	}
	// No key: the settings table is left without one, which is how a fresh
	// install looks.
	return nil
}

func sections(hs []head, pages int) []section {
	out := make([]section, len(hs))
	for i, h := range hs {
		end := pages
		if i+1 < len(hs) {
			end = hs[i+1].Page - 1
		}
		if end < h.Page {
			end = h.Page
		}
		out[i] = section{h.Title, h.Level, h.Page, end}
	}
	return out
}

func addBook(ctx context.Context, d *sql.DB, dir string, b book, sha string, at time.Time) error {
	ts := at.Format(time.RFC3339)
	src := filepath.Join("testdata", b.file)
	dst := filepath.Join(dir, "books", b.id+".pdf")
	if err := copyFile(src, dst); err != nil {
		return err
	}
	if _, err := d.ExecContext(ctx, `INSERT INTO books (id, sha256, title, author, page_count, page_width, page_height, kind, state, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 612, 792, ?, 'ready', ?, ?)`, b.id, sha, b.title, b.author, b.pages, b.kind, ts, ts); err != nil {
		return err
	}
	text, err := pdf.Text(ctx, src)
	if err != nil {
		return fmt.Errorf("pdftotext: %w", err)
	}
	pages := strings.Split(text, "\f")
	for n := 1; n <= b.pages; n++ {
		t, status := "", "blank"
		if n <= len(pages) {
			if t = strings.TrimSpace(pages[n-1]); t != "" {
				status = "text"
			}
		}
		if _, err := d.ExecContext(ctx, `INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, ?)`, b.id, n, t, status); err != nil {
			return err
		}
	}
	for i, s := range b.sections {
		if _, err := d.ExecContext(ctx, `INSERT INTO sections (book_id, ord, level, title, start_page, end_page) VALUES (?, ?, ?, ?, ?, ?)`,
			b.id, i+1, s.level, s.title, s.start, s.end); err != nil {
			return err
		}
	}
	return addCalls(ctx, d, "book", b.id, at, importCalls)
}

// addHomework adds a set that is due and one turned in, each with four
// questions: three with a written guide and one unwritten.
func addHomework(ctx context.Context, d *sql.DB, b book, now, at time.Time) error {
	suffix := strings.TrimPrefix(b.id, "fx-")
	sets := []struct {
		id, title, due, turnedIn string
	}{
		{"fx-hw-" + suffix + "-due", "Problem set 1", now.Add(36 * time.Hour).Format("2006-01-02"), ""},
		{"fx-hw-" + suffix + "-done", "Problem set 0", now.Add(-72 * time.Hour).Format("2006-01-02"), now.Add(-70 * time.Hour).Format(time.RFC3339)},
	}
	guide := blocks(`{"type":"para","text":"Start from the definition on the page the problem points to."}
{"type":"derivation","steps":[{"tex":"a + b = c","why":"The two parts make the whole."}]}
{"type":"answer","text":"c"}`)
	hint := blocks(`{"type":"hint","text":"Look for the definition the problem leans on."}`)
	ts := at.Format(time.RFC3339)
	for si, s := range sets {
		if _, err := d.ExecContext(ctx, `INSERT INTO homework (id, book_id, title, due_date, turned_in_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			s.id, b.id, s.title, s.due, s.turnedIn, ts, ts); err != nil {
			return err
		}
		for i := 1; i <= 4; i++ {
			qid := fmt.Sprintf("%s-q%d", s.id, i)
			label := fmt.Sprintf("%d.%d", si+1, i)
			text := fmt.Sprintf("Problem %s: use the book to explain the result.", label)
			state, hnt, walk := "ready", hint, guide
			if i == 3 {
				state, hnt, walk = "unwritten", "[]", "[]"
			}
			if _, err := d.ExecContext(ctx, `INSERT INTO questions (id, homework_id, position, text, in_book, label, statement, page, hint, walkthrough, state, difficulty, created_at, updated_at)
				VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				qid, s.id, i, text, label, statement(text), 1+i%b.pages, hnt, walk, state, 1+i%5, ts, ts); err != nil {
				return err
			}
			if state == "ready" {
				if err := addCalls(ctx, d, "question", qid, at, questionCalls); err != nil {
					return err
				}
			}
		}
		if err := addCalls(ctx, d, "set", s.id, at, setCalls); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	return errors.Join(err, out.Close())
}

// blocks parses model-format lines into the JSON array a guide or an answer
// is stored as.
func blocks(text string) string {
	out := []json.RawMessage{}
	p := doc.NewParser(context.Background(), doc.Options{Mode: doc.Ask}, doc.Handler{
		Block: func(b doc.Block, _ bool) { out = append(out, json.RawMessage(b)) },
	})
	p.Feed(text + "\n")
	p.Finish()
	b, _ := json.Marshal(out)
	return string(b)
}

func statement(text string) string {
	b, _ := json.Marshal([]doc.Run{{T: text}})
	return string(b)
}

// A call the fixture records: real-shaped, never made.
type call struct {
	stage, run string
	after      time.Duration
	ms         int64
	in, out    int
	reasoning  int
	cached     int
	cost       float64
	tools      string
}

const model = "anthropic/claude-haiku-5.5"

var (
	questionCalls = []call{
		{"Find", "r1", 0, 2100, 8200, 1212, 0, 0, 0.0004, ""},
		{"Guide", "r1", time.Minute, 7000, 7000, 1800, 1400, 5000, 0.0018, "search_pages,read_page"},
		{"Guide", "r1", 2 * time.Minute, 6200, 9100, 2100, 1700, 6500, 0.0021, ""},
	}
	setCalls  = []call{{"Rank", "rk", 0, 1300, 1400, 88, 0, 0, 0.0003, ""}}
	turnCalls = []call{
		{"Round 1", "t1", 0, 3100, 3000, 240, 180, 0, 0.0007, "search_pages"},
		{"Round 2", "t1", time.Minute, 3600, 4800, 310, 220, 2600, 0.0006, "read_page"},
		{"Round 3", "t1", 2 * time.Minute, 6800, 6100, 920, 400, 4400, 0.0012, ""},
	}
	importCalls = []call{
		{"Naming", "im", 0, 2700, 4600, 300, 0, 0, 0.0006, ""},
		{"Contents", "im", time.Minute, 13000, 23000, 3600, 2000, 0, 0.0032, ""},
	}
)

func nullZero(n int) any {
	if n == 0 {
		return nil
	}
	return n
}

func nullIf(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func addCalls(ctx context.Context, d *sql.DB, subject, id string, at time.Time, cs []call) error {
	for _, c := range cs {
		_, err := d.ExecContext(ctx, `INSERT INTO calls (at, subject_type, subject_id, model, answered, ms, prompt_tokens, completion_tokens, cost, host, session, error,
				stage, run, tools, reasoning_tokens, cached_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
			at.Add(c.after).Format(time.RFC3339), subject, id, model, model, c.ms, c.in, c.out, c.cost,
			c.stage, c.run, nullIf(c.tools), nullZero(c.reasoning), nullZero(c.cached))
		if err != nil {
			return err
		}
	}
	return nil
}
