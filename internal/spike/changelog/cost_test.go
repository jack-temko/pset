package changelog

import (
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
)

// The cost measurements run only with CHANGELOG_COST=1; CHANGELOG_ROUNDS sets
// how many interleaved rounds (default 5). Each round makes a fresh database
// per variant and runs the variants in a rotating order, so a burst of load
// from other jobs on the machine lands on different variants.

const pageCount = 700

var pages = func() []string {
	out := make([]string, pageCount)
	for i := range out {
		// Textbook pages run 1.5 to 4 KB of text.
		out[i] = pageText(int64(i), 1500+(i*37)%2500)
	}
	return out
}()

func rounds(t *testing.T) int {
	if os.Getenv("CHANGELOG_COST") != "1" {
		t.Skip("set CHANGELOG_COST=1 to measure")
	}
	if n, err := strconv.Atoi(os.Getenv("CHANGELOG_ROUNDS")); err == nil {
		return n
	}
	return 5
}

type variant struct {
	name string
	opts Options
	run  func(t *testing.T, d *sql.DB) // timed
	prep func(t *testing.T, d *sql.DB) // untimed
}

type result struct {
	dur   []time.Duration
	bytes []int64 // file size after
	clog  []int64 // bytes in changes and its indexes
}

func savePage(q interface {
	Exec(string, ...any) (sql.Result, error)
}, n int, text string) error {
	_, err := q.Exec(`INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, ?)
		ON CONFLICT (book_id, number) DO UPDATE SET text = excluded.text, status = excluded.status`, bookID, n, text, "text")
	return err
}

func importTx(tx *sql.Tx) error {
	if _, err := tx.Exec(`UPDATE books SET title = ?, author = ?, page_count = ?, page_width = ?, page_height = ?, kind = ?, updated_at = ? WHERE id = ?`,
		"Circuits", "Someone", pageCount, 612.0, 792.0, "digital", db.Now(), bookID); err != nil {
		return err
	}
	for i, p := range pages {
		if err := savePage(tx, i+1, p); err != nil {
			return err
		}
	}
	return nil
}

func materialRow(tx *sql.Tx) error {
	_, err := tx.Exec(`INSERT INTO changes (at, kind, res_id, course_id, op, actor, action_id)
		SELECT at, 'material', ?, ?, 'changed', actor, action_id FROM change_ctx`, bookID, bookID)
	return err
}

func size(t *testing.T, d *sql.DB, path string) (int64, int64) {
	_, err := d.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	must(t, err)
	st, err := os.Stat(path)
	must(t, err)
	var clog sql.NullInt64
	_ = d.QueryRow(`SELECT sum(pgsize) FROM dbstat WHERE name IN ('changes', 'changes_action', 'changes_res', 'changes_undoes')`).Scan(&clog)
	return st.Size(), clog.Int64
}

func measure(t *testing.T, n int, vs []variant) {
	res := make([]result, len(vs))
	for r := 0; r < n; r++ {
		for k := range vs {
			i := (k + r) % len(vs)
			v := vs[i]
			dir := t.TempDir()
			d, path, err := Open(dir, v.opts)
			must(t, err)
			seed(t, d, 0)
			if v.prep != nil {
				v.prep(t, d)
			}
			start := time.Now()
			v.run(t, d)
			res[i].dur = append(res[i].dur, time.Since(start))
			b, c := size(t, d, path)
			res[i].bytes = append(res[i].bytes, b)
			res[i].clog = append(res[i].clog, c)
			d.Close()
		}
	}
	base := res[0]
	for i, v := range vs {
		ds := append([]time.Duration{}, res[i].dur...)
		sort.Slice(ds, func(a, b int) bool { return ds[a] < ds[b] })
		var ratios []float64
		for r := range res[i].dur {
			ratios = append(ratios, float64(res[i].dur[r])/float64(base.dur[r]))
		}
		sort.Float64s(ratios)
		line := fmt.Sprintf("%-28s median %8.1fms  min %8.1fms  max %8.1fms  q1..q3 %6.1f..%6.1fms | paired ratio to %s: median %.3f (min %.3f, max %.3f) | db file %7.1f KB (+%.1f%%), change log %6.1f KB",
			v.name, ms(med(ds)), ms(ds[0]), ms(ds[len(ds)-1]), ms(ds[len(ds)/4]), ms(ds[(3*len(ds))/4]),
			vs[0].name, medf(ratios), ratios[0], ratios[len(ratios)-1],
			float64(res[i].bytes[0])/1024, 100*float64(res[i].bytes[0]-base.bytes[0])/float64(base.bytes[0]), float64(res[i].clog[0])/1024)
		t.Log(line)
		fmt.Println("RESULT " + t.Name() + " " + line)
	}
}

