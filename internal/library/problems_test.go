package library

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/probnum"
)

// Detection never writes over what the student confirmed, and fills in
// books from before styles.
func TestProblemStylesKeepTheStudentsWord(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(ctx, d, append(jobs.Migrations(), Migrations()...)); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Exec(`INSERT INTO books (id, sha256, title, page_count, state, created_at, updated_at) VALUES ('b', 'b', 'T', 3, 'ready', '', '')`); err != nil {
		t.Fatal(err)
	}
	// No contents and no problems: nothing to go on, so the style is
	// unknown and the student is asked.
	if err := fillProblems(ctx, d); err != nil {
		t.Fatal(err)
	}
	b, _ := getBook(ctx, d, "b")
	if b.Problems == nil || b.Problems.Form != "" {
		t.Fatalf("style %+v, want an unknown one", b.Problems)
	}

	mine, err := patchProblems(b.Problems, ProblemsPatch{Form: probnum.FormLocal, Where: probnum.WhereChapter})
	if err != nil || !mine.Confirmed || mine.Where != probnum.WhereChapter {
		t.Fatalf("patched %+v %v", mine, err)
	}
	if err := saveProblems(ctx, d, "b", mine); err != nil {
		t.Fatal(err)
	}
	if err := saveProblems(ctx, d, "b", probnum.Style{Form: probnum.FormChapter, Sure: true}); err != nil {
		t.Fatal(err)
	}
	if b, _ := getBook(ctx, d, "b"); b.Problems.Form != probnum.FormLocal {
		t.Fatalf("detection wrote over the student: %+v", b.Problems)
	}
	if _, err := patchProblems(nil, ProblemsPatch{Form: "roman", Where: probnum.WhereSection}); err == nil {
		t.Fatal("took a form that doesn't exist")
	}
}

// A chapter's unnumbered "Problems" entries in the contents say where its
// problems are; a section's go to the section, not its chapter.
func TestPartsKnowWhereTheirProblemsAre(t *testing.T) {
	parts := partsOf([]section{
		{Level: 2, Title: "Chapter 3 Methods of Analysis", StartPage: 105, EndPage: 150},
		{Level: 3, Title: "3.1 Introduction", StartPage: 106, EndPage: 107},
		{Level: 3, Title: "Problems", StartPage: 138, EndPage: 149},
		{Level: 2, Title: "Chapter 4 Circuit Theorems", StartPage: 151, EndPage: 198},
		{Level: 3, Title: "Problems", StartPage: 186, EndPage: 196},
		{Level: 3, Title: "Comprehensive Problems", StartPage: 197, EndPage: 198},
		{Level: 2, Title: "Chapter 5 Operational Amplifiers", StartPage: 199, EndPage: 238},
		{Level: 3, Title: "5.1 Introduction", StartPage: 199, EndPage: 200},
		{Level: 3, Title: "5.2 Operational Amplifiers", StartPage: 201, EndPage: 230},
		{Level: 4, Title: "Problems", StartPage: 226, EndPage: 230},
		{Level: 3, Title: "Review Questions", StartPage: 231, EndPage: 231},
	})
	want := map[string][2]int{"3": {138, 149}, "3.1": {0, 0}, "4": {186, 198}, "5": {0, 0}, "5.2": {226, 230}}
	for _, p := range parts {
		if w, ok := want[p.Number]; ok && (p.ProblemsStart != w[0] || p.ProblemsEnd != w[1]) {
			t.Errorf("%s: problems %d to %d, want %d to %d", p.Number, p.ProblemsStart, p.ProblemsEnd, w[0], w[1])
		}
	}
	if len(parts) != 6 {
		t.Errorf("%d parts, want the 6 numbered ones", len(parts))
	}
}
