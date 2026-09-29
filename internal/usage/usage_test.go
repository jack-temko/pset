package usage

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
)

func newDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(context.Background(), d, Migrations()); err != nil {
		t.Fatal(err)
	}
	return d
}

func call(at, subjectType, subjectID, model, answered string, ms int64, usage *llm.Usage, errText string) llm.Call {
	return llm.Call{At: at, SubjectType: subjectType, SubjectID: subjectID, Model: model, Answered: answered, Ms: ms, Usage: usage, Error: errText}
}

// Every call is written once, with its subject and exactly what the
// provider said: a call with no usage has no tokens and no cost, and a
// call with no subject is kept with empty strings, not dropped.
func TestEveryCallIsWrittenOnce(t *testing.T) {
	d := newDB(t)
	sink := Sink(d)
	sink(call("2026-09-29T10:00:00Z", SubjectQuestion, "q1", "z-ai/perceptron-mk1.5", "z-ai/perceptron-mk1.5", 2100,
		&llm.Usage{PromptTokens: 9_000, CompletionTokens: 412, Cost: 0.0004}, ""))
	sink(call("2026-09-29T10:00:03Z", SubjectQuestion, "q1", "openai/gpt-6-luna", "openai/gpt-6-luna", 4000, nil, ""))
	sink(call("2026-09-29T10:00:07Z", "", "", "openai/gpt-6-luna", "", 100, nil, "the stream ended without finishing"))

	var n int
	if err := d.QueryRow(`SELECT count(*) FROM calls`).Scan(&n); err != nil || n != 3 {
		t.Fatalf("rows %d, err %v, want 3", n, err)
	}
	var subjectType, subjectID, answered, errText sql.NullString
	var ms int64
	if err := d.QueryRow(`SELECT subject_type, subject_id, answered, ms, error FROM calls WHERE at = ?`,
		"2026-09-29T10:00:03Z").Scan(&subjectType, &subjectID, &answered, &ms, &errText); err != nil {
		t.Fatal(err)
	}
	if subjectType.String != SubjectQuestion || subjectID.String != "q1" || answered.String != "openai/gpt-6-luna" || ms != 4000 {
		t.Fatalf("row (%s/%s answered %s ms %d)", subjectType.String, subjectID.String, answered.String, ms)
	}
	if errText.Valid {
		t.Fatalf("error %q on a call that had none", errText.String)
	}
	// A model that never answered is recorded under the one asked for,
	// with the error that says why.
	if err := d.QueryRow(`SELECT answered, error FROM calls WHERE at = ?`,
		"2026-09-29T10:00:07Z").Scan(&answered, &errText); err != nil {
		t.Fatal(err)
	}
	if answered.Valid || !errText.Valid {
		t.Fatalf("failed call: answered %v, error %v", answered, errText)
	}
}

// The aggregation is one row per answered model, sums across its calls,
// the total on top, and the failed calls counted.
func TestAggregationGroupsByAnsweredModelAndSums(t *testing.T) {
	d := newDB(t)
	sink := Sink(d)
	sink(call("a", SubjectQuestion, "q1", "openai/gpt-6-luna", "openai/gpt-6-luna", 1000,
		&llm.Usage{PromptTokens: 5_000, CompletionTokens: 500, Cost: 0.0002}, ""))
	sink(call("b", SubjectQuestion, "q1", "openai/gpt-6-luna", "openai/gpt-6-luna", 3000,
		&llm.Usage{PromptTokens: 10_000, CompletionTokens: 5_534, Cost: 0.0007}, ""))
	sink(call("c", SubjectQuestion, "q1", "deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash", 7_900,
		&llm.Usage{PromptTokens: 12_000, CompletionTokens: 6_554, Cost: 0.0018}, ""))
	// A call that never got an answer sits under the model asked for.
	sink(call("d", SubjectQuestion, "q1", "deepseek/deepseek-v4.1-flash", "", 500, nil, "model request failed (HTTP 429)"))
	// A model that reported no usage: time known, tokens and cost not.
	sink(call("e", SubjectQuestion, "q1", "local/qwen", "local/qwen", 9_300, nil, ""))
	// Another subject's calls don't belong to this one.
	sink(call("f", SubjectQuestion, "q2", "openai/gpt-6-luna", "openai/gpt-6-luna", 1_000,
		&llm.Usage{PromptTokens: 99_999, CompletionTokens: 99_999, Cost: 9}, ""))

	u, err := For(context.Background(), d, SubjectQuestion, "q1")
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("no usage")
	}
	if len(u.Rows) != 3 {
		t.Fatalf("rows %+v, want 3", u.Rows)
	}
	// Rows lead with the model that did the most of the work: gpt-6-luna
	// ran twice for 21,034 tokens, deepseek once (plus one call that
	// failed) for 18,554.
	first := u.Rows[0]
	if first.Model != "openai/gpt-6-luna" || first.Ms != 4_000 || first.Calls != 2 {
		t.Fatalf("first row %+v", first)
	}
	if first.Tokens == nil || *first.Tokens != 21_034 || first.Cost == nil || *first.Cost != 0.0009 {
		t.Fatalf("first row sums %+v", first)
	}
	second := u.Rows[1]
	if second.Model != "deepseek/deepseek-v4.1-flash" || second.Ms != 8_400 || second.Calls != 2 ||
		second.Tokens == nil || *second.Tokens != 18_554 {
		t.Fatalf("second row %+v", second)
	}
	var qwen *UsageRow
	for i := range u.Rows {
		if u.Rows[i].Model == "local/qwen" {
			qwen = &u.Rows[i]
		}
	}
	if qwen == nil || qwen.Tokens != nil || qwen.Cost != nil || qwen.Ms != 9_300 {
		t.Fatalf("the uncounted model %+v, want time only", qwen)
	}
	if u.Failed != 1 {
		t.Fatalf("failed %d, want 1", u.Failed)
	}
	if u.Total.Ms != 21_700 || u.Total.Calls != 5 || u.Total.Tokens == nil || *u.Total.Tokens != 39_588 {
		t.Fatalf("total %+v", u.Total)
	}
	want := 0.0002 + 0.0007 + 0.0018
	if u.Total.Cost == nil || *u.Total.Cost < want-1e-9 || *u.Total.Cost > want+1e-9 {
		t.Fatalf("total cost %v, want %v", u.Total.Cost, want)
	}

	// A subject with no calls reads as nil, and the frontend draws nothing.
	none, err := For(context.Background(), d, SubjectQuestion, "q-none")
	if err != nil || none != nil {
		t.Fatalf("empty subject %v, %v, want nil, nil", none, err)
	}
}

