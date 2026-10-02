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
