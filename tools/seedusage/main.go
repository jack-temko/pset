// Command seedusage fills a dev data directory with a book, a homework set,
// an Ask turn, an assignment read and the calls they cost, so every usage
// trigger, the usage modal and the book's Usage dialog show realistic data
// without a model key. The calls are real-shaped `calls` rows with stages
// and runs; nothing is called.
//
//	go run ./tools/seedusage            # into .dev/data
//	go run ./tools/seedusage -data DIR  # into another dev directory
//
// It refuses a directory that isn't under a `.dev` folder, so it can't touch a
// real library. It is idempotent: it removes what it seeded (ids that start
// "seed-") and writes it again. Reload the page afterwards, since it writes
// the database directly and publishes no events.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
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
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/usage"
)

const (
	bookID = "seed-book"
	setID  = "seed-hw"
	q1     = "seed-q1"
	q2     = "seed-q2"
	turnID = "seed-turn"
	readID = "seed-read"
)

func main() {
	dataDir := flag.String("data", ".dev/data", "the dev data directory")
	flag.Parse()
	abs, err := filepath.Abs(*dataDir)
	if err != nil || !strings.Contains(abs+string(filepath.Separator), string(filepath.Separator)+".dev"+string(filepath.Separator)) {
		fmt.Fprintln(os.Stderr, "seedusage: refusing", *dataDir, "- it is not under a .dev directory")
		os.Exit(1)
	}
	if err := run(abs); err != nil {
		fmt.Fprintln(os.Stderr, "seedusage:", err)
		os.Exit(1)
	}
	fmt.Println("seeded", abs, "- reload the page")
}

