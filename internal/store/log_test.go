package store

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
)

func exec(t *testing.T, s *Store, who change.Actor, action string, stmts ...string) {
	t.Helper()
	must(t, s.Write(bg, who, action, func(tx *sql.Tx) error {
		for _, q := range stmts {
			if _, err := tx.Exec(q); err != nil {
				return fmt.Errorf("%s: %w", q, err)
			}
		}
		return nil
	}))
}

func is(err error, e *errs.Entry) bool { return errors.Is(err, e) }

func title(t *testing.T, s *Store) string {
	t.Helper()
	var v string
	must(t, s.DB.QueryRow(`SELECT title FROM sets WHERE id = 's1'`).Scan(&v))
	return v
}

func TestUndoTakesBackNewestFirstAndRedoes(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "A", `UPDATE sets SET title = 'Y' WHERE id = 's1'`)
	exec(t, s, change.ActorStudent, "B", `UPDATE sets SET title = 'Z' WHERE id = 's1'`)
	// PSet's own write to the set does not stand in the way.
	before := count(t, s, `SELECT count(*) FROM changes`)
	exec(t, s, change.ActorPSet, "",
		`INSERT INTO courses (id, name, created_at) VALUES ('c2', 'Other', 'now')`,
		`UPDATE sets SET course_id = 'c2' WHERE id = 's1'`)
	if count(t, s, `SELECT count(*) FROM changes`) != before+2 {
		t.Fatal("PSet's move of the set was not logged")
	}

	if newest, err := s.Newest(bg); err != nil || newest != "B" {
		t.Fatalf("newest %q %v, want B", newest, err)
	}
	if _, err := s.Undo(bg, "A", "uA"); !is(err, ChangedSince) {
		t.Fatalf("undoing A under B: %v, want changed since", err)
	}
	if _, err := s.Undo(bg, "B", "uB"); err != nil || title(t, s) != "Y" {
		t.Fatalf("undo B: %v, title %q", err, title(t, s))
	}
	if _, err := s.Undo(bg, "B", "uB2"); !is(err, AlreadyUndone) {
		t.Fatalf("undoing B twice: %v", err)
	}
	if newest, _ := s.Newest(bg); newest != "A" {
		t.Fatalf("after undoing B, Ctrl+Z takes %q, want A", newest)
	}
	if _, err := s.Undo(bg, "A", "uA"); err != nil || title(t, s) != "Problem set 4" {
		t.Fatalf("undo A: %v, title %q", err, title(t, s))
	}
	// Redo is undoing the undo.
	if _, err := s.Undo(bg, "uA", "redoA"); err != nil || title(t, s) != "Y" {
		t.Fatalf("redo A: %v, title %q", err, title(t, s))
	}
	if _, err := s.Undo(bg, "nope", "x"); !is(err, NothingToUndo) {
		t.Fatalf("undoing an unknown action: %v", err)
	}
}

func TestUndoRefusesToThrowAwayPSetsWork(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "fix", `UPDATE readings SET lines = '[["R = 4 ohm"]]', corrected = 1 WHERE id = 'r1'`)
	exec(t, s, change.ActorPSet, "", `UPDATE readings SET lines = '[["R = 5 ohm"]]' WHERE id = 'r1'`)
	if _, err := s.Undo(bg, "fix", "u"); !is(err, RewrittenSince) {
		t.Fatalf("undoing a correction PSet read over: %v", err)
	}
	// PSet writing over what a student action changed, through a column
	// logged without values for PSet, is caught by the values left.
	exec(t, s, change.ActorStudent, "rank", `UPDATE questions SET difficulty = 4, text = '1.3b' WHERE id = 'q1'`)
	exec(t, s, change.ActorPSet, "", `UPDATE questions SET difficulty = 2 WHERE id = 'q1'`)
	if _, err := s.Undo(bg, "rank", "u3"); !is(err, RewrittenSince) {
		t.Fatalf("undoing what PSet re-ranked: %v", err)
	}
	// A value-less PSet change to the same thing does not block an undo
	// whose values still stand.
	exec(t, s, change.ActorStudent, "boxes", `UPDATE finds SET boxes = '[]' WHERE id = 'f1'`)
	exec(t, s, change.ActorPSet, "", `UPDATE finds SET statement = '[["Find y."]]' WHERE id = 'f1'`)
	if _, err := s.Undo(bg, "boxes", "u2"); err != nil {
		t.Fatalf("undoing a boxing PSet only re-read around: %v", err)
	}
}

