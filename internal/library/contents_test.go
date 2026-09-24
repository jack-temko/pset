package library

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/llm/llmtest"
)

// kettleBook is a scanned book's recognized text: two front pages (a title
// page with the preface below it, then a note to the student), the
// printed contents on PDF 3, then printed pages 1 to 16 from PDF 4. The
// scan lost printed page 5, so the offset is 3 before it and 2 after.
// Pages carry running heads (the page number at the outer end), headings
// that open mid-page, an exercise, plot noise, and one OCR slip in a
// heading ("Fami1ies").
func kettleBook(withContents bool) []string {
	pages := []string{
		"A PRIMER OF\nKETTLE WORK\nH. Marlowe Voss\nOdile Prane\nPreface\nThis book is about engineered thunder and the people who make it.",
		"To the Student\nRead the chapters in order; the problems build on each other.",
	}
	if withContents {
		pages = append(pages, strings.Join([]string{
			"Contents",
			"1 Kettles 1",
			"1.1 Collars 1",
			"1.2 Gavels 4",
			"2 Storms 7",
			"2.1 StormFamilies 7",
			"2.2 Karsts 11",
			"2.3 Silverpoint 12",
			"Answers to Problems 13",
			"Index 15",
		}, "\n"))
	}
	type start struct {
		at     int
		number string
		title  string
	}
	chapters := []start{{1, "1", "Kettles"}, {7, "2", "Storms"}}
	sections := []start{{1, "1.1", "Collars"}, {4, "1.2", "Gavels"}, {7, "2.1", "Storm Families"}, {11, "2.2", "Karsts"}, {13, "", "Answers to Problems"}, {15, "", "Index"}}
	current := func(list []start, n int) start {
		var s start
		for _, x := range list {
			if x.at <= n {
				s = x
			}
		}
		return s
	}
	for n := 1; n <= 16; n++ {
		if n == 5 {
			continue
		}
		var lines []string
		ch, sec := current(chapters, n), current(sections, n-1)
		switch {
		case ch.at == n:
			lines = append(lines, "CHAPTER "+ch.number, ch.title)
		case n%2 == 0 && sec.number == "":
			lines = append(lines, fmt.Sprintf("%d %s", n, sec.title))
		case n%2 == 0:
			lines = append(lines, fmt.Sprintf("%d CHAPTER %s %s", n, ch.number, ch.title))
		default:
			lines = append(lines, strings.TrimSpace(fmt.Sprintf("%s %s %d", sec.number, sec.title, n)))
		}
		lines = append(lines, "Words about the subject fill this page, line after line.")
		if s := current(sections, n); s.at == n {
			title := strings.TrimSpace(s.number + " " + s.title)
			lines = append(lines, strings.ReplaceAll(title, "Families", "Fami1ies"))
		}
		lines = append(lines, "More words follow the heading and carry on.", "3. y' = 3 - 2y", "AAAA\\\\ |")
		pages = append(pages, strings.Join(lines, "\n"))
	}
	return pages
}

// kettleEntries is the printed contents as the model reads it: spacing
// fixed ("Storm Families"), and 2.3 isn't in the scan at all.
var kettleEntries = []contentsEntry{
	{Number: "1", Title: "Kettles", Page: 1, Level: 1},
	{Number: "1.1", Title: "Collars", Page: 1, Level: 2},
	{Number: "1.2", Title: "Gavels", Page: 4, Level: 2},
	{Number: "2", Title: "Storms", Page: 7, Level: 1},
	{Number: "2.1", Title: "Storm Families", Page: 7, Level: 2},
	{Number: "2.2", Title: "Karsts", Page: 11, Level: 2},
	{Number: "2.3", Title: "Silverpoint", Page: 12, Level: 2},
	{Title: "Answers to Problems", Page: 13, Level: 1},
	{Title: "Index", Page: 15, Level: 1},
}

// kettlePlaced is where they belong: PDF = printed + 3 up to printed 4,
// printed + 2 after, and 2.3 placed by its neighbour 2.2.
var kettlePlaced = []section{
	{Level: 1, Title: "1 Kettles", StartPage: 4},
	{Level: 2, Title: "1.1 Collars", StartPage: 4},
	{Level: 2, Title: "1.2 Gavels", StartPage: 7},
	{Level: 1, Title: "2 Storms", StartPage: 9},
	{Level: 2, Title: "2.1 Storm Families", StartPage: 9},
	{Level: 2, Title: "2.2 Karsts", StartPage: 13},
	{Level: 2, Title: "2.3 Silverpoint", StartPage: 14},
	{Level: 1, Title: "Answers to Problems", StartPage: 15},
	{Level: 1, Title: "Index", StartPage: 17},
}

