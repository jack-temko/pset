package errlog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/testx"
)

var (
	outer = errs.Define(errs.Entry{ID: "test.outer", What: "Couldn't do {thing}.", Why: "Because.", Fix: "Fix it."})
	inner = errs.Define(errs.Entry{ID: "test.inner", What: "The inner broke.", Why: "Inner reason.", Fix: "Inner fix."})
)

func newStore(t *testing.T) (*Store, *sql.DB) {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(d) })
	testx.Check(t, db.Migrate(context.Background(), d, Migrations()))
	return New(d), d
}

func TestReportedErrorsAreKeptGroupedAndCleared(t *testing.T) {
	s, _ := newStore(t)
	errs.SetRecorder(s)
	t.Cleanup(func() { errs.SetRecorder(nil) })
	ctx := context.Background()

	v1 := errs.Report(ctx, outer.Wrap(inner.New(), "thing", "Calculus"), errs.Where{Route: "POST /api/books", Book: "b1"})
	v2 := errs.Report(ctx, outer.Wrap(inner.New(), "thing", "Statistics"), errs.Where{Route: "job import"})
	errs.Report(ctx, errors.New("disk on fire"), errs.Where{Route: "GET /x"})

	groups, err := s.List(ctx)
	testx.Check(t, err)
	if len(groups) != 2 {
		t.Fatalf("groups: %+v", groups)
	}
	g := groups[1]
	if g.ID != "test.outer" || g.Count != 2 || len(g.Incidents) != 2 {
		t.Fatalf("grouped by id: %+v", g)
	}
	if g.Incidents[0].Incident != v2.Incident || g.Incidents[0].What != "Couldn't do Statistics." {
		t.Errorf("newest first, with its own words: %+v", g.Incidents)
	}
	if g.Incidents[1].Incident != v1.Incident || len(g.Incidents[1].Chain) != 2 || g.Incidents[1].Detail == "" {
		t.Errorf("older incident: %+v", g.Incidents[1])
	}
	if groups[0].ID != "internal.unexpected" || groups[0].Incidents[0].Detail != "disk on fire" {
		t.Errorf("the fallback keeps the Go text: %+v", groups[0])
	}

	testx.Check(t, s.Clear(ctx))
	groups, err = s.List(ctx)
	testx.Check(t, err)
	if len(groups) != 0 {
		t.Errorf("after clear: %+v", groups)
	}
}

func TestRoutesListAndClear(t *testing.T) {
	s, _ := newStore(t)
	mux := http.NewServeMux()
	s.Routes(mux)
	testx.Check(t, s.Record(context.Background(), errs.Record{
		Incident: "ABC123", View: errs.Resolve(inner.New()), Detail: "inner", Where: errs.Where{Route: "x"},
	}))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/errors", nil))
	var got []Group
	testx.Check(t, json.NewDecoder(rec.Body).Decode(&got))
	if rec.Code != 200 || len(got) != 1 || got[0].Incidents[0].Incident != "ABC123" {
		t.Fatalf("%d %+v", rec.Code, got)
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("DELETE", "/api/errors", nil))
	if rec.Code != 204 {
		t.Errorf("clear answered %d", rec.Code)
	}
}