func TestRemovingASetIsOneRowAndComesBack(t *testing.T) {
	s := open(t)
	seed(t, s)
	was := snapshot(t, s)
	exec(t, s, change.ActorStudent, "rm", `UPDATE sets SET removed_at = '`+db.Now()+`' WHERE id = 's1'`)
	if n := count(t, s, `SELECT count(*) FROM changes WHERE action_id = 'rm'`); n != 1 {
		t.Fatalf("removing a set logged %d rows, want 1 (its questions hide with it)", n)
	}
	if _, err := s.Undo(bg, "rm", "u"); err != nil {
		t.Fatal(err)
	}
	if d := diff(was, snapshot(t, s)); len(d) > 0 {
		t.Fatalf("restored set differs: %v", d)
	}
	var op string
	must(t, s.DB.QueryRow(`SELECT op FROM changes WHERE action_id = 'u'`).Scan(&op))
	if op != "restored" {
		t.Fatalf("undoing a removal logged %q", op)
	}
}

func TestUndoingAnAddRemovesIt(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "add", `INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q3', 's1', 2, '1.5', 'now')`)
	if _, err := s.Undo(bg, "add", "u"); err != nil {
		t.Fatal(err)
	}
	var removed string
	must(t, s.DB.QueryRow(`SELECT removed_at FROM questions WHERE id = 'q3'`).Scan(&removed))
	if removed == "" {
		t.Fatal("undoing an add left the question in place")
	}
	// A problem added with its reading, and a find made by boxing, come
	// off whole.
	exec(t, s, change.ActorStudent, "box",
		`INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q4', 's1', 3, '1.6', 'now')`,
		`INSERT INTO readings (id, question_id) VALUES ('r4', 'q4')`,
		`INSERT INTO finds (id, question_id, material_id, page) VALUES ('f4', 'q4', 'm1', 1)`)
	if _, err := s.Undo(bg, "box", "u2"); err != nil {
		t.Fatalf("undoing an add with its reading and find: %v", err)
	}
	if n := count(t, s, `SELECT count(*) FROM questions q JOIN readings r ON r.question_id = q.id JOIN finds f ON f.question_id = q.id
		WHERE q.id = 'q4' AND q.removed_at != '' AND r.removed_at != '' AND f.removed_at != ''`); n != 1 {
		t.Fatal("undoing the add left part of it")
	}
}

func TestAQuestionsChangeEchoesToItsSet(t *testing.T) {
	s := open(t)
	seed(t, s)
	setSeq := count(t, s, `SELECT seq FROM sets WHERE id = 's1'`)
	exec(t, s, change.ActorStudent, "done", `UPDATE questions SET done_at = 'now' WHERE id = 'q1'`)
	var echoes int
	must(t, s.DB.QueryRow(`SELECT count(*) FROM changes WHERE kind = 'set' AND res_id = 's1' AND echo = 1 AND action_id = 'done'`).Scan(&echoes))
	if echoes != 1 || count(t, s, `SELECT seq FROM sets WHERE id = 's1'`) <= setSeq {
		t.Fatalf("marking done: %d echoes, set seq %d after %d", echoes, count(t, s, `SELECT seq FROM sets WHERE id = 's1'`), setSeq)
	}
	// Editing its text changes nothing the set counts.
	exec(t, s, change.ActorStudent, "text", `UPDATE questions SET text = '1.3a' WHERE id = 'q1'`)
	if n := count(t, s, `SELECT count(*) FROM changes WHERE action_id = 'text' AND echo = 1`); n != 0 {
		t.Fatalf("a text edit echoed %d times", n)
	}
	if _, err := s.Undo(bg, "text", "u1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Undo(bg, "done", "u2"); err != nil {
		t.Fatalf("undoing done past its echo: %v", err)
	}
	if n := count(t, s, `SELECT count(*) FROM changes WHERE action_id = 'u2' AND echo = 1`); n != 1 {
		t.Fatalf("undoing done echoed %d times, want 1", n)
	}
}

