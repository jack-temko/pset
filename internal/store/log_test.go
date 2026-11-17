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
	exec(t, s, change.ActorPSet, "", `UPDATE sets SET course_id = course_id WHERE id = 's1'`)

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
	if _, err := s.Undo(bg, "fix", "u"); !is(err, ChangedSince) {
		t.Fatalf("undoing a correction PSet read over: %v", err)
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
	// What cannot be hidden cannot be un-added.
	exec(t, s, change.ActorStudent, "box", `INSERT INTO finds (id, question_id, material_id, page) VALUES ('f2', 'q2', 'm1', 1)`)
	if _, err := s.Undo(bg, "box", "u2"); !is(err, RewrittenSince) {
		t.Fatalf("undoing a find's creation: %v", err)
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