func ms(d time.Duration) float64 { return float64(d.Microseconds()) / 1000 }
func med(ds []time.Duration) time.Duration {
	if len(ds)%2 == 1 {
		return ds[len(ds)/2]
	}
	return (ds[len(ds)/2-1] + ds[len(ds)/2]) / 2
}
func medf(fs []float64) float64 {
	if len(fs)%2 == 1 {
		return fs[len(fs)/2]
	}
	return (fs[len(fs)/2-1] + fs[len(fs)/2]) / 2
}

// QuestionsQuiet is Questions with activity (the writer's working line,
// rewritten every few seconds) left out of the log: ephemeral, sent live
// without being logged.
var QuestionsQuiet = func() Table {
	q := Questions
	q.PSet = nil
	for _, c := range Questions.PSet {
		if c != "activity" {
			q.PSet = append(q.PSet, c)
		}
	}
	q.Meta = append(append([]string{}, Questions.Meta...), "activity")
	return q
}()

var (
	noLog      = Options{NoChangeLog: true}
	logPerPage = all()
	logNoPages = Options{Log: []Table{Homework, Questions}}
)

// Q2a. A digital book: every page in one transaction, as examine does.
func TestCostImportDigital(t *testing.T) {
	n := rounds(t)
	measure(t, n, []variant{
		{name: "none", opts: noLog, run: func(t *testing.T, d *sql.DB) { must(t, db.Tx(bg, d, importTx)) }},
		{name: "row per page", opts: logPerPage, run: func(t *testing.T, d *sql.DB) { must(t, Write(bg, d, "pset", "import", importTx)) }},
		{name: "row per material", opts: logNoPages, run: func(t *testing.T, d *sql.DB) {
			must(t, Write(bg, d, "pset", "import", func(tx *sql.Tx) error {
				if err := importTx(tx); err != nil {
					return err
				}
				return materialRow(tx)
			}))
		}},
	})
}

// Q2b. A scanned book: one page per write, autocommit, as read does after
// each page's OCR. Logged per page, each page becomes a Write (transaction
// plus context row).
func TestCostImportScanned(t *testing.T) {
	n := rounds(t)
	measure(t, n, []variant{
		{name: "none", opts: noLog, run: func(t *testing.T, d *sql.DB) {
			for i, p := range pages {
				must(t, savePage(d, i+1, p))
			}
		}},
		{name: "row per page", opts: logPerPage, run: func(t *testing.T, d *sql.DB) {
			for i, p := range pages {
				must(t, Write(bg, d, "pset", "import", func(tx *sql.Tx) error { return savePage(tx, i+1, p) }))
			}
		}},
		{name: "row per material", opts: logNoPages, run: func(t *testing.T, d *sql.DB) {
			for i, p := range pages {
				must(t, savePage(d, i+1, p))
			}
			must(t, Write(bg, d, "pset", "import", materialRow))
		}},
	})
}