func TestSinceCollapsesAndSaysWhatToPatch(t *testing.T) {
	s := open(t)
	mark := seed(t, s)
	for i := range 4 {
		exec(t, s, change.ActorStudent, fmt.Sprintf("n%d", i), fmt.Sprintf(`UPDATE questions SET notes = '[["note %d"]]' WHERE id = 'q1'`, i))
	}
	exec(t, s, change.ActorStudent, "done", `UPDATE questions SET done_at = 'now' WHERE id = 'q2'`)
	exec(t, s, change.ActorPSet, "", `UPDATE documents SET state = 'writing' WHERE id = 'd1'`)
	exec(t, s, change.ActorStudent, "t", `UPDATE sets SET title = 'PS 4' WHERE id = 's1'`)

	cs, err := s.Since(bg, mark, 100)
	must(t, err)
	got := map[string]change.Change{}
	var order []string
	for _, c := range cs {
		got[string(c.Kind)+":"+c.ID] = c
		order = append(order, string(c.Kind)+":"+c.ID)
	}
	if strings.Join(order, " ") != "question:q1 question:q2 document:d1 set:s1" {
		t.Fatalf("notices %v", order)
	}
	q1 := got["question:q1"]
	if string(q1.After) != `{"notes":[["note 3"]]}` || q1.Action != "n3" || q1.CourseID != "c1" || q1.SetID != "s1" {
		t.Fatalf("q1 %+v after %s", q1, q1.After)
	}
	if q2 := got["question:q2"]; string(q2.After) != `{"done":true}` {
		t.Fatalf("q2 after %s, want done true", q2.After)
	}
	if d := got["document:d1"]; d.After != nil || d.Action != "" || d.Actor != change.ActorPSet {
		t.Fatalf("PSet's document change %+v: the page reads it again", d)
	}
	// The set had an echo from q2's done and then a title: one notice,
	// read again, since the echo carries no values.
	if st := got["set:s1"]; st.After != nil || st.Op != change.OpChanged {
		t.Fatalf("set %+v after %s", st, st.After)
	}
	if more, err := s.Since(bg, cs[len(cs)-1].Seq, 100); err != nil || len(more) != 0 {
		t.Fatalf("after the last notice: %v %v", more, err)
	}
}

func TestSinceSaysResyncWhenTheLogNoLongerReaches(t *testing.T) {
	s := open(t)
	seed(t, s)
	latest, err := s.Latest(bg)
	must(t, err)
	if _, err := s.Since(bg, latest+5, 10); !errors.Is(err, ErrResync) {
		t.Fatalf("a seq from another database: %v", err)
	}
	must(t, s.Purge(bg, time.Now().Add(Keep+time.Hour)))
	if n := count(t, s, `SELECT count(*) FROM changes`); n != 0 {
		t.Fatalf("%d log rows older than a week left", n)
	}
	if _, err := s.Since(bg, 1, 10); !errors.Is(err, ErrResync) {
		t.Fatalf("a seq the purge took: %v", err)
	}
	if cs, err := s.Since(bg, latest, 10); err != nil || len(cs) != 0 {
		t.Fatalf("a page up to date: %v %v", cs, err)
	}
	// seq keeps rising past the purge.
	exec(t, s, change.ActorStudent, "after", `UPDATE sets SET title = 'later' WHERE id = 's1'`)
	cs, err := s.Since(bg, latest, 10)
	must(t, err)
	if len(cs) != 1 || cs[0].Seq <= latest {
		t.Fatalf("after the purge: %+v", cs)
	}
}