// A subject every one of whose calls failed still reads, with the failed
// count and no tokens where nothing was counted.
func TestACallThatAllFailedStillReads(t *testing.T) {
	d := newDB(t)
	sink := Sink(d)
	sink(call("a", SubjectRead, "r1", "openai/gpt-6-luna", "", 400, nil, "model request failed (HTTP 429)"))
	sink(call("b", SubjectRead, "r1", "openai/gpt-6-luna", "", 300, nil, "the stream ended without finishing"))

	u, err := For(context.Background(), d, SubjectRead, "r1")
	if err != nil {
		t.Fatal(err)
	}
	if u == nil || u.Failed != 2 || u.Total.Ms != 700 || u.Total.Calls != 2 {
		t.Fatalf("usage %+v", u)
	}
	if u.Rows[0].Tokens != nil || u.Rows[0].Cost != nil {
		t.Fatalf("failed calls' tokens %+v, want none", u.Rows[0])
	}
}

// ForSubjects is For over many subjects at once, each its own card.
func TestForSubjectsSplitsBySubject(t *testing.T) {
	d := newDB(t)
	sink := Sink(d)
	sink(call("a", SubjectTurn, "t1", "openai/gpt-6-luna", "openai/gpt-6-luna", 2_000,
		&llm.Usage{PromptTokens: 1_000, CompletionTokens: 100, Cost: 0.0003}, ""))
	sink(call("b", SubjectTurn, "t2", "openai/gpt-6-luna", "openai/gpt-6-luna", 3_000,
		&llm.Usage{PromptTokens: 2_000, CompletionTokens: 200, Cost: 0.0006}, ""))

	uses, err := ForSubjects(context.Background(), d, SubjectTurn, []string{"t1", "t2", "t3"})
	if err != nil {
		t.Fatal(err)
	}
	if len(uses) != 2 || uses["t1"].Total.Ms != 2_000 || uses["t2"].Total.Ms != 3_000 || uses["t3"] != nil {
		t.Fatalf("uses %+v", uses)
	}
}

// A subject's spending isn't kept after the thing it was spent on.
func TestForgetAllDeletesTheSubjectsRows(t *testing.T) {
	d := newDB(t)
	sink := Sink(d)
	sink(call("a", SubjectQuestion, "q1", "openai/gpt-6-luna", "openai/gpt-6-luna", 1_000,
		&llm.Usage{PromptTokens: 10, CompletionTokens: 10}, ""))
	sink(call("b", SubjectQuestion, "q2", "openai/gpt-6-luna", "openai/gpt-6-luna", 1_000,
		&llm.Usage{PromptTokens: 10, CompletionTokens: 10}, ""))
	ctx := context.Background()

	if err := ForgetAll(ctx, d, SubjectQuestion, []string{"q1"}); err != nil {
		t.Fatal(err)
	}
	u, err := For(ctx, d, SubjectQuestion, "q1")
	if err != nil || u != nil {
		t.Fatalf("q1 %v, %v, want nil, nil", u, err)
	}
	if u, _ = For(ctx, d, SubjectQuestion, "q2"); u == nil {
		t.Fatal("q2 lost its calls too")
	}
	if err := Forget(ctx, d, SubjectQuestion, "q2"); err != nil {
		t.Fatal(err)
	}
	var n int
	d.QueryRow(`SELECT count(*) FROM calls`).Scan(&n)
	if n != 0 {
		t.Fatalf("%d rows left", n)
	}
}
