package usage

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
)

// CallRow is one stored call, as the detail reads it.
type CallRow struct {
	ID                                            int64
	At, Stage, Run, Tools, Asked, Answered, Error string
	Ms                                            int64
	TokensIn, TokensOut, Reasoning, Cached        *int
	Cost                                          *float64
}

const callColumns = `id, at, coalesce(stage, ''), coalesce(run, ''), coalesce(tools, ''), model, coalesce(answered, ''), ms,
	prompt_tokens, completion_tokens, reasoning_tokens, cached_tokens, cost, coalesce(error, '')`

func scanCalls(rows *sql.Rows) ([]CallRow, error) {
	defer cleanup.Close(rows)
	var out []CallRow
	for rows.Next() {
		var c CallRow
		var in, outTok, reasoning, cached sql.NullInt64
		var cost sql.NullFloat64
		if err := rows.Scan(&c.ID, &c.At, &c.Stage, &c.Run, &c.Tools, &c.Asked, &c.Answered, &c.Ms, &in, &outTok, &reasoning, &cached, &cost, &c.Error); err != nil {
			return nil, err
		}
		c.TokensIn, c.TokensOut, c.Reasoning, c.Cached = nullInt(in), nullInt(outTok), nullInt(reasoning), nullInt(cached)
		if cost.Valid {
			v := cost.Float64
			c.Cost = &v
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func nullInt(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

// Calls is one subject's calls in the order they were made.
func Calls(ctx context.Context, q queryer, subjectType, subjectID string) ([]CallRow, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+callColumns+` FROM calls WHERE subject_type = ? AND subject_id = ? ORDER BY at, id`, subjectType, subjectID)
	if err != nil {
		return nil, err
	}
	return scanCalls(rows)
}

// Share is calls that were spent on n subjects together (a set's
// ranking), each taking an even 1/n of every figure. Calls stay whole in
// count: they are the share's own, not divided.
func Share(calls []CallRow, n int) []CallRow {
	if n <= 1 {
		return calls
	}
	out := make([]CallRow, len(calls))
	div := func(v *int) *int {
		if v == nil {
			return nil
		}
		x := *v / n
		return &x
	}
	for i, c := range calls {
		c.Ms /= int64(n)
		c.TokensIn, c.TokensOut, c.Reasoning, c.Cached = div(c.TokensIn), div(c.TokensOut), div(c.Reasoning), div(c.Cached)
		if c.Cost != nil {
			x := *c.Cost / float64(n)
			c.Cost = &x
		}
		out[i] = c
	}
	return out
}

// Build is a subject's detail from its own calls and, for a question, its
// share of its set's ranking (already divided by Share, n the set's size).
// It is nil when there is nothing to show.
func Build(own, shared []CallRow, n int) *Detail {
	if len(own) == 0 && len(shared) == 0 {
		return nil
	}
	d := &Detail{}
	type stageAcc struct {
		Stage
		runs map[string]bool
	}
	var order []string
	stages := map[string]*stageAcc{}
	var runOrder []string
	var sharedKey string
	runs := map[string]*Run{}
	add := func(rows []CallRow, shared bool, share int) {
		for _, c := range rows {
			name := c.Stage
			if name == "" {
				name = "Other"
			}
			st := stages[name]
			if st == nil {
				st = &stageAcc{Stage: Stage{Name: name}, runs: map[string]bool{}}
				if shared && share > 1 {
					st.Shared = share
				}
				stages[name] = st
				order = append(order, name)
			}
			st.runs[c.Run] = true
			st.Calls++
			st.Ms += c.Ms
			if c.Error != "" {
				st.Failed++
			}
			if c.TokensIn == nil {
				st.Uncounted++
			}
			st.TokensIn, st.TokensOut, st.Reasoning = addInt(st.TokensIn, c.TokensIn), addInt(st.TokensOut, c.TokensOut), addInt(st.Reasoning, c.Reasoning)
			st.Cost = addFloat(st.Cost, c.Cost)

			t := &d.Total
			t.Calls++
			t.Ms += c.Ms
			if c.Error != "" {
				t.Failed++
			}
			if c.TokensIn == nil {
				t.Uncounted++
			}
			t.TokensIn, t.TokensOut, t.Reasoning, t.Cached = addInt(t.TokensIn, c.TokensIn), addInt(t.TokensOut, c.TokensOut), addInt(t.Reasoning, c.Reasoning), addInt(t.Cached, c.Cached)
			t.Cost = addFloat(t.Cost, c.Cost)

			key := c.Run
			if shared {
				key = "\x00shared"
			}
			r := runs[key]
			if r == nil {
				r = &Run{}
				if share > 1 {
					r.Shared = share
				}
				runs[key] = r
				runOrder = append(runOrder, key)
				if shared {
					sharedKey = key
				}
			}
			r.Calls = append(r.Calls, Call{
				ID: c.ID, At: c.At, Stage: name, Tools: c.Tools, Asked: c.Asked, Answered: c.Answered, Ms: c.Ms,
				TokensIn: c.TokensIn, TokensOut: c.TokensOut, Reasoning: c.Reasoning, Cached: c.Cached, Cost: c.Cost, Error: c.Error,
			})
		}
	}
	add(own, false, 0)
	add(shared, true, n)
	for _, name := range order {
		st := stages[name]
		st.Attempts = len(st.runs)
		d.Stages = append(d.Stages, st.Stage)
	}
	// Runs are labelled in the order they began; the shared ranking last.
	num := 0
	for _, key := range runOrder {
		r := runs[key]
		switch {
		case key == sharedKey && r.Shared > 1:
			r.Label = fmt.Sprintf("Difficulty ranking, shared with %d questions", r.Shared)
		case key == sharedKey:
			r.Label = "Difficulty ranking"
		default:
			num++
			r.Label = fmt.Sprintf("Run %d", num)
		}
		d.Runs = append(d.Runs, *r)
	}
	if num == 1 {
		for i := range d.Runs {
			if d.Runs[i].Label == "Run 1" {
				d.Runs[i].Label = "Calls"
			}
		}
	}
	// The shared ranking last, whichever call came first.
	sort.SliceStable(d.Runs, func(i, j int) bool { return !isRanking(d.Runs[i].Label) && isRanking(d.Runs[j].Label) })
	return d
}

func addInt(sum, v *int) *int {
	if v == nil {
		return sum
	}
	if sum == nil {
		sum = new(int)
	}
	*sum += *v
	return sum
}

func addFloat(sum, v *float64) *float64 {
	if v == nil {
		return sum
	}
	if sum == nil {
		sum = new(float64)
	}
	*sum += *v
	return sum
}

// AddShare puts a set's ranking on a question's line, the same share the
// modal shows: the ranking's calls divided by Share, each model's part
// joining the rows, and the calls, failures and uncounted calls joining the
// total as the modal counts them. A question with no calls of its own keeps
// nil: it has nothing to show a share of.
func AddShare(u *Usage, rank []CallRow, n int) *Usage {
	if u == nil || len(rank) == 0 {
		return u
	}
	if u.Shape != nil {
		addSharedShape(u.Shape, u.stages, rank, n)
	}
	for _, c := range Share(rank, n) {
		who := c.Answered
		if who == "" {
			who = c.Asked
		}
		var tok *int
		if c.TokensIn != nil {
			t := *c.TokensIn
			if c.TokensOut != nil {
				t += *c.TokensOut
			}
			tok = &t
		}
		i := -1
		for j := range u.Rows {
			if u.Rows[j].Model == who {
				i = j
			}
		}
		if i < 0 {
			u.Rows = append(u.Rows, Row{Model: who})
			i = len(u.Rows) - 1
		}
		row := &u.Rows[i]
		row.Ms += c.Ms
		row.Calls++
		row.Tokens = addInt(row.Tokens, tok)
		row.Cost = addFloat(row.Cost, c.Cost)
		u.Total.Ms += c.Ms
		u.Total.Calls++
		u.Total.Tokens = addInt(u.Total.Tokens, tok)
		u.Total.Cost = addFloat(u.Total.Cost, c.Cost)
		if c.TokensIn == nil {
			row.Uncounted++
			u.Total.Uncounted++
		}
		if c.Error != "" {
			u.Failed++
		}
	}
	return u
}

// ForBook is what a book has cost: its questions' calls, its Ask turns'
// reads' and its import's, with the rankings of its sets counted once.
// Questions, turns and reads are the other features' tables; the join is
// by book id.
func ForBook(ctx context.Context, q queryer, bookID string) (*BookUsage, error) {
	out := &BookUsage{}
	kinds := []struct {
		kind, typ, from string
	}{
		{"questions", SubjectQuestion, `SELECT q.id FROM questions q JOIN homework h ON h.id = q.homework_id WHERE h.book_id = ?`},
		{"ranking", SubjectSet, `SELECT id FROM homework WHERE book_id = ?`},
		{"ask", SubjectTurn, `SELECT id FROM turns WHERE book_id = ?`},
		{"reads", SubjectRead, `SELECT id FROM assignment_reads WHERE book_id = ?`},
	}
	var all []CallRow
	for _, k := range kinds {
		rows, err := q.QueryContext(ctx, `SELECT `+callColumns+` FROM calls WHERE subject_type = ? AND subject_id IN (`+k.from+`) ORDER BY at, id`, k.typ, bookID)
		if err != nil {
			return nil, err
		}
		calls, err := scanCalls(rows)
		if err != nil {
			return nil, err
		}
		if len(calls) == 0 {
			continue
		}
		all = append(all, calls...)
		out.Kinds = append(out.Kinds, Kind{Kind: k.kind, Items: 0, Total: Build(calls, nil, 0).Total})
		items, err := countSubjects(ctx, q, k.typ, k.from, bookID)
		if err != nil {
			return nil, err
		}
		out.Kinds[len(out.Kinds)-1].Items = items
	}
	imp, err := Calls(ctx, q, SubjectBook, bookID)
	if err != nil {
		return nil, err
	}
	if len(imp) > 0 {
		all = append(all, imp...)
		d := Build(imp, nil, 0)
		out.Import = d
		out.Kinds = append(out.Kinds, Kind{Kind: "import", Items: 1, Total: d.Total})
	}
	if len(all) == 0 {
		return nil, nil
	}
	out.Total = Build(all, nil, 0).Total
	return out, nil
}

func countSubjects(ctx context.Context, q queryer, typ, from, bookID string) (int, error) {
	rows, err := q.QueryContext(ctx, `SELECT count(DISTINCT subject_id) FROM calls WHERE subject_type = ? AND subject_id IN (`+from+`)`, typ, bookID)
	if err != nil {
		return 0, err
	}
	defer cleanup.Close(rows)
	n := 0
	if rows.Next() {
		err = rows.Scan(&n)
	}
	return n, err
}

func isRanking(label string) bool { return strings.HasPrefix(label, "Difficulty ranking") }

// ShapeOf is the layout of a detail: see Shape.
func ShapeOf(d *Detail) Shape {
	sh := Shape{Sections: []ShapeSection{}}
	if d == nil {
		return sh
	}
	sh.Stages = len(d.Stages)
	for _, st := range d.Stages {
		if st.Shared > 0 {
			sh.StagesTall++
		}
	}
	for _, r := range d.Runs {
		sec := ShapeSection{Rows: len(r.Calls)}
		for _, c := range r.Calls {
			if c.Error != "" || c.Tools != "" {
				sec.Tall++
			}
		}
		sh.Sections = append(sh.Sections, sec)
	}
	return sh
}

// addSharedShape adds a set's ranking, shared with n questions, to a
// question's shape the way Build does: its stages after the question's own,
// its calls as the last table.
func addSharedShape(sh *Shape, own map[string]bool, rank []CallRow, n int) {
	stages := map[string]bool{}
	sec := ShapeSection{Rows: len(rank)}
	for _, c := range rank {
		name := c.Stage
		if name == "" {
			name = "Other"
		}
		// Build folds a ranking stage into an own stage of the same name.
		if !own[name] {
			stages[name] = true
		}
		if c.Error != "" || c.Tools != "" {
			sec.Tall++
		}
	}
	sh.Stages += len(stages)
	if n > 1 {
		sh.StagesTall += len(stages)
	}
	sh.Sections = append(sh.Sections, sec)
}

// shapes is every subject's shape in one query, for a list.
func shapes(ctx context.Context, q queryer, subjectType string, ids []string) (map[string]Shape, map[string]map[string]bool, error) {
	marks := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := []any{subjectType}
	for _, id := range ids {
		args = append(args, id)
	}
	rows, err := q.QueryContext(ctx, `SELECT subject_id, `+callColumns+` FROM calls WHERE subject_type = ? AND subject_id IN (`+marks+`) ORDER BY at, id`, args...)
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = rows.Close() }()
	by := map[string][]CallRow{}
	for rows.Next() {
		var id string
		var c CallRow
		var in, outTok, reasoning, cached sql.NullInt64
		var cost sql.NullFloat64
		if err := rows.Scan(&id, &c.ID, &c.At, &c.Stage, &c.Run, &c.Tools, &c.Asked, &c.Answered, &c.Ms, &in, &outTok, &reasoning, &cached, &cost, &c.Error); err != nil {
			return nil, nil, err
		}
		by[id] = append(by[id], c)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	out := make(map[string]Shape, len(by))
	names := make(map[string]map[string]bool, len(by))
	for id, calls := range by {
		d := Build(calls, nil, 0)
		out[id] = ShapeOf(d)
		names[id] = map[string]bool{}
		for _, st := range d.Stages {
			names[id][st.Name] = true
		}
	}
	return out, names, nil
}

// ForBookShapes is the layout of each book's usage dialog (BookShape), for
// the books asked about, in a handful of queries however many there are: one
// per kind of thing that spends, and one grouped count of the import's calls
// (a scanned book makes about one per page, so they are counted in SQL, never
// loaded). A book that spent nothing is not in the map. The same kinds
// ForBook lists, without their numbers.
func ForBookShapes(ctx context.Context, q queryer, ids []string) (map[string]*BookShape, error) {
	out := map[string]*BookShape{}
	if len(ids) == 0 {
		return out, nil
	}
	marks := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	in := func(typ string) []any {
		args := []any{typ}
		for _, id := range ids {
			args = append(args, id)
		}
		return args
	}
	of := func(id string) *BookShape {
		if out[id] == nil {
			out[id] = &BookShape{}
		}
		return out[id]
	}
	// Each kind of thing that spent anything, by the book it belongs to. Each
	// starts from the books asked about and seeks down their things by index
	// (homework_book, questions_homework, turns_book, assignment_reads_book),
	// then checks calls_subject for one call: never a scan of a kind's calls.
	kinds := []struct{ typ, query string }{
		{SubjectQuestion, `SELECT DISTINCT h.book_id FROM homework h JOIN questions q ON q.homework_id = h.id
			WHERE h.book_id IN (` + marks + `) AND EXISTS (SELECT 1 FROM calls c WHERE c.subject_type = ? AND c.subject_id = q.id)`},
		{SubjectSet, `SELECT DISTINCT h.book_id FROM homework h
			WHERE h.book_id IN (` + marks + `) AND EXISTS (SELECT 1 FROM calls c WHERE c.subject_type = ? AND c.subject_id = h.id)`},
		{SubjectTurn, `SELECT DISTINCT t.book_id FROM turns t
			WHERE t.book_id IN (` + marks + `) AND EXISTS (SELECT 1 FROM calls c WHERE c.subject_type = ? AND c.subject_id = t.id)`},
		{SubjectRead, `SELECT DISTINCT r.book_id FROM assignment_reads r
			WHERE r.book_id IN (` + marks + `) AND EXISTS (SELECT 1 FROM calls c WHERE c.subject_type = ? AND c.subject_id = r.id)`},
	}
	for _, k := range kinds {
		rows, err := q.QueryContext(ctx, k.query, append(idArgs(ids), k.typ)...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return nil, err
			}
			of(id).Kinds++
		}
		if err := rows.Err(); err != nil {
			_ = rows.Close()
			return nil, err
		}
		_ = rows.Close()
	}
	// The import: its stages, and its runs with the rows that take a second line.
	rows, err := q.QueryContext(ctx, `SELECT subject_id, coalesce(run, ''), coalesce(nullif(stage, ''), 'Other'), count(*),
			sum(coalesce(error, '') != '' OR coalesce(tools, '') != '')
		FROM calls WHERE subject_type = ? AND subject_id IN (`+marks+`)
		GROUP BY subject_id, run, 3 ORDER BY subject_id, min(at), min(id)`, in(SubjectBook)...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	type acc struct {
		stages map[string]bool
		runs   map[string]*ShapeSection
		order  []string
	}
	by := map[string]*acc{}
	for rows.Next() {
		var id, run, stage string
		var n, tall int
		if err := rows.Scan(&id, &run, &stage, &n, &tall); err != nil {
			return nil, err
		}
		a := by[id]
		if a == nil {
			a = &acc{stages: map[string]bool{}, runs: map[string]*ShapeSection{}}
			by[id] = a
		}
		a.stages[stage] = true
		sec := a.runs[run]
		if sec == nil {
			sec = &ShapeSection{}
			a.runs[run] = sec
			a.order = append(a.order, run)
		}
		sec.Rows += n
		sec.Tall += tall
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for id, a := range by {
		sh := Shape{Stages: len(a.stages), Sections: []ShapeSection{}}
		for _, run := range a.order {
			sh.Sections = append(sh.Sections, *a.runs[run])
		}
		b := of(id)
		b.Kinds++
		b.Import = &sh
	}
	return out, nil
}

func idArgs(ids []string) []any {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}