func TestPurgeKeepsAWeekAndWhatIsStillUsed(t *testing.T) {
	s := open(t)
	seed(t, s)
	old := db.At(time.Now().Add(-Keep - time.Hour))
	exec(t, s, change.ActorStudent, "rm",
		`UPDATE materials SET removed_at = '`+old+`' WHERE id = 'm1'`,
		`UPDATE questions SET removed_at = '`+old+`' WHERE id = 'q2'`,
		`UPDATE memories SET removed_at = '`+db.Now()+`' WHERE id = 'y1'`)
	must(t, s.Purge(bg, time.Now()))
	if count(t, s, `SELECT count(*) FROM materials WHERE id = 'm1'`) != 1 || count(t, s, `SELECT count(*) FROM pages`) != 2 {
		t.Fatal("a removed material a find still uses was purged")
	}
	if count(t, s, `SELECT count(*) FROM questions WHERE id = 'q2'`) != 0 {
		t.Fatal("a question removed over a week ago was kept")
	}
	if count(t, s, `SELECT count(*) FROM memories WHERE id = 'y1'`) != 1 {
		t.Fatal("a memory removed today was purged")
	}
	if n := count(t, s, `SELECT count(*) FROM changes WHERE kind = 'question' AND res_id = 'q2'`); n != 0 {
		t.Fatalf("%d log rows of a purged question kept: they hold its text", n)
	}
	// Once nothing uses the material, it goes, its pages with it.
	exec(t, s, change.ActorStudent, "rm2", `UPDATE sets SET removed_at = '`+old+`' WHERE id = 's1'`)
	must(t, s.Purge(bg, time.Now()))
	if count(t, s, `SELECT count(*) FROM materials`)+count(t, s, `SELECT count(*) FROM pages`)+count(t, s, `SELECT count(*) FROM finds`) != 0 {
		t.Fatal("a removed material nothing uses was kept")
	}
	if count(t, s, `SELECT count(*) FROM documents WHERE id = 'd1'`) != 0 {
		t.Fatal("the guide of a purged question was kept")
	}
	if count(t, s, `SELECT count(*) FROM change_ctx`) != 0 {
		t.Fatal("the purge left its context behind")
	}
}

func TestWritesOnManyConnectionsAreAttributedRight(t *testing.T) {
	s := open(t)
	mark := seed(t, s)
	s.DB.SetMaxOpenConns(8)
	var wg sync.WaitGroup
	for w := range 6 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range 15 {
				who, action := change.ActorStudent, fmt.Sprintf("w%d-%d", w, i)
				if i%3 == 0 {
					who, action = change.ActorPSet, ""
				}
				err := s.Write(bg, who, action, func(tx *sql.Tx) error {
					_, err := tx.Exec(`UPDATE questions SET label = ? WHERE id = 'q1'`, action+fmt.Sprint(w, i))
					return err
				})
				if err != nil {
					t.Error(err)
				}
			}
		}()
	}
	// Stray writes alongside: every one refused.
	for range 10 {
		if _, err := s.DB.Exec(`UPDATE questions SET label = 'stray' WHERE id = 'q2'`); err == nil {
			t.Error("a stray write went through")
		}
	}
	wg.Wait()
	if n := count(t, s, `SELECT count(*) FROM changes WHERE seq > ? AND actor = 'student' AND kind = 'question' AND res_id = 'q1' AND after LIKE '%"label":"' || action_id || '%'`, mark); n != 60 {
		t.Fatalf("%d of 60 student writes attributed to their own action", n)
	}
	if n := count(t, s, `SELECT count(*) FROM changes WHERE seq > ? AND actor = 'pset' AND kind = 'question' AND res_id = 'q1' AND action_id = ''`, mark); n != 30 {
		t.Fatalf("%d of 30 PSet writes logged as PSet's", n)
	}
}

// read is the stream's next "data:" line, with its id if it had one.
func read(t *testing.T, sc *bufio.Scanner) (string, Event) {
	t.Helper()
	id := ""
	for sc.Scan() {
		line := sc.Text()
		switch {
		case strings.HasPrefix(line, "id: "):
			id = strings.TrimPrefix(line, "id: ")
		case strings.HasPrefix(line, "data: "):
			var e Event
			must(t, json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &e))
			return id, e
		}
	}
	t.Fatalf("stream ended: %v", sc.Err())
	return "", Event{}
}

