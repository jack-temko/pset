package usage

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
)

// A failed call keeps the catalog id of its cause beside the provider's text.
func TestAFailedCallKeepsItsCause(t *testing.T) {
	d := newDB(t)
	Sink(d)(llm.Call{At: "2026-09-29T10:00:00Z", SubjectType: SubjectQuestion, SubjectID: "q1", Model: "m", Error: "model request failed (HTTP 402)", ErrorID: "key.out_of_credit"})
	var id string
	if err := d.QueryRow(`SELECT error_id FROM calls`).Scan(&id); err != nil || id != "key.out_of_credit" {
		t.Fatalf("error_id %q (%v)", id, err)
	}
}

// Calls that failed before get the entry their status named.
func TestOldFailedCallsGetTheirCause(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(d)
	migs := Migrations()
	if err := db.Migrate(ctx, d, migs[:3]); err != nil {
		t.Fatal(err)
	}
	for i, e := range []string{
		"model request failed (HTTP 402)", "model request failed (HTTP 401)", "model request failed (HTTP 404)",
		"model request failed (HTTP 503)", "model request failed (HTTP 400)", "model request failed: dial tcp: refused",
		"the model's stream was cut off: eof", "who knows",
	} {
		if _, err := d.ExecContext(ctx, `INSERT INTO calls (at, subject_type, subject_id, model, ms, error) VALUES ('', 'question', ?, 'm', 1, ?)`, i, e); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := d.ExecContext(ctx, `INSERT INTO calls (at, subject_type, subject_id, model, ms) VALUES ('', 'question', 'ok', 'm', 1)`); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx, d, migs); err != nil {
		t.Fatal(err)
	}
	var got []string
	rows, err := d.QueryContext(ctx, `SELECT coalesce(error_id, '-') FROM calls ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(rows)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		got = append(got, id)
	}
	want := []string{"key.out_of_credit", "key.refused", "model.unknown", "model.busy", "model.rejected", "model.unreachable", "model.cut", "internal.unexpected", "-"}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("call %d: %q, want %q", i, got[i], want[i])
		}
	}
}
