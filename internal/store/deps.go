package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/errs"
)

// The dependency map (ideas/dependencies-grill.md, D1): every link between
// things, declared once. Visibility, the purge and what a removal takes with
// it are generated from it, and a test walks it against the schema, so a new
// table can't forget a rule.

// LinkKind is how a child depends on what it names.
type LinkKind int

const (
	// Owns means the child lives inside its parent. It is hidden while the parent
	// is (D2), and purged with it.
	Owns LinkKind = iota
	// Refers means the child points at something it does not own. The target keeps
	// resolving for it once removed (D3), and is not purged while it does
	// (D4).
	Refers
)

// Link is one link: the rows of Table (things of kind Child) name a Parent
// by Column. A child owned by one of several kinds (a document by a question
// or a turn) has a link per owner kind, each with KindColumn and its value.
type Link struct {
	Child, Parent change.Resource
	Table, Column string
	KindColumn    string
	Kind          LinkKind
}

// Links is the map. Owned rows that are not things on the change log
// (pages, sections, embeddings, calls, study) go with their owner by a
// cascading foreign key and need no entry; the walk test checks those keys
// (rowsOwned).
var Links = []Link{
	{Child: change.ResourceMaterial, Parent: change.ResourceCourse, Table: "materials", Column: "course_id"},
	{Child: change.ResourceSet, Parent: change.ResourceCourse, Table: "sets", Column: "course_id"},
	{Child: change.ResourceTurn, Parent: change.ResourceCourse, Table: "turns", Column: "course_id"},
	{Child: change.ResourceMemory, Parent: change.ResourceCourse, Table: "memories", Column: "course_id"},
	{Child: change.ResourceQuestion, Parent: change.ResourceSet, Table: "questions", Column: "set_id"},
	{Child: change.ResourceFind, Parent: change.ResourceQuestion, Table: "finds", Column: "question_id"},
	{Child: change.ResourceReading, Parent: change.ResourceQuestion, Table: "readings", Column: "question_id"},
	{Child: change.ResourceDocument, Parent: change.ResourceQuestion, Table: "documents", Column: "owner_id", KindColumn: "owner_kind"},
	{Child: change.ResourceDocument, Parent: change.ResourceTurn, Table: "documents", Column: "owner_id", KindColumn: "owner_kind"},

	{Child: change.ResourceFind, Parent: change.ResourceMaterial, Table: "finds", Column: "material_id", Kind: Refers},
	{Child: change.ResourceFind, Parent: change.ResourceFind, Table: "finds", Column: "earlier_id", Kind: Refers},
	{Child: change.ResourceSet, Parent: change.ResourceMaterial, Table: "sets", Column: "sheet_id", Kind: Refers},
	{Child: change.ResourceTurn, Parent: change.ResourceDocument, Table: "turns", Column: "answer_id", Kind: Refers},
}

// nameOf is each kind's table name.
func nameOf(k change.Resource) string {
	t, ok := tableOf(string(k))
	if !ok {
		panic("store: no table for " + string(k))
	}
	return t.Name
}

// removable says whether the student can remove a kind's things.
func removable(k change.Resource) bool {
	t, ok := tableOf(string(k))
	return ok && t.Removed != ""
}

// owners is the owns-links of a kind: its parents.
func owners(k change.Resource) []Link {
	var out []Link
	for _, l := range Links {
		if l.Child == k && l.Kind == Owns {
			out = append(out, l)
		}
	}
	return out
}

// Visible is SQL true while the thing of kind k with the id idExpr is there
// and neither it nor any of its owners is removed (D2): the one rule every
// read of "what the student can see" and the runner's "what may run" use.
// idExpr is SQL (a column or a placeholder) evaluated outside.
func Visible(k change.Resource, idExpr string) string {
	return visible(k, idExpr, 0)
}

func visible(k change.Resource, idExpr string, depth int) string {
	a := fmt.Sprintf("v%d", depth)
	conds := []string{fmt.Sprintf("%s.id = %s", a, idExpr)}
	if removable(k) {
		conds = append(conds, a+".removed_at = ''")
	}
	var branches []string
	for _, l := range owners(k) {
		up := visible(l.Parent, a+"."+l.Column, depth+1)
		if l.KindColumn != "" {
			up = fmt.Sprintf("(%s.%s = '%s' AND %s)", a, l.KindColumn, l.Parent, up)
		}
		branches = append(branches, up)
	}
	if len(branches) > 0 {
		conds = append(conds, "("+strings.Join(branches, " OR ")+")")
	}
	return fmt.Sprintf("EXISTS (SELECT 1 FROM %s %s WHERE %s)", nameOf(k), a, strings.Join(conds, " AND "))
}

// VisibleSubject is Visible for a thing named by a kind and an id, both SQL
// (a step's subject_kind and subject_id): true for a kind not in the map.
func VisibleSubject(kindExpr, idExpr string, kinds ...change.Resource) string {
	var b strings.Builder
	b.WriteString("CASE " + kindExpr)
	for _, k := range kinds {
		fmt.Fprintf(&b, " WHEN '%s' THEN %s", k, Visible(k, idExpr))
	}
	b.WriteString(" ELSE 1 END")
	return b.String()
}