func TestTheStreamReplaysThenFollows(t *testing.T) {
	s := open(t)
	mark := seed(t, s)
	exec(t, s, change.ActorStudent, "t1", `UPDATE sets SET title = 'missed' WHERE id = 's1'`)
	srv := httptest.NewServer(http.HandlerFunc(s.Handler))
	defer srv.Close()

	req, err := http.NewRequest("GET", srv.URL, nil)
	must(t, err)
	req.Header.Set("Last-Event-ID", fmt.Sprint(mark))
	res, err := http.DefaultClient.Do(req)
	must(t, err)
	defer cleanup.Close(res.Body)
	sc := bufio.NewScanner(res.Body)

	id, e := read(t, sc)
	var c change.Change
	must(t, json.Unmarshal(e.Data, &c))
	if e.Type != change.EventChange || c.ID != "s1" || id != fmt.Sprint(c.Seq) || string(c.After) != `{"title":"missed"}` {
		t.Fatalf("replayed %s %s %+v", id, e.Type, c)
	}
	exec(t, s, change.ActorStudent, "t2", `UPDATE sets SET title = 'live' WHERE id = 's1'`)
	_, e = read(t, sc)
	must(t, json.Unmarshal(e.Data, &c))
	if c.Action != "t2" || string(c.After) != `{"title":"live"}` {
		t.Fatalf("followed %+v", c)
	}
	s.Publish(change.EventStepActivity, change.StepActivity{StepID: "st1", Label: "Reading page 142"})
	id, e = read(t, sc)
	if id != "" || e.Type != change.EventStepActivity {
		t.Fatalf("an unlogged event came as %q %s", id, e.Type)
	}
}

func TestTheStreamSaysResyncToAPageFromBeforeThePurge(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "x", `UPDATE sets SET title = 'x' WHERE id = 's1'`)
	must(t, s.Purge(bg, time.Now().Add(Keep+time.Hour)))
	srv := httptest.NewServer(http.HandlerFunc(s.Handler))
	defer srv.Close()
	res, err := http.Get(srv.URL + "?after=1")
	must(t, err)
	defer cleanup.Close(res.Body)
	id, e := read(t, bufio.NewScanner(res.Body))
	latest, _ := s.Latest(bg)
	if e.Type != change.EventResync || id != fmt.Sprint(latest) {
		t.Fatalf("got %s %s, want resync at %d", id, e.Type, latest)
	}
}

func TestAnActionThatWritesAValueTwiceUndoes(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "swap",
		`UPDATE sets SET title = 'B' WHERE id = 's1'`,
		`UPDATE sets SET title = 'C' WHERE id = 's1'`)
	if _, err := s.Undo(bg, "swap", "u"); err != nil || title(t, s) != "Problem set 4" {
		t.Fatalf("undo: %v, title %q", err, title(t, s))
	}
}

func TestCtrlZAfterARedoTakesTheRedoBack(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "A", `UPDATE sets SET title = 'Y' WHERE id = 's1'`)
	exec(t, s, change.ActorStudent, "B", `UPDATE sets SET title = 'Z' WHERE id = 's1'`)
	_, err := s.Undo(bg, "B", "uB")
	must(t, err)
	if n, _ := s.Newest(bg); n != "A" {
		t.Fatalf("after undo, Ctrl+Z takes %q, want A", n)
	}
	_, err = s.Undo(bg, "uB", "redoB")
	must(t, err)
	if n, _ := s.Newest(bg); n != "redoB" {
		t.Fatalf("after redo, Ctrl+Z takes %q, want the redo", n)
	}
	_, err = s.Undo(bg, "redoB", "uu")
	must(t, err)
	if title(t, s) != "Y" {
		t.Fatalf("undoing the redo left %q", title(t, s))
	}
	// Undo, redo, undo: Ctrl+Z goes on back to A, never toggling B.
	if n, _ := s.Newest(bg); n != "A" {
		t.Fatalf("after undo, redo, undo, Ctrl+Z takes %q, want A", n)
	}
}

func TestARedoneChangeIsTheStudentsInTheRefusal(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "P", `UPDATE questions SET notes = '["x"]' WHERE id = 'q1'`)
	exec(t, s, change.ActorStudent, "Q", `UPDATE questions SET notes = '["y"]' WHERE id = 'q1'`)
	for _, u := range [][2]string{{"Q", "uQ"}, {"uQ", "rQ"}} {
		_, err := s.Undo(bg, u[0], u[1])
		must(t, err)
	}
	if _, err := s.Undo(bg, "P", "uP"); !is(err, ChangedSince) {
		t.Fatalf("undoing P under a redone Q: %v, want changed since", err)
	}
}