func TestFindContentsPages(t *testing.T) {
	if got := findContentsPages(kettleBook(true)); !slices.Equal(got, []int{3}) {
		t.Fatalf("contents pages %v, want [3]", got)
	}
	if got := findContentsPages(kettleBook(false)); len(got) != 0 {
		t.Fatalf("a book without contents found %v", got)
	}
}

func TestPlaceEntries(t *testing.T) {
	secs, ok := placeEntries(kettleEntries, kettleBook(true), []int{3})
	if !ok {
		t.Fatal("the book's own contents didn't check out")
	}
	if !slices.Equal(secs, kettlePlaced) {
		t.Fatalf("placed\n%v\nwant\n%v", secs, kettlePlaced)
	}
}

func TestAppendixInsideAChapterIsASection(t *testing.T) {
	entries := append([]contentsEntry{}, kettleEntries[:3]...)
	entries = append(entries, contentsEntry{Number: "A", Title: "Appendix", Page: 4, Level: 1})
	entries = append(entries, kettleEntries[3:]...)
	entries = append(entries, contentsEntry{Number: "B", Title: "Appendix", Page: 15, Level: 1})
	secs, ok := placeEntries(entries, kettleBook(true), []int{3})
	if !ok {
		t.Fatal("didn't check out")
	}
	levels := map[string]int{}
	for _, s := range secs {
		levels[s.Title] = s.Level
	}
	if levels["Appendix A"] != 2 || levels["Appendix B"] != 1 {
		t.Fatalf("levels %v", levels)
	}
}

func TestPlaceEntriesRejectsAnotherBooksContents(t *testing.T) {
	other := []contentsEntry{
		{Number: "1", Title: "Vector Spaces", Page: 1},
		{Number: "2", Title: "Finite-Dimensional Spaces", Page: 4},
		{Number: "3", Title: "Linear Maps", Page: 7},
		{Number: "4", Title: "Polynomials", Page: 11},
		{Title: "Index", Page: 15},
	}
	if secs, ok := placeEntries(other, kettleBook(true), []int{3}); ok {
		t.Fatalf("another book's contents checked out: %v", secs)
	}
}

func TestHeadingCandidates(t *testing.T) {
	var texts []string
	for _, c := range headingCandidates(kettleBook(true), nil, []int{3}) {
		if c.Page == 3 {
			t.Errorf("a contents line is a candidate: %+v", c)
		}
		if strings.Contains(c.Text, "=") {
			t.Errorf("an equation is a candidate: %+v", c)
		}
		texts = append(texts, c.Text)
	}
	// Numbering kept; running heads lose their page numbers and merge
	// with the heading they repeat.
	for _, want := range []string{"1.1 Collars", "1.2 Gavels", "2.2 Karsts", "CHAPTER 1 Kettles"} {
		if n := countOf(texts, want); n != 1 {
			t.Errorf("%q appears %d times in %q", want, n, texts)
		}
	}
}

func countOf(list []string, s string) int {
	n := 0
	for _, x := range list {
		if x == s {
			n++
		}
	}
	return n
}

func TestEntryLevelAndTitle(t *testing.T) {
	for _, c := range []struct {
		e     contentsEntry
		level int
		title string
	}{
		{contentsEntry{Number: "3", Title: "Linear Maps", Level: 2}, 1, "3 Linear Maps"},
		{contentsEntry{Number: "3.2.1", Title: "Kernels"}, 3, "3.2.1 Kernels"},
		{contentsEntry{Number: "A.", Title: "Appendix A: Sets"}, 1, "Appendix A: Sets"},
		{contentsEntry{Number: "A.1", Title: "Finite Sets"}, 2, "A.1 Finite Sets"},
		{contentsEntry{Number: "B", Title: "APPENDIX"}, 1, "Appendix B"},
		{contentsEntry{Number: "C", Title: "Appendix Derivation of the Wave Equation"}, 1, "Appendix C Derivation of the Wave Equation"},
		{contentsEntry{Title: "Index", Level: 0}, 1, "Index"},
		{contentsEntry{Title: "Glossary", Level: 1}, 1, "Glossary"},
	} {
		if got := entryLevel(c.e); got != c.level {
			t.Errorf("level(%+v) = %d, want %d", c.e, got, c.level)
		}
		if got := numberedTitle(c.e.Number, c.e.Title); got != c.title {
			t.Errorf("title(%+v) = %q, want %q", c.e, got, c.title)
		}
	}
}