func run(dir string) error {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		return err
	}
	defer d.Close()
	// The same migrations the server runs, so a directory the server has
	// never started in works too.
	var migs []db.Migration
	for _, m := range [][]db.Migration{jobs.Migrations(), settings.Migrations(), usage.Migrations(), library.Migrations(),
		memory.Migrations(), homework.Migrations(), ask.Migrations(), activity.Migrations()} {
		migs = append(migs, m...)
	}
	if err := db.Migrate(ctx, d, migs); err != nil {
		return err
	}
	if err := clear(ctx, d); err != nil {
		return err
	}
	if err := copyBook(dir); err != nil {
		return err
	}
	now := time.Now().UTC()
	at := now.Add(-6 * time.Hour).Format(time.RFC3339)
	exec := func(q string, args ...any) error {
		_, err := d.ExecContext(ctx, q, args...)
		return err
	}
	steps := []func() error{
		func() error {
			return exec(`INSERT INTO books (id, sha256, title, author, page_count, page_width, page_height, kind, state, created_at, updated_at)
				VALUES (?, 'seed-usage', 'Circuits and Systems (usage sample)', 'A. Author', 6, 612, 792, 'digital', 'ready', ?, ?)`, bookID, at, at)
		},
		func() error {
			for p := 1; p <= 6; p++ {
				if err := exec(`INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, 'text')`, bookID, p,
					fmt.Sprintf("Page %d of the usage sample book. Kirchhoff's current law, nodes and loops.", p)); err != nil {
					return err
				}
			}
			return nil
		},
		func() error {
			return exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES (?, ?, 'Problem set 3 (usage sample)', ?, ?)`, setID, bookID, at, at)
		},
		func() error {
			guide := blocks(`{"type":"para","text":"Start from Kirchhoff's current law at the top node."}
{"type":"derivation","steps":[{"tex":"i_1 + i_2 = i_3","why":"Current in equals current out."}]}`)
			for i, q := range []struct{ id, label, text string }{
				{q1, "3.14", "Problem 3.14: find the current through the resistor."},
				{q2, "3.15", "Problem 3.15: find the equivalent resistance."},
			} {
				if err := exec(`INSERT INTO questions (id, homework_id, position, text, in_book, label, statement, page, hint, walkthrough, state, difficulty, created_at, updated_at)
					VALUES (?, ?, ?, ?, 1, ?, ?, 2, '[]', ?, 'ready', ?, ?, ?)`,
					q.id, setID, i+1, q.text, q.label, statement(q.text), guide, 3+i, at, at); err != nil {
					return err
				}
			}
			return nil
		},
		func() error {
			return exec(`INSERT INTO turns (id, book_id, question, answer, state, created_at, updated_at) VALUES (?, ?, 'What is Kirchhoff''s current law?', ?, 'done', ?, ?)`,
				turnID, bookID, blocks(`{"type":"para","text":"The currents entering a node sum to zero [p. 2]."}`), at, at)
		},
		func() error {
			return exec(`INSERT INTO assignment_reads (id, book_id, source, state, result, created_at, updated_at)
				VALUES (?, ?, 'pasted', 'ready', '{"source":"pasted","title":"Problem set 4","groups":[]}', ?, ?)`, readID, bookID, at, at)
		},
	}
	for _, s := range steps {
		if err := s(); err != nil {
			return err
		}
	}
	return calls(ctx, d, now)
}

// clear removes what an earlier run seeded.
func clear(ctx context.Context, d *sql.DB) error {
	for _, q := range []string{
		`DELETE FROM calls WHERE subject_id LIKE 'seed-%'`,
		`DELETE FROM books WHERE id = 'seed-book'`, // the set, questions, turn, read and pages cascade
	} {
		if _, err := d.ExecContext(ctx, q); err != nil {
			return err
		}
	}
	return nil
}

func copyBook(dir string) error {
	src, err := os.Open(filepath.Join("testdata", "sample-digital.pdf"))
	if err != nil {
		return fmt.Errorf("run it from the repo root: %w", err)
	}
	defer src.Close()
	if err := os.MkdirAll(filepath.Join(dir, "books"), 0o700); err != nil {
		return err
	}
	dst, err := os.Create(filepath.Join(dir, "books", bookID+".pdf"))
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	return err
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

type call struct {
	subject, id, stage, run string
	ago                     time.Duration
	ms                      int64
	asked, answered         string
	in, out, reasoning      int
	cached                  int
	cost                    float64
	tools, err              string
}

func calls(ctx context.Context, d *sql.DB, now time.Time) error {
	const (
		perceptron = "z-ai/perceptron-mk1.5"
		luna       = "openai/gpt-6-luna"
		haiku      = "anthropic/claude-haiku-5.5"
		deepseek   = "deepseek/deepseek-v4.1-flash"
	)
	min := time.Minute
	cs := []call{
		// Question 1: a first run (find, figures, guide), then a retry whose
		// first guide call hit a rate limit and was served by a fallback.
		{"question", q1, "Find", "r1", 300 * min, 2100, perceptron, perceptron, 8200, 1212, 0, 0, 0.0004, "", ""},
		{"question", q1, "Figures", "r1", 299 * min, 1500, luna, luna, 5400, 900, 0, 0, 0.0003, "", ""},
		{"question", q1, "Figures", "r1", 299 * min, 2500, luna, luna, 4000, 1000, 0, 0, 0.0006, "", ""},
		{"question", q1, "Figures", "r1", 298 * min, 1900, luna, luna, 4400, 800, 0, 0, 0.0005, "", ""},
		{"question", q1, "Guide", "r1", 297 * min, 7000, haiku, haiku, 7000, 1800, 1400, 5000, 0.0018, "search_pages,read_page", ""},
		{"question", q1, "Guide", "r1", 296 * min, 6200, haiku, haiku, 9100, 2100, 1700, 6500, 0.0021, "", ""},
		{"question", q1, "Guide", "r2", 120 * min, 900, haiku, "", 0, 0, 0, 0, 0, "", "rate limited (429)"},
		{"question", q1, "Guide", "r2", 120 * min, 6100, haiku, deepseek, 5000, 1900, 1700, 7000, 0.0015, "", ""},
		// Question 2: one plain run.
		{"question", q2, "Find", "r3", 299 * min, 1800, perceptron, perceptron, 7600, 1050, 0, 0, 0.0004, "", ""},
		{"question", q2, "Guide", "r3", 298 * min, 5400, haiku, haiku, 6200, 1400, 900, 4200, 0.0014, "search_pages", ""},
		// The set's difficulty ranking, shared by both questions.
		{"set", setID, "Rank", "rk", 295 * min, 1300, luna, luna, 1400, 88, 0, 0, 0.0003, "", ""},
		// An Ask turn: three tool rounds and a repair.
		{"turn", turnID, "Round 1", "t1", 200 * min, 3100, haiku, haiku, 3000, 240, 180, 0, 0.0007, "search_pages", ""},
		{"turn", turnID, "Round 2", "t1", 200 * min, 3600, haiku, haiku, 4800, 310, 220, 2600, 0.0006, "read_page,compute", ""},
		{"turn", turnID, "Round 3", "t1", 199 * min, 6800, haiku, haiku, 6100, 920, 400, 4400, 0.0012, "", ""},
		{"turn", turnID, "Repairs", "t1", 199 * min, 700, haiku, haiku, 900, 60, 0, 0, 0.0001, "", ""},
		// An assignment read.
		{"read", readID, "Read", "rd", 250 * min, 9200, haiku, haiku, 12000, 1800, 1100, 8000, 0.0024, "", ""},
		// The book's import.
		{"book", bookID, "Naming", "im", 1500 * min, 2700, haiku, haiku, 4600, 300, 0, 0, 0.0006, "", ""},
		{"book", bookID, "Contents", "im", 1499 * min, 13000, haiku, haiku, 23000, 3600, 2000, 0, 0.0032, "", ""},
	}
	for _, c := range cs {
		var in, out, reasoning, cached, cost any
		if c.err == "" {
			in, out, cost = c.in, c.out, c.cost
			reasoning, cached = nullZero(c.reasoning), nullZero(c.cached)
		}
		_, err := d.ExecContext(ctx, `INSERT INTO calls (at, subject_type, subject_id, model, answered, ms, prompt_tokens, completion_tokens, cost, host, session, error,
				stage, run, tools, reasoning_tokens, cached_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
			now.Add(-c.ago).Format(time.RFC3339), c.subject, c.id, c.asked, nullIf(c.answered), c.ms, in, out, cost, nullIf(c.err),
			c.stage, c.run, nullIf(c.tools), reasoning, cached)
		if err != nil {
			return err
		}
	}
	return nil
}

func nullIf(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// nullZero is a count a provider didn't report: stored absent, as the sink does.
func nullZero(n int) any {
	if n == 0 {
		return nil
	}
	return n
}