func TestARedoneRemovalGetsAFreshWeek(t *testing.T) {
	s := open(t)
	seed(t, s)
	old := db.At(time.Now().Add(-6 * 24 * time.Hour))
	exec(t, s, change.ActorStudent, "rm", `UPDATE sets SET removed_at = '`+old+`' WHERE id = 's1'`)
	for _, u := range [][2]string{{"rm", "u"}, {"u", "redo"}} {
		_, err := s.Undo(bg, u[0], u[1])
		must(t, err)
	}
	must(t, s.Purge(bg, time.Now().Add(2*24*time.Hour)))
	if count(t, s, `SELECT count(*) FROM sets WHERE id = 's1' AND removed_at != ''`) != 1 {
		t.Fatal("a set removed again by a redo was purged on its first removal's date")
	}
}

func TestUndoingAnAddIgnoresWhatPSetWroteToIt(t *testing.T) {
	s := open(t)
	seed(t, s)
	exec(t, s, change.ActorStudent, "add", `INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q5', 's1', 4, '2.1', 'now')`)
	exec(t, s, change.ActorPSet, "", `UPDATE questions SET label = '2.1 #3' WHERE id = 'q5'`)
	if _, err := s.Undo(bg, "add", "u"); err != nil {
		t.Fatalf("undoing an add PSet labelled since: %v", err)
	}
}

func TestAThingMadeAndChangedInOneBatchIsNew(t *testing.T) {
	s := open(t)
	mark := seed(t, s)
	exec(t, s, change.ActorStudent, "add", `INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q6', 's1', 5, '2.2', 'now')`)
	exec(t, s, change.ActorStudent, "edit", `UPDATE questions SET text = '2.2b' WHERE id = 'q6'`)
	cs, err := s.Since(bg, mark, 100)
	must(t, err)
	for _, c := range cs {
		if c.ID == "q6" && (c.Op != change.OpCreated || c.After != nil) {
			t.Fatalf("q6 arrived as %s with %s, want created, read again", c.Op, c.After)
		}
	}
}

