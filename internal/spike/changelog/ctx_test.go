package changelog

import (
	"database/sql"
	"database/sql/driver"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"modernc.org/sqlite"

	"github.com/jackt/pset/internal/db"
)

// Q1a. A write that forgets the context fails, whatever kind of write it is.
func TestForgottenContextFailsLoudly(t *testing.T) {
	d := open(t, all())
	setID, qs := seed(t, d, 2)
	for _, q := range []string{
		`UPDATE homework SET title = 'renamed' WHERE id = 'set-1'`,
		`UPDATE questions SET activity = 'thinking' WHERE id = 'q-01'`,
		`INSERT INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at) VALUES ('q-x', 'set-1', 9, 't', 0, 'pending', '', '')`,
		`INSERT INTO pages (book_id, number, text, status) VALUES ('book-1', 1, 'x', 'text')`,
		`DELETE FROM questions WHERE id = 'q-02'`,
		`DELETE FROM books WHERE id = 'book-1'`, // cascades into homework and questions
	} {
		_, err := d.Exec(q)
		if err == nil {
			t.Errorf("no error for %s", q)
			continue
		}
		t.Logf("%-60.60s -> %v", q, err)
	}
	// Nothing changed.
	if n := count(t, d, `SELECT count(*) FROM questions WHERE homework_id = ?`, setID); n != len(qs) {
		t.Errorf("questions: %d", n)
	}
	// A DELETE with a context that is not the purge's is refused too.
	err := Write(bg, d, "student", "a-del", func(tx *sql.Tx) error {
		_, err := tx.Exec(`DELETE FROM homework WHERE id = ?`, setID)
		return err
	})
	t.Logf("student DELETE -> %v", err)
	if err == nil {
		t.Error("a student DELETE went through")
	}
	// The purge's DELETE goes through, cascades included, and logs nothing.
	before := count(t, d, `SELECT count(*) FROM changes`)
	must(t, Write(bg, d, "purge", "purge-1", func(tx *sql.Tx) error {
		_, err := tx.Exec(`DELETE FROM books WHERE id = ?`, bookID)
		return err
	}))
	if n := count(t, d, `SELECT count(*) FROM questions`); n != 0 {
		t.Errorf("cascade left %d questions", n)
	}
	if n := count(t, d, `SELECT count(*) FROM changes`); n != before {
		t.Errorf("purge logged %d rows", n-before)
	}
}

// Q1b. The context table with a pooled database/sql: many writers at once,
// each attributed to its own action, readers never see a context row, and
// writes without a context all fail.
func TestContextTableUnderPooling(t *testing.T) {
	d := open(t, all())
	d.SetMaxOpenConns(10)
	setID, _ := seed(t, d, 1)
	const writers, each = 8, 40
	var wg sync.WaitGroup
	var stop atomic.Bool
	var seen, forgotOK, forgotFailed atomic.Int64
	// Readers on other connections.
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stop.Load() {
				var n int
				if err := d.QueryRow(`SELECT count(*) FROM change_ctx`).Scan(&n); err != nil {
					t.Error(err)
					return
				}
				if n > 0 {
					seen.Add(1)
				}
			}
		}()
	}
	// Writers that forget the context.
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for j := 0; !stop.Load(); j++ {
				_, err := d.Exec(`UPDATE homework SET title = ? WHERE id = ?`, fmt.Sprintf("forgot-%d-%d", i, j), setID)
				if err == nil {
					forgotOK.Add(1)
				} else if strings.Contains(err.Error(), "without a change context") {
					forgotFailed.Add(1)
				} else {
					t.Errorf("forgot writer: unexpected %v", err)
				}
			}
		}(i)
	}
	var ww sync.WaitGroup
	for w := 0; w < writers; w++ {
		ww.Add(1)
		go func(w int) {
			defer ww.Done()
			for j := 0; j < each; j++ {
				actor := []string{"student", "pset"}[w%2]
				action := fmt.Sprintf("w%d-%d", w, j)
				err := Write(bg, d, actor, action, func(tx *sql.Tx) error {
					// Read, then write: the title carries the action id.
					var cur string
					if err := tx.QueryRow(`SELECT title FROM homework WHERE id = ?`, setID).Scan(&cur); err != nil {
						return err
					}
					_, err := tx.Exec(`UPDATE homework SET title = ? WHERE id = ?`, action+"|"+actor, setID)
					return err
				})
				if err != nil {
					t.Errorf("writer %d: %v", w, err)
				}
			}
		}(w)
	}
	ww.Wait()
	stop.Store(true)
	wg.Wait()

	rows, err := Rows(d, `SELECT action_id, actor, json_extract(after, '$.title') AS title FROM changes WHERE kind = 'set' AND op = 'changed'`)
	must(t, err)
	bad := 0
	for _, r := range rows {
		if r["title"] != nil && r["title"].(string) != r["action_id"].(string)+"|"+r["actor"].(string) {
			bad++
			t.Errorf("misattributed: %v", r)
		}
	}
	t.Logf("%d set changes logged, %d misattributed; forgotten-context writes: %d failed, %d went through; reader saw a context row %d times",
		len(rows), bad, forgotFailed.Load(), forgotOK.Load(), seen.Load())
	if forgotOK.Load() > 0 || seen.Load() > 0 {
		t.Error("a forgotten write went through, or a reader saw the context")
	}
	if n := count(t, d, `SELECT count(*) FROM change_ctx`); n != 0 {
		t.Errorf("%d context rows left", n)
	}
}