// Q2c. 2,000 small updates to questions, as guides being written make them:
// mostly activity, some state, every 40th the guide itself (hint and a 6 KB
// walkthrough). Each its own autocommit today.
func TestCostQuestionUpdates(t *testing.T) {
	n := rounds(t)
	prep := func(t *testing.T, d *sql.DB) {
		must(t, Write(bg, d, "pset", "seed-q", func(tx *sql.Tx) error {
			now := db.Now()
			if _, err := tx.Exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('set-q', ?, 'HW', ?, ?)`, bookID, now, now); err != nil {
				return err
			}
			for i := 0; i < 20; i++ {
				if _, err := tx.Exec(`INSERT INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at) VALUES (?, 'set-q', ?, 't', 1, 'located', ?, ?)`,
					fmt.Sprintf("qq-%02d", i), i+1, now, now); err != nil {
					return err
				}
			}
			return nil
		}))
	}
	// noLog databases have no change_ctx table, so Write cannot run there.
	prepNoLog := func(t *testing.T, d *sql.DB) {
		now := db.Now()
		_, err := d.Exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('set-q', ?, 'HW', ?, ?)`, bookID, now, now)
		must(t, err)
		for i := 0; i < 20; i++ {
			_, err := d.Exec(`INSERT INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at) VALUES (?, 'set-q', ?, 't', 1, 'located', ?, ?)`,
				fmt.Sprintf("qq-%02d", i), i+1, now, now)
			must(t, err)
		}
	}
	guide, hint := guideJSON(7, 6000), guideJSON(8, 300)
	update := func(k int) (string, []any) {
		q := fmt.Sprintf("qq-%02d", k%20)
		switch k % 40 {
		case 0:
			return `UPDATE questions SET state = 'writing', error = '', activity = '', updated_at = ? WHERE id = ?`, []any{db.Now(), q}
		case 39:
			return `UPDATE questions SET hint = ?, walkthrough = ?, state = 'ready', error = '', activity = '', rounds = '[]', updated_at = ? WHERE id = ?`, []any{hint, guide, db.Now(), q}
		}
		return `UPDATE questions SET activity = ? WHERE id = ?`, []any{fmt.Sprintf(`{"kind":"tool","label":"Reading page %d"}`, k), q}
	}
	measure(t, n, []variant{
		{name: "none (autocommit)", opts: noLog, prep: prepNoLog, run: func(t *testing.T, d *sql.DB) {
			for k := 0; k < 2000; k++ {
				s, a := update(k)
				_, err := d.Exec(s, a...)
				must(t, err)
			}
		}},
		{name: "context only, no triggers", opts: Options{}, prep: prep, run: func(t *testing.T, d *sql.DB) {
			for k := 0; k < 2000; k++ {
				s, a := update(k)
				must(t, Write(bg, d, "pset", "job", func(tx *sql.Tx) error { _, err := tx.Exec(s, a...); return err }))
			}
		}},
		{name: "logged", opts: logPerPage, prep: prep, run: func(t *testing.T, d *sql.DB) {
			for k := 0; k < 2000; k++ {
				s, a := update(k)
				must(t, Write(bg, d, "pset", "job", func(tx *sql.Tx) error { _, err := tx.Exec(s, a...); return err }))
			}
		}},
		{name: "none, prepared", opts: noLog, prep: prepNoLog, run: func(t *testing.T, d *sql.DB) { preparedRun(t, d, update, false) }},
		{name: "context only, prepared", opts: Options{}, prep: prep, run: func(t *testing.T, d *sql.DB) { preparedRun(t, d, update, true) }},
		{name: "logged, prepared", opts: logPerPage, prep: prep, run: func(t *testing.T, d *sql.DB) { preparedRun(t, d, update, true) }},
		{name: "logged, activity unlogged", opts: Options{Log: []Table{Homework, QuestionsQuiet, Pages}}, prep: prep, run: func(t *testing.T, d *sql.DB) {
			for k := 0; k < 2000; k++ {
				s, a := update(k)
				must(t, Write(bg, d, "pset", "job", func(tx *sql.Tx) error { _, err := tx.Exec(s, a...); return err }))
			}
		}},
		{name: "activity unlogged+autocommit", opts: Options{Log: []Table{Homework, QuestionsQuiet, Pages}}, prep: prep, run: func(t *testing.T, d *sql.DB) {
			for k := 0; k < 2000; k++ {
				s, a := update(k)
				if k%40 != 0 && k%40 != 39 {
					_, err := d.Exec(s, a...)
					must(t, err)
					continue
				}
				must(t, Write(bg, d, "pset", "job", func(tx *sql.Tx) error { _, err := tx.Exec(s, a...); return err }))
			}
		}},
		{name: "prepare only, no triggers", opts: Options{}, prep: prep, run: func(t *testing.T, d *sql.DB) { prepareOnly(t, d, update) }},
		{name: "prepare only, logged", opts: logPerPage, prep: prep, run: func(t *testing.T, d *sql.DB) { prepareOnly(t, d, update) }},
	})
}

// Q6. Purging a 700-page book (cascade into pages and the FTS index): the
// page delete triggers fire on every cascaded row.
func TestCostPurgeBook(t *testing.T) {
	n := rounds(t)
	load := func(t *testing.T, d *sql.DB) { must(t, Write(bg, d, "pset", "import", importTx)) }
	measure(t, n, []variant{
		{name: "none", opts: noLog, prep: func(t *testing.T, d *sql.DB) { must(t, db.Tx(bg, d, importTx)) }, run: func(t *testing.T, d *sql.DB) {
			_, err := d.Exec(`DELETE FROM books WHERE id = ?`, bookID)
			must(t, err)
		}},
		{name: "page triggers (purge)", opts: logPerPage, prep: load, run: func(t *testing.T, d *sql.DB) {
			must(t, Write(bg, d, "purge", "purge", func(tx *sql.Tx) error { _, err := tx.Exec(`DELETE FROM books WHERE id = ?`, bookID); return err }))
		}},
	})
}

// Q6. Write contention: a digital import holds the write lock for its whole
// transaction; a student's rename that arrives meanwhile waits for it.
func TestContention(t *testing.T) {
	n := rounds(t)
	for _, v := range []struct {
		name string
		opts Options
	}{{"row per page", logPerPage}, {"row per material", logNoPages}} {
		var waits, imports []time.Duration
		for r := 0; r < n; r++ {
			d, _, err := Open(t.TempDir(), v.opts)
			must(t, err)
			seed(t, d, 1)
			var wg sync.WaitGroup
			wg.Add(1)
			var importDur time.Duration
			go func() {
				defer wg.Done()
				s := time.Now()
				must(t, Write(bg, d, "pset", "import", importTx))
				importDur = time.Since(s)
			}()
			time.Sleep(20 * time.Millisecond)
			s := time.Now()
			err = Write(bg, d, "student", "rename", func(tx *sql.Tx) error {
				_, err := tx.Exec(`UPDATE homework SET title = 'renamed' WHERE id = 'set-1'`)
				return err
			})
			waits = append(waits, time.Since(s))
			if err != nil {
				t.Errorf("student write failed: %v", err)
			}
			wg.Wait()
			imports = append(imports, importDur)
			d.Close()
		}
		sort.Slice(waits, func(a, b int) bool { return waits[a] < waits[b] })
		sort.Slice(imports, func(a, b int) bool { return imports[a] < imports[b] })
		line := fmt.Sprintf("%-18s import holds the lock: median %.1fms (max %.1fms); student rename waited: median %.1fms (max %.1fms); busy_timeout is 5000ms",
			v.name, ms(med(imports)), ms(imports[len(imports)-1]), ms(med(waits)), ms(waits[len(waits)-1]))
		t.Log(line)
		fmt.Println("RESULT " + t.Name() + " " + strings.TrimSpace(line))
	}
}

// Benchmarks for go test -bench (one variant each; the interleaved test
// above is the evidence).
func BenchmarkImportDigitalNone(b *testing.B) {
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		d, _, _ := Open(b.TempDir(), noLog)
		seed(b, d, 0)
		b.StartTimer()
		must(b, db.Tx(bg, d, importTx))
		b.StopTimer()
		d.Close()
	}
}