func TestOnlyTheStoreIsThePurge(t *testing.T) {
	s := open(t)
	seed(t, s)
	err := s.Write(bg, change.Actor("purge"), "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`DELETE FROM memories`)
		return err
	})
	if err == nil || count(t, s, `SELECT count(*) FROM memories`) != 1 {
		t.Fatalf("a caller wrote as the purge: %v", err)
	}
	err = s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET id = 's9' WHERE id = 's1'`)
		return err
	})
	if err == nil {
		t.Fatal("an id changed")
	}
}

func TestEveryTableAddsAndRemovesAndUndoes(t *testing.T) {
	s := open(t)
	seed(t, s)
	for _, tb := range Tables {
		if tb.Removed == "" {
			continue
		}
		was := snapshot(t, s)
		exec(t, s, change.ActorStudent, "rm-"+tb.Name, `UPDATE `+tb.Name+` SET removed_at = 'now' WHERE id = '`+ids[tb.Name]+`'`)
		var op string
		must(t, s.DB.QueryRow(`SELECT op FROM changes WHERE action_id = ? AND echo = 0`, "rm-"+tb.Name).Scan(&op))
		if op != "removed" {
			t.Errorf("%s: removing logged %q", tb.Name, op)
		}
		_, err := s.Undo(bg, "rm-"+tb.Name, "u-"+tb.Name)
		must(t, err)
		if d := diff(was, snapshot(t, s)); len(d) > 0 {
			t.Errorf("%s: restored differs: %v", tb.Name, d)
		}
	}
	// Adding: a copy of the seeded row under a new id, then undone.
	for _, tb := range Tables {
		if tb.Removed == "" {
			continue
		}
		id := ids[tb.Name] + "-new"
		var names, exprs []string
		for c := range columns(t, s, tb.Name) {
			if c == "id" {
				continue
			}
			names = append(names, c)
			if c == "question_id" { // one find and one reading a question
				exprs = append(exprs, "'q2'")
			} else {
				exprs = append(exprs, c)
			}
		}
		exec(t, s, change.ActorStudent, "add-"+tb.Name, fmt.Sprintf(`INSERT INTO %s (id, %s) SELECT '%s', %s FROM %s WHERE id = '%s'`,
			tb.Name, strings.Join(names, ", "), id, strings.Join(exprs, ", "), tb.Name, ids[tb.Name]))
		var op string
		must(t, s.DB.QueryRow(`SELECT op FROM changes WHERE action_id = ? AND echo = 0`, "add-"+tb.Name).Scan(&op))
		if op != "created" {
			t.Errorf("%s: adding logged %q", tb.Name, op)
		}
		_, err := s.Undo(bg, "add-"+tb.Name, "u-add-"+tb.Name)
		must(t, err)
		var removed string
		must(t, s.DB.QueryRow(`SELECT removed_at FROM `+tb.Name+` WHERE id = ?`, id).Scan(&removed))
		if removed == "" {
			t.Errorf("%s: undoing an add left it in place", tb.Name)
		}
	}
}

func TestSinceSplitsAcrossBatchesAndTheStreamFollowsThem(t *testing.T) {
	s := open(t)
	mark := seed(t, s)
	for i := range 7 {
		exec(t, s, change.ActorStudent, fmt.Sprintf("b%d", i), fmt.Sprintf(`UPDATE sets SET title = 'T%d' WHERE id = 's1'`, i))
	}
	// Three rows a batch: the set comes in three notices, each newer.
	var got []string
	at := mark
	for {
		cs, err := s.Since(bg, at, 3)
		must(t, err)
		if len(cs) == 0 {
			break
		}
		for _, c := range cs {
			got = append(got, string(c.After))
			at = c.Seq
		}
	}
	if len(got) != 3 || got[2] != `{"title":"T6"}` {
		t.Fatalf("batches %v", got)
	}
	replayBatch = 2
	defer func() { replayBatch = 1000 }()
	srv := httptest.NewServer(http.HandlerFunc(s.Handler))
	defer srv.Close()
	res, err := http.Get(srv.URL + "?after=" + fmt.Sprint(mark))
	must(t, err)
	defer cleanup.Close(res.Body)
	sc := bufio.NewScanner(res.Body)
	var last change.Change
	for last.Action != "b6" {
		_, e := read(t, sc)
		must(t, json.Unmarshal(e.Data, &last))
	}
}

func TestAPageThatReadAnEmptyLibraryMissesNothing(t *testing.T) {
	s := open(t)
	srv := httptest.NewServer(http.HandlerFunc(s.Handler))
	defer srv.Close()
	seed(t, s) // written after the page's read, before it connects
	res, err := http.Get(srv.URL + "?after=0")
	must(t, err)
	defer cleanup.Close(res.Body)
	_, e := read(t, bufio.NewScanner(res.Body))
	var c change.Change
	must(t, json.Unmarshal(e.Data, &c))
	if e.Type != change.EventChange || c.Kind != change.ResourceCourse {
		t.Fatalf("first event %s %+v, want the course", e.Type, c)
	}
}

func TestPurgeTakesARemovedCourseWholeAndKeepsOpenIncidents(t *testing.T) {
	s := open(t)
	seed(t, s)
	old := db.At(time.Now().Add(-Keep - time.Hour))
	exec(t, s, change.ActorPSet, "",
		`INSERT INTO incidents (id, error, kind, born, first_at, last_at, state, resolved_at) VALUES ('OLD001', '{}', 'ours', 'step', 'x', 'x', 'healed', '`+old+`')`,
		`INSERT INTO incidents (id, error, kind, born, first_at, last_at, state, resolved_at) VALUES ('NEW001', '{}', 'ours', 'step', 'x', 'x', 'healed', '`+db.Now()+`')`)
	exec(t, s, change.ActorStudent, "rm", `UPDATE courses SET removed_at = '`+old+`' WHERE id = 'c1'`)
	must(t, s.Purge(bg, time.Now()))
	for _, name := range []string{"courses", "materials", "pages", "sections", "sets", "questions", "finds", "readings", "documents", "turns", "memories"} {
		if n := count(t, s, `SELECT count(*) FROM `+name); n != 0 {
			t.Errorf("%d rows of %s outlived their course", n, name)
		}
	}
	if count(t, s, `SELECT count(*) FROM incidents WHERE id IN ('INC001', 'NEW001')`) != 2 || count(t, s, `SELECT count(*) FROM incidents WHERE id = 'OLD001'`) != 0 {
		t.Error("the purge kept a week-old resolved incident or took an open or recent one")
	}
	if n := count(t, s, `SELECT count(*) FROM changes WHERE kind NOT IN ('incident', 'condition')`); n != 0 {
		t.Errorf("%d log rows of purged things kept", n)
	}
}