// Q1c. The one hazard of the context table: a transaction that sets the
// context and commits without clearing it. The next write that forgets its
// context is then silently attributed to the stale action. The Write helper
// clears it; a hand-written transaction might not.
func TestLeakedContextHazard(t *testing.T) {
	d := open(t, all())
	setID, _ := seed(t, d, 1)
	must(t, db.Tx(bg, d, func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO change_ctx (only, actor, action_id, at) VALUES (1, 'student', 'leaky', ?)`, db.Now())
		return err
	}))
	_, err := d.Exec(`UPDATE homework SET title = 'later, by a job' WHERE id = ?`, setID)
	t.Logf("write without context after a leak -> err=%v", err)
	dump(t, d, `SELECT * FROM changes WHERE action_id = 'leaky'`)
	if err == nil {
		t.Log("HAZARD CONFIRMED: attributed to the leaked context 'leaky'")
	}
	// The next Write fails loudly, because the context row already exists.
	err = Write(bg, d, "pset", "next", func(tx *sql.Tx) error { return nil })
	t.Logf("next Write after a leak -> %v", err)
	if err == nil {
		t.Error("Write over a leaked context succeeded")
	}
}

// Q1d. A TEMP table per connection. A main-schema trigger cannot read a temp
// table at all; TEMP triggers can, but they exist only on the connection that
// created them, so a pooled connection without them logs nothing, silently.
func TestTempTableCandidate(t *testing.T) {
	d := open(t, Options{}) // the changes schema, no generated triggers
	d.SetMaxOpenConns(3)
	seed(t, d, 1)
	c1, err := d.Conn(bg)
	must(t, err)
	defer c1.Close()
	_, err = c1.ExecContext(bg, `CREATE TEMP TABLE tctx (actor TEXT, action_id TEXT)`)
	must(t, err)
	// A main trigger reading the temp table.
	_, err = c1.ExecContext(bg, `CREATE TRIGGER main_reads_temp AFTER UPDATE ON homework BEGIN
		INSERT INTO changes (at, kind, res_id, op, actor, action_id) SELECT 'x', 'set', NEW.id, 'changed', actor, action_id FROM tctx; END`)
	t.Logf("create main trigger reading temp table -> %v", err)
	if err == nil {
		_, err = c1.ExecContext(bg, `UPDATE homework SET title = 'via main trigger'`)
		t.Logf("fire it -> %v", err)
		_, _ = c1.ExecContext(bg, `DROP TRIGGER main_reads_temp`)
	}
	_, err = c1.ExecContext(bg, `CREATE TEMP TRIGGER temp_log AFTER UPDATE ON main.homework BEGIN
		INSERT INTO changes (at, kind, res_id, op, actor, action_id) SELECT 'x', 'set', NEW.id, 'changed', actor, action_id FROM tctx; END`)
	must(t, err)
	_, err = c1.ExecContext(bg, `INSERT INTO tctx VALUES ('student', 'on-c1')`)
	must(t, err)
	_, err = c1.ExecContext(bg, `UPDATE homework SET title = 'on c1'`)
	must(t, err)
	c2, err := d.Conn(bg)
	must(t, err)
	_, err = c2.ExecContext(bg, `UPDATE homework SET title = 'on c2, another pooled connection'`)
	must(t, err)
	c2.Close()
	n := count(t, d, `SELECT count(*) FROM changes WHERE kind = 'set'`)
	t.Logf("two updates, on two pooled connections: %d logged (c2's write went unlogged, no error)", n)
	if n != 1 {
		t.Errorf("want exactly 1 logged, got %d", n)
	}
	// A temp context row also outlives the transaction: it is the
	// connection's, so the next user of that pooled connection inherits it.
	_, err = c1.ExecContext(bg, `UPDATE homework SET title = 'later user of c1'`)
	must(t, err)
	dump(t, d, `SELECT * FROM changes WHERE kind = 'set'`)
}

// Q1e. A Go function the trigger calls. It works (trusted_schema is on), but
// it is registered on the driver for every connection and cannot tell which
// connection called it, so it can only read process-global state. That is
// sound only while the write lock serializes writers AND the state is set
// after BEGIN; setting it before BEGIN misattributes.
var goActor atomic.Value

func init() {
	goActor.Store("")
	sqlite.MustRegisterScalarFunction("spike_actor", 0, func(*sqlite.FunctionContext, []driver.Value) (driver.Value, error) {
		a := goActor.Load().(string)
		if a == "" {
			return nil, fmt.Errorf("changelog: no actor set")
		}
		return a, nil
	})
}

func TestGoFunctionCandidate(t *testing.T) {
	d := open(t, Options{})
	d.SetMaxOpenConns(4)
	seed(t, d, 1)
	_, err := d.Exec(`CREATE TRIGGER fn_log AFTER UPDATE ON homework BEGIN
		INSERT INTO changes (at, kind, res_id, op, actor, action_id) VALUES ('x', 'set', NEW.id, 'changed', 'student', spike_actor()); END`)
	must(t, err)
	_, err = d.Exec(`UPDATE homework SET title = 'no actor'`)
	t.Logf("no actor set -> %v", err)

	// Misattribution: tx1 holds the write lock with its actor set; a second
	// writer sets its actor before BEGIN (waiting for the lock); tx1's
	// write is then logged under the second writer's action.
	tx1, err := d.BeginTx(bg, nil)
	must(t, err)
	goActor.Store("action-1")
	done := make(chan error)
	go func() {
		goActor.Store("action-2") // set before BEGIN: blocks on the lock below
		err := db.Tx(bg, d, func(tx *sql.Tx) error {
			_, err := tx.Exec(`UPDATE homework SET title = 'by action 2'`)
			return err
		})
		done <- err
	}()
	time.Sleep(100 * time.Millisecond)
	_, err = tx1.Exec(`UPDATE homework SET title = 'by action 1'`)
	must(t, err)
	must(t, tx1.Commit())
	must(t, <-done)
	goActor.Store("")
	dump(t, d, `SELECT * FROM changes WHERE kind = 'set'`)
	var first string
	must(t, d.QueryRow(`SELECT action_id FROM changes WHERE kind = 'set' ORDER BY seq LIMIT 1`).Scan(&first))
	t.Logf("action 1's write was logged as %q", first)

	// With trusted_schema off, a trigger may not call it at all.
	c, err := d.Conn(bg)
	must(t, err)
	defer c.Close()
	_, err = c.ExecContext(bg, `PRAGMA trusted_schema = OFF`)
	must(t, err)
	goActor.Store("x")
	_, err = c.ExecContext(bg, `UPDATE homework SET title = 'untrusted'`)
	goActor.Store("")
	t.Logf("trusted_schema=OFF -> %v", err)
	_, _ = c.ExecContext(bg, `PRAGMA trusted_schema = ON`)
}