func BenchmarkImportDigitalPerPage(b *testing.B) {
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		d, _, _ := Open(b.TempDir(), logPerPage)
		seed(b, d, 0)
		b.StartTimer()
		must(b, Write(bg, d, "pset", "import", importTx))
		b.StopTimer()
		d.Close()
	}
}

// preparedRun is the same 2,000 updates with every statement prepared once
// (on a single connection, so each prepared statement is reused).
func preparedRun(t *testing.T, d *sql.DB, update func(int) (string, []any), withCtx bool) {
	d.SetMaxOpenConns(1)
	stmts := map[string]*sql.Stmt{}
	get := func(q string) *sql.Stmt {
		if s, ok := stmts[q]; ok {
			return s
		}
		s, err := d.Prepare(q)
		must(t, err)
		stmts[q] = s
		return s
	}
	var ins, del *sql.Stmt
	if withCtx {
		ins = get(`INSERT INTO change_ctx (only, actor, action_id, undoes, at) VALUES (1, ?, ?, '', ?)`)
		del = get(`DELETE FROM change_ctx`)
	}
	for k := 0; k < 2000; k++ {
		q, a := update(k)
		st := get(q)
		if !withCtx {
			_, err := st.Exec(a...)
			must(t, err)
			continue
		}
		tx, err := d.Begin()
		must(t, err)
		_, err = tx.Stmt(ins).Exec("pset", "job", db.Now())
		must(t, err)
		_, err = tx.Stmt(st).Exec(a...)
		must(t, err)
		_, err = tx.Stmt(del).Exec()
		must(t, err)
		must(t, tx.Commit())
	}
	for _, s := range stmts {
		s.Close()
	}
}

// prepareOnly prepares (and closes) each update statement 2,000 times, which
// is what database/sql does on every Exec with arguments: the cost of
// compiling the triggers into the statement.
func prepareOnly(t *testing.T, d *sql.DB, update func(int) (string, []any)) {
	for k := 0; k < 2000; k++ {
		q, _ := update(k)
		s, err := d.Prepare(q)
		must(t, err)
		s.Close()
	}
}