func TestFuzzyContains(t *testing.T) {
	for _, c := range []struct {
		text, pat string
		k         int
		want      bool
	}{
		{"xxstormfamiliesxx", "stormfamilies", 0, true},
		{"xxstormfami1iesxx", "stormfamilies", 1, true},
		{"xxstormfami11esxx", "stormfamilies", 1, false},
		{"xxstormfamlliesxx", "stormfamilies", 1, true},
		{"karst", "karsts", 0, false},
	} {
		if got := fuzzyContains(c.text, c.pat, c.k); got != c.want {
			t.Errorf("fuzzyContains(%q, %q, %d) = %v", c.text, c.pat, c.k, got)
		}
	}
}

// ---------------------------------------------------------------- import

func (e *env) useBook(pages []string) {
	e.setOCR(func(p int) (string, error) { return pages[p-1], nil })
}

// noName is the naming call's answer when a test isn't about the name.
var noName = llmtest.Reply{Text: "{}"}

func entriesReply(t *testing.T, entries []contentsEntry) llmtest.Reply {
	t.Helper()
	b, err := json.Marshal(map[string]any{"entries": entries})
	if err != nil {
		t.Fatal(err)
	}
	return llmtest.Reply{Text: "```json\n" + string(b) + "\n```"}
}

func TestScannedBookContentsFromThePrintedContents(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	e.useBook(pages)
	e.llm.Script(noName, entriesReply(t, kettleEntries))
	var up BookChanged
	e.upload(t, "kettles.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)

	var c Contents
	e.do(t, "GET", "/api/books/"+b.ID+"/contents", nil, &c)
	var got []string
	for _, ch := range c.Chapters {
		got = append(got, fmt.Sprintf("%s@%d", ch.Title, ch.Page))
		for _, s := range ch.Sections {
			got = append(got, fmt.Sprintf("  %s@%d", s.Title, s.Page))
		}
	}
	want := []string{
		"1 Kettles@4", "  1.1 Collars@4", "  1.2 Gavels@7",
		"2 Storms@9", "  2.1 Storm Families@9", "  2.2 Karsts@13", "  2.3 Silverpoint@14",
		"Answers to Problems@15", "Index@17",
	}
	if !slices.Equal(got, want) {
		t.Fatalf("contents\n%s\nwant\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}

	// Two calls, naming then the contents, which shows the contents
	// page as an image.
	var chats []llmtest.Request
	for _, r := range e.llm.Requests() {
		if r.Path == "/chat/completions" {
			chats = append(chats, r)
		}
	}
	if len(chats) != 2 {
		t.Fatalf("%d chat calls, want 2", len(chats))
	}
	parts := chats[1].Chat.Messages[1].Content.Parts()
	if len(parts) != 3 || parts[2].Type != "image_url" {
		t.Fatalf("parts %+v", parts)
	}
	if !e.events.has(EventBookChanged, `"phase":"contents"`) {
		t.Fatal("no contents phase")
	}

	// Homework's chapter sweep reads the whole chapter.
	if start, end, ok, _ := e.svc.ChapterSpan(t.Context(), b.ID, 1); !ok || start != 4 || end != 8 {
		t.Fatalf("chapter 1 spans %d-%d %v", start, end, ok)
	}
}

func TestScannedBookWithoutContentsPagesHasTheModelPick(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(false)
	e.useBook(pages)
	cands := headingCandidates(pages, nil, nil)
	pick := func(text string, level int) map[string]int {
		for i, c := range cands {
			if c.Text == text {
				return map[string]int{"line": i + 1, "level": level}
			}
		}
		t.Fatalf("%q isn't a candidate", text)
		return nil
	}
	reply, _ := json.Marshal(map[string]any{"headings": []any{
		pick("CHAPTER 1", 1), pick("1.1 Collars", 2), pick("1.2 Gavels", 2),
		pick("CHAPTER 2", 1), pick("2.2 Karsts", 2),
		map[string]int{"line": 9999, "level": 1}, // not a line: ignored
	}})
	e.llm.Script(noName, llmtest.Reply{Text: string(reply)})
	var up BookChanged
	e.upload(t, "kettles.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)

	var c Contents
	e.do(t, "GET", "/api/books/"+b.ID+"/contents", nil, &c)
	if len(c.Chapters) != 2 || c.Chapters[0].Title != "CHAPTER 1" || c.Chapters[0].Page != 3 ||
		len(c.Chapters[0].Sections) != 2 || c.Chapters[1].Sections[0].Title != "2.2 Karsts" || c.Chapters[1].Sections[0].Page != 12 {
		t.Fatalf("contents %+v", c)
	}
	prompt := e.llm.Requests()[1].Chat.Messages[1].Content.Text()
	if !strings.Contains(prompt, "page 3 | 1.1 Collars") || strings.Contains(prompt, "y' =") {
		t.Fatalf("candidate list:\n%s", prompt)
	}
}

func TestScannedBookWithTooFewPicksHasNoRail(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(false)
	e.useBook(pages)
	e.llm.Script(noName, llmtest.Reply{Text: `{"headings":[{"line":1,"level":1}]}`})
	var up BookChanged
	e.upload(t, "kettles.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)
	var c Contents
	e.do(t, "GET", "/api/books/"+b.ID+"/contents", nil, &c)
	if len(c.Chapters) != 0 {
		t.Fatalf("contents %+v", c)
	}
}

func TestContentsModelFailureFailsTheImportThenRetries(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	var reads int
	e.setOCR(func(p int) (string, error) {
		e.mu.Lock()
		reads++
		e.mu.Unlock()
		return pages[p-1], nil
	})
	e.llm.Script(noName, llmtest.Reply{Status: 401, Text: `{"error":"bad key"}`})
	var up BookChanged
	e.upload(t, "kettles.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateFailed)
	if !strings.Contains(b.State.Reason, "HTTP 401") || !strings.Contains(b.State.Reason, "Settings") {
		t.Fatalf("reason %q", b.State.Reason)
	}

	// A reply that isn't JSON gets one more try, then fails too.
	e.llm.Script(noName, llmtest.Reply{Text: "Here are the contents!"}, llmtest.Reply{Text: "Sorry."})
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	b = e.waitFor(t, b.ID, StateFailed)
	if !strings.Contains(b.State.Reason, "couldn't be read") {
		t.Fatalf("reason %q", b.State.Reason)
	}

	// A stalled call gets one more try too.
	defer func(d time.Duration) { contentsCallTimeout = d }(contentsCallTimeout)
	contentsCallTimeout = 300 * time.Millisecond
	e.llm.Script(noName, llmtest.Reply{Text: "slow", Pause: time.Second}, entriesReply(t, kettleEntries))
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	e.waitFor(t, b.ID, StateReady)
	if reads != len(pages) {
		t.Fatalf("OCR ran %d times for %d pages: a retry read them again", reads, len(pages))
	}
}

func TestStripPageNumber(t *testing.T) {
	for _, c := range []struct {
		line    string
		printed int
		known   bool
		want    string
	}{
		{"24 CHAPTER 1 Introduction", 24, true, "CHAPTER 1 Introduction"},
		{"24 CHAPTER 1 Introduction", 23, true, "CHAPTER 1 Introduction"}, // the offset drifted
		{"1.3 Classification of Differential Equations 23", 22, true, "1.3 Classification of Differential Equations"},
		{"1 Introduction", 2, true, "1 Introduction"},
		{"CHAPTER 3", 3, true, "CHAPTER 3"},
		{"Section 2.3 Karsts 41", 0, false, "Section 2.3 Karsts"},
		{"41 Section 2.3 Karsts", 0, false, "41 Section 2.3 Karsts"},
		{"Karsts", 41, true, "Karsts"},
	} {
		if got := stripPageNumber(c.line, c.printed, c.known); got != c.want {
			t.Errorf("stripPageNumber(%q, %d, %v) = %q, want %q", c.line, c.printed, c.known, got, c.want)
		}
	}
}