// ancestor is SQL giving the id of the owner of kind up of the thing of kind
// k with the id idExpr, or NULL when it has none of that kind; idExpr itself
// when k is up.
func ancestor(k change.Resource, idExpr string, up change.Resource, depth int) string {
	if k == up {
		return idExpr
	}
	var branches []string
	for _, l := range owners(k) {
		a := fmt.Sprintf("a%d", depth)
		parent := fmt.Sprintf("(SELECT %s.%s FROM %s %s WHERE %s.id = %s", a, l.Column, l.Table, a, a, idExpr)
		if l.KindColumn != "" {
			parent += fmt.Sprintf(" AND %s.%s = '%s'", a, l.KindColumn, l.Parent)
		}
		parent += ")"
		if next := ancestor(l.Parent, parent, up, depth+1); next != "" {
			branches = append(branches, next)
		}
	}
	switch len(branches) {
	case 0:
		return ""
	case 1:
		return branches[0]
	}
	return "COALESCE(" + strings.Join(branches, ", ") + ")"
}

// referenced is SQL true while anything outside the subtree of the thing of
// kind k with the id idExpr refers to it or to one of its owned descendants:
// what keeps a removed thing from being purged (D4). A reference from inside
// the subtree goes with it, so it does not count.
func referenced(k change.Resource, idExpr string) string {
	var out []string
	for i, l := range Links {
		if l.Kind != Refers {
			continue
		}
		target := ancestor(l.Parent, fmt.Sprintf("r%d.%s", i, l.Column), k, 0)
		if target == "" {
			continue // what it refers to is never inside k's subtree
		}
		cond := fmt.Sprintf("%s = %s", target, idExpr)
		if inside := ancestor(l.Child, fmt.Sprintf("r%d.id", i), k, 0); inside != "" {
			cond += fmt.Sprintf(" AND COALESCE(%s, '') != %s", inside, idExpr)
		}
		out = append(out, fmt.Sprintf("EXISTS (SELECT 1 FROM %s r%d WHERE r%d.%s != '' AND %s)", l.Table, i, i, l.Column, cond))
	}
	if len(out) == 0 {
		return "0"
	}
	return "(" + strings.Join(out, " OR ") + ")"
}

// HiddenBy is the kind of the nearest owner that hides the thing of kind k
// with the id, while the thing itself is not removed: its set, or its
// course; "" when none does (D6: Undo says "its set is still removed").
func (s *Store) HiddenBy(ctx context.Context, k change.Resource, id string) (change.Resource, error) {
	t, ok := tableOf(string(k))
	if !ok {
		return "", nil
	}
	// A thing removed itself (a removal redone) is not hidden by an owner:
	// it is removed, and says so on its own.
	if t.Removed != "" {
		var own int
		if err := s.DB.QueryRowContext(ctx, fmt.Sprintf(`SELECT count(*) FROM %s WHERE id = ? AND %s != ''`, t.Name, t.Removed), id).Scan(&own); err != nil {
			return "", errs.Database.Wrap(err)
		}
		if own > 0 {
			return "", nil
		}
	}
	for _, h := range hiddenBy(k, "?") {
		var hidden bool
		if err := s.DB.QueryRowContext(ctx, `SELECT `+h.SQL, id).Scan(&hidden); err != nil {
			return "", errs.Database.Wrap(err)
		}
		if hidden {
			return h.Kind, nil
		}
	}
	return "", nil
}

// Count is how many things of a kind.
type Count struct {
	Kind change.Resource
	N    int
}

// Owned counts what the thing of kind k with the id owns directly and is not
// removed on its own: what a removal takes with it, for its notice ("and its
// 12 problems"). Kinds with none are left out.
func (s *Store) Owned(ctx context.Context, k change.Resource, id string) ([]Count, error) {
	var out []Count
	for _, l := range Links {
		if l.Kind != Owns || l.Parent != k || !removable(l.Child) {
			continue
		}
		q := fmt.Sprintf(`SELECT count(*) FROM %s WHERE %s = ? AND removed_at = ''`, l.Table, l.Column)
		if l.KindColumn != "" {
			q += fmt.Sprintf(" AND %s = '%s'", l.KindColumn, k)
		}
		var n int
		if err := s.DB.QueryRowContext(ctx, q, id).Scan(&n); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if n > 0 {
			out = append(out, Count{Kind: l.Child, N: n})
		}
	}
	return out, nil
}

// hiddenBy is, for each removable owner up the thing's chain (nearest first),
// SQL true when that owner is removed.
func hiddenBy(k change.Resource, idExpr string) []struct {
	Kind change.Resource
	SQL  string
} {
	var out []struct {
		Kind change.Resource
		SQL  string
	}
	// Breadth first, so the nearest owner comes first whichever branch it is
	// on (a turn's document: the turn before the course).
	seen := map[change.Resource]bool{}
	for level := []change.Resource{k}; len(level) > 0; {
		var next []change.Resource
		for _, c := range level {
			for _, l := range owners(c) {
				if seen[l.Parent] {
					continue
				}
				seen[l.Parent] = true
				next = append(next, l.Parent)
				if removable(l.Parent) {
					id := ancestor(k, idExpr, l.Parent, 0)
					out = append(out, struct {
						Kind change.Resource
						SQL  string
					}{l.Parent, fmt.Sprintf("EXISTS (SELECT 1 FROM %s h WHERE h.id = %s AND h.removed_at != '')", nameOf(l.Parent), id)})
				}
			}
		}
		level = next
	}
	return out
}
