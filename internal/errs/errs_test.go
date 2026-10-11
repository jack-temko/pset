package errs

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
)

func TestDefineRejectsBadAndDuplicateIDs(t *testing.T) {
	for _, id := range []string{"", "nodot", "Book.Upper", "a.b.", "a..b", "1a.b"} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("Define accepted id %q", id)
				}
			}()
			_ = Define(Entry{ID: id, What: "x."})
		}()
	}
	_ = Define(Entry{ID: "test.once", What: "Once."})
	defer func() {
		if recover() == nil {
			t.Error("Define accepted a duplicate id")
		}
	}()
	_ = Define(Entry{ID: "test.once", What: "Twice."})
}

var (
	deep = Define(Entry{
		ID: "test.deep", What: "The deep thing broke.", Why: "Deep reason for {who}.",
		Fix: "Deep fix.", Action: ActionOpenSettings, Status: 402,
	})
	mid = Define(Entry{ID: "test.mid", What: "The middle failed.", Status: 409})
	top = Define(Entry{ID: "test.top", What: "Couldn't do {thing}.", Scope: ScopeScreen})
)

func TestResolveComposesOuterWhatDeepestWhyAndFix(t *testing.T) {
	cause := deep.New("who", "Ada")
	err := fmt.Errorf("while saving: %w", top.Wrap(mid.Wrap(cause), "thing", "the work"))
	v := Resolve(err)
	if v.ID != "test.top" || v.What != "Couldn't do the work." {
		t.Errorf("what: %q %q", v.ID, v.What)
	}
	if v.Why != "Deep reason for Ada." || v.Fix != "Deep fix." || v.Action != ActionOpenSettings {
		t.Errorf("why/fix/action: %+v", v)
	}
	if v.Scope != ScopeScreen {
		t.Errorf("scope %q: the outermost entry's", v.Scope)
	}
	if got := strings.Join(v.Chain, " "); got != "test.top test.mid test.deep" {
		t.Errorf("chain %q", got)
	}
	// The status is the outermost entry that sets one.
	if v.Status != 409 {
		t.Errorf("status %d", v.Status)
	}
}

func TestResolveOfNoCatalogErrorIsUnexpected(t *testing.T) {
	v := Resolve(errors.New("disk on fire"))
	if v.ID != "internal.unexpected" || v.Status != 500 || len(v.Chain) != 1 {
		t.Errorf("%+v", v)
	}
	if v.What == "" || v.Fix == "" {
		t.Errorf("fallback has no words: %+v", v)
	}
}

func TestFieldAndRefTravelWithTheError(t *testing.T) {
	v := Resolve(mid.New().OnField("title").About("book-1"))
	if v.Field != "title" || v.Ref != "book-1" {
		t.Errorf("%+v", v)
	}
}

func TestIsAndAsWorkThroughWrap(t *testing.T) {
	root := errors.New("root")
	err := top.Wrap(mid.Wrap(root))
	if !errors.Is(err, root) || !errors.Is(err, mid) || !errors.Is(err, top) || errors.Is(err, deep) {
		t.Error("errors.Is through Wrap")
	}
	var e *Error
	if !errors.As(fmt.Errorf("x: %w", err), &e) || e.Entry() != top {
		t.Error("errors.As finds the outermost *Error")
	}
	if got := err.Error(); got != "test.top: test.mid: root" {
		t.Errorf("Error() = %q", got)
	}
}

func TestAnEntryReturnedBareIsInTheChain(t *testing.T) {
	v := Resolve(fmt.Errorf("while saving: %w", deep))
	if v.ID != "test.deep" || v.Fix != "Deep fix." {
		t.Errorf("%+v", v)
	}
}

func TestJoinedErrorsAreWalked(t *testing.T) {
	v := Resolve(errors.Join(errors.New("a"), deep.New("who", "x")))
	if v.ID != "test.deep" {
		t.Errorf("%+v", v)
	}
}

func TestStoredRebuildsTheSameView(t *testing.T) {
	v := Resolve(top.Wrap(deep.New("who", "Ada"), "thing", "it"))
	v.Incident = "ABC123"
	back := v.Stored().View()
	if back.What != v.What || back.Why != v.Why || back.Incident != "ABC123" {
		t.Errorf("%+v vs %+v", back, v)
	}
	gone := Stored{Chain: []string{"no.such_id"}}.View()
	if gone.ID != "internal.unexpected" {
		t.Errorf("unknown id: %+v", gone)
	}
}

func TestNewIncidentIsSixCrockfordCharacters(t *testing.T) {
	re := regexp.MustCompile(`^[0-9A-HJKMNP-TV-Z]{6}$`)
	for range 50 {
		if id := NewIncident(); !re.MatchString(id) {
			t.Fatalf("incident %q", id)
		}
	}
}

type memory struct{ got []Record }

func (m *memory) Record(_ context.Context, r Record) error {
	m.got = append(m.got, r)
	return nil
}

func TestReportKeepsFailuresButNotFieldErrors(t *testing.T) {
	m := &memory{}
	SetRecorder(m)
	t.Cleanup(func() { SetRecorder(nil) })
	v := Report(context.Background(), top.Wrap(errors.New("secret detail")), Where{Route: "GET /x", Book: "b1"})
	if v.Incident == "" || len(m.got) != 1 || m.got[0].Incident != v.Incident ||
		!strings.Contains(m.got[0].Detail, "secret detail") || m.got[0].Where.Book != "b1" {
		t.Errorf("failure: %+v %+v", v, m.got)
	}
	field := Define(Entry{ID: "test.field_one", What: "Fix this.", Scope: ScopeField})
	v = Report(context.Background(), field.New().OnField("name"), Where{})
	if v.Incident != "" || len(m.got) != 1 {
		t.Errorf("field error was kept: %+v", v)
	}
}

// Every entry's sentences are whole sentences with no em dash: the catalog is
// what a tired student reads.
func TestEntriesAreWrittenAsSentences(t *testing.T) {
	for _, e := range All() {
		if strings.HasPrefix(e.ID, "test.") {
			continue
		}
		for name, text := range map[string]string{"what": e.What, "why": e.Why, "fix": e.Fix} {
			if text == "" {
				if name == "what" {
					t.Errorf("%s has no what", e.ID)
				}
				continue
			}
			if !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "?") {
				t.Errorf("%s %s does not end in a period: %q", e.ID, name, text)
			}
			if strings.ContainsAny(text, "—–") {
				t.Errorf("%s %s has a dash: %q", e.ID, name, text)
			}
			if strings.Contains(text, "%") {
				t.Errorf("%s %s has a format verb: %q", e.ID, name, text)
			}
		}
	}
}
