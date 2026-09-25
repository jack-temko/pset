package homework

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/probnum"
)

// coursePage is a made-up lookalike of a course's homework page: a
// semester table, a row a lecture, whose problems are due on a later
// date shared by several rows, and a Word export's markup around it.
const coursePage = `<html><head><meta http-equiv=Content-Type content="text/html; charset=macintosh">
<title>EECS 211 Homework Assignments</title><style><!-- .MsoTitle {font-family:Times;} --></style></head>
<body><div class=Section1><blockquote><p class="style3">EECS 202 Homework Assignments</p>
<p class=MsoTitle>&nbsp;</p>
<table border="1"><tbody>
<tr><td width=90><p><b>Lecture Date</b></p></td><td><p><b>Reading Assignment</b></p></td>
<td><p><b>HW Due Date</b></p></td><td><p><b>HW Problems</b></p></td><td><p><b>Lecture Materials</b></p></td></tr>
<tr><td><p>M 8/24</p></td><td><p>4-19</p></td><td><p>8/28</p></td>
<td><p>1.1 , 1.6 ,
  1.9 (all on page 24)</p></td><td><p><a href="v.pdf">Vintage Circuits</a> , <a href="e.pdf">Early circuits</a></p></td></tr>
<tr><td><p>W8/26</p></td><td><p>30- 35</p></td><td><p>9/4</p></td><td><p>1.18 , 1.28</p></td><td>&nbsp;</td></tr>
<tr><td><p>M 8/31</p></td><td><p>44-51</p></td><td><p>9/4</p></td>
<td><p>2.21 , 2.35 , 2.23 (find power to the 12-Ohm resistor!)</p></td><td></td></tr>
<tr><td><p>W 9/16</p></td><td><p>147-148 , 137-146</p></td><td><p>9/25</p></td>
<td><p>4.27 , 4.32 , 4.25 (no PSpice or MulitSim)</p></td><td></td></tr>
</tbody></table></blockquote></div></body></html>`

func TestHTMLTextKeepsATableRowOnALine(t *testing.T) {
	got := htmlText(coursePage)
	for _, want := range []string{
		"EECS 202 Homework Assignments",
		"Lecture Date | Reading Assignment | HW Due Date | HW Problems | Lecture Materials",
		"M 8/24 | 4-19 | 8/28 | 1.1 , 1.6 , 1.9 (all on page 24) | Vintage Circuits , Early circuits",
		"W8/26 | 30- 35 | 9/4 | 1.18 , 1.28 |",
		"W 9/16 | 147-148 , 137-146 | 9/25 | 4.27 , 4.32 , 4.25 (no PSpice or MulitSim) |",
	} {
		if !slices.Contains(strings.Split(got, "\n"), want) {
			t.Errorf("no line %q in:\n%s", want, got)
		}
	}
	if strings.Contains(got, "MsoTitle") || strings.Contains(got, "EECS 211") {
		t.Errorf("the head came through:\n%s", got)
	}
}

// Lines as each of the three professors writes them, read in their
// book's numbering.
func TestReadLineInEachBooksNumbering(t *testing.T) {
	chapter := probnum.Style{Form: probnum.FormChapter, Where: probnum.WhereChapter}
	section := probnum.Style{Form: probnum.FormSection, Where: probnum.WhereSection}
	local := probnum.Style{Form: probnum.FormLocal, Where: probnum.WhereSection}
	for _, c := range []struct {
		text   string
		style  probnum.Style
		labels []string
		notes  []string
		unread bool
	}{
		{"1.1 , 1.6 , 1.9 (all on page 24)", chapter, []string{"1.1", "1.6", "1.9"}, nil, false},
		{"4.27 , 4.32 , 4.25 (no PSpice or MulitSim)", chapter, []string{"4.27", "4.32", "4.25"}, []string{"no PSpice or MulitSim"}, false},
		{"Problem 2.1.4, p. 57.", section, []string{"2.1.4"}, nil, false},
		{"Problem 2.3.4, p. 60. Express your answer in terms of p.", section, []string{"2.3.4"}, []string{"Express your answer in terms of p"}, false},
		{"2.1: 1, 7, 12", local, []string{"2.1 #1", "2.1 #7", "2.1 #12"}, nil, false},
		{"Section 3.1 #7 (do c, 6 pts each)", local, []string{"3.1 #7"}, []string{"do c"}, false},
		{"the one about the ladder", chapter, nil, nil, true},
	} {
		labels, notes, unread := readLine(c.text, c.style)
		if unread != c.unread {
			t.Errorf("%q: unread %v", c.text, unread)
			continue
		}
		if c.labels == nil {
			c.labels = []string{}
		}
		if c.notes == nil {
			c.notes = []string{}
		}
		if !slices.Equal(labels, c.labels) || !slices.Equal(notes, c.notes) {
			t.Errorf("%q: %q %q, want %q %q", c.text, labels, notes, c.labels, c.notes)
		}
	}
}

// pageReply is the fake model's reading of the course page: two due
// dates, every kind of line.
const pageReply = "```json\n" + `{"title": "EECS 202 Homework", "groups": [
	{"due": "2026-08-28", "title": "", "rows": [
		{"kind": "book", "text": "3.35 , 3.36 (all on page 24)"},
		{"kind": "other", "text": "Reading: pages 4-19"}]},
	{"due": "2026-09-04", "title": "Week 2", "rows": [
		{"kind": "book", "text": "3.36 (no PSpice)"},
		{"kind": "own", "text": "A 2 A source drives a 3 Ohm resistor. Find $V$."},
		{"kind": "book", "text": "the one about the ladder"},
		{"kind": "quiz", "text": "Quiz on Friday"},
		{"kind": "book", "text": "  "}]},
	{"due": "sometime", "title": "", "rows": []}]}` + "\n```"

// reader is a fake model for reading assignments: it answers with
// reply, and records what it was shown and how often it was asked.
type reader struct {
	mu    sync.Mutex
	reply string
	asked int
	got   []string
	// hold, when set, keeps it from answering until closed.
	hold chan struct{}
}

func (m *reader) answer(req llm.ChatRequest) llmtest.Reply {
	if !strings.Contains(req.Messages[0].Content.Text(), "You read a course's homework assignment") {
		return fakeModel(req)
	}
	if m.hold != nil {
		<-m.hold
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.asked++
	for _, p := range req.Messages[1].Content.Parts() {
		if p.ImageURL != nil {
			m.got = append(m.got, p.ImageURL.URL)
		}
		m.got = append(m.got, p.Text)
	}
	return llmtest.Reply{Text: m.reply}
}

func (m *reader) shown() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return strings.Join(m.got, "")
}

func newReader(e *env) *reader {
	m := &reader{reply: pageReply}
	e.llm.Fallback(m.answer)
	return m
}

// read starts reading and waits for it to finish.
func (e *env) read(t *testing.T, in AssignmentText) AssignmentRead {
	t.Helper()
	var r AssignmentRead
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", in, &r); code != 202 {
		t.Fatalf("read: %d", code)
	}
	return e.waitRead(t, r.ID)
}

func (e *env) waitRead(t *testing.T, id string) AssignmentRead {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	var r AssignmentRead
	for time.Now().Before(deadline) {
		e.do(t, "GET", "/api/assignment-reads/"+id, nil, &r)
		if r.State != ReadStateReading {
			return r
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("read %s still reading", id)
	return r
}

func TestReadingAnAssignmentFromAWebPage(t *testing.T) {
	e := newEnv(t)
	m := newReader(e)
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/202/hw.htm" {
			http.NotFound(w, r)
			return
		}
		fmt.Fprint(w, coursePage)
	}))
	defer page.Close()

	r := e.read(t, AssignmentText{URL: page.URL + "/202/hw.htm"})
	if r.State != ReadStateReady || r.Assignment == nil {
		t.Fatalf("read %+v", r)
	}
	if !strings.Contains(m.shown(), "M 8/24 | 4-19 | 8/28 | 1.1 , 1.6 , 1.9") {
		t.Fatalf("the model wasn't shown the table's rows: %q", m.shown())
	}
	a := *r.Assignment
	if a.Source != page.URL+"/202/hw.htm" || a.Title != "EECS 202 Homework" || len(a.Groups) != 2 {
		t.Fatalf("read %+v", a)
	}
	first, second := a.Groups[0], a.Groups[1]
	if first.Due != "2026-08-28" || first.Title != "Homework due Aug 28" || first.Imported {
		t.Fatalf("first group %+v", first)
	}
	if r := first.Rows[0]; r.Kind != RowKindBook || !slices.Equal(r.Labels, []string{"3.35", "3.36"}) || len(r.Notes) != 0 || r.Unread {
		t.Fatalf("book row %+v", r)
	}
	if first.Rows[1].Kind != RowKindOther {
		t.Fatalf("reading row %+v", first.Rows[1])
	}
	if second.Title != "Week 2" || len(second.Rows) != 4 {
		t.Fatalf("second group %+v", second)
	}
	if r := second.Rows[0]; !slices.Equal(r.Notes, []string{"no PSpice"}) {
		t.Fatalf("notes %+v", r)
	}
	if r := second.Rows[1]; r.Kind != RowKindOwn || len(r.Labels) != 0 {
		t.Fatalf("own row %+v", r)
	}
	if r := second.Rows[2]; !r.Unread {
		t.Fatalf("an unreadable reference read: %+v", r)
	}
	if r := second.Rows[3]; r.Kind != RowKindOther {
		t.Fatalf("an unknown kind stayed: %+v", r)
	}

	// It waits on the book's list, and says so as it changes.
	var list AssignmentReads
	if e.do(t, "GET", "/api/books/b1/assignments/reads", nil, &list); len(list.Reads) != 1 || list.Reads[0].ID != r.ID {
		t.Fatalf("reads %+v", list)
	}
	if !slices.ContainsFunc(e.events.all(), func(ev string) bool {
		return strings.HasPrefix(ev, EventReadChanged) && strings.Contains(ev, `"state":"ready"`)
	}) {
		t.Fatalf("no ready event: %v", e.events.all())
	}

	// A page that isn't there fails on the read, said plainly; one that
	// isn't a web page is refused before it starts.
	bad := e.read(t, AssignmentText{URL: page.URL + "/private"})
	if bad.State != ReadStateFailed || !strings.Contains(bad.Error, "404") {
		t.Fatalf("missing page: %+v", bad)
	}
	// Tried again, once the page is there, it reads.
	pageUp := page.Config.Handler
	page.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, coursePage) })
	var retried AssignmentRead
	if code := e.do(t, "POST", "/api/assignment-reads/"+bad.ID+"/retry", nil, &retried); code != 200 || retried.State != ReadStateReading {
		t.Fatalf("retry %d %+v", code, retried)
	}
	if again := e.waitRead(t, bad.ID); again.State != ReadStateReady || again.Error != "" {
		t.Fatalf("retried %+v", again)
	}
	page.Config.Handler = pageUp
	if code := e.do(t, "POST", "/api/assignment-reads/"+bad.ID+"/retry", nil, nil); code != 422 {
		t.Fatalf("retrying a ready read %d", code)
	}
	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: "file:///etc/passwd"}, &er); code != 422 || er.Field != "url" {
		t.Fatalf("file URL: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{}, &er); code != 422 || er.Field != "source" {
		t.Fatalf("nothing given: %d %+v", code, er)
	}
	if m.asked != 2 {
		t.Fatalf("the model was asked %d times", m.asked)
	}
}

func TestReadingAnUploadedOrPastedAssignment(t *testing.T) {
	e := newEnv(t)
	m := newReader(e)

	upload := func(name string, data []byte, setID string) (int, AssignmentRead) {
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		if setID != "" {
			mw.WriteField("setId", setID)
		}
		fw, _ := mw.CreateFormFile("file", name)
		fw.Write(data)
		mw.Close()
		resp, err := http.Post(e.URL+"/api/books/b1/assignments/read", mw.FormDataContentType(), &body)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var r AssignmentRead
		json.NewDecoder(resp.Body).Decode(&r)
		return resp.StatusCode, r
	}

	code, r := upload("Assignment 3.txt", []byte("ECE 313 Assignment #3, due September 15\n1. Problem 2.1.4, p. 57.\n"), "")
	if code != 202 || r.State != ReadStateReading || r.Source != "Assignment 3.txt" {
		t.Fatalf("upload %d %+v", code, r)
	}
	if r = e.waitRead(t, r.ID); r.State != ReadStateReady || len(r.Assignment.Groups) != 2 {
		t.Fatalf("upload read %+v", r)
	}
	if !strings.Contains(m.shown(), "Problem 2.1.4, p. 57.") {
		t.Fatalf("the model wasn't shown the file: %q", m.shown())
	}
	var file []byte
	e.svc.c.DB.QueryRow(`SELECT file FROM assignment_reads WHERE id = ?`, r.ID).Scan(&file)
	if file != nil {
		t.Fatal("the file stayed in the database after it was read")
	}

	// A photo goes to the model as itself.
	m.got = nil
	if code, r = upload("IMG_2041.jpg", blank(), ""); code != 202 {
		t.Fatalf("photo %d", code)
	}
	e.waitRead(t, r.ID)
	if !strings.Contains(m.shown(), "data:image/jpeg;base64,") {
		t.Fatalf("photo %q", m.shown())
	}

	// Anything else isn't read at all.
	if code, _ = upload("a.zip", []byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"), ""); code != 422 {
		t.Fatalf("zip %d", code)
	}
	// Nor for a set that isn't there.
	if code, _ = upload("Assignment 3.txt", []byte("3.36"), "nope"); code != 404 {
		t.Fatalf("no set %d", code)
	}

	if r = e.read(t, AssignmentText{Text: "Due 9/4: 3.36"}); r.Source != "pasted" {
		t.Fatalf("pasted %+v", r)
	}
	if code := e.do(t, "POST", "/api/books/nope/assignments/read", AssignmentText{Text: "3.36"}, nil); code != 404 {
		t.Fatalf("no book %d", code)
	}
}

func TestDismissingARead(t *testing.T) {
	e := newEnv(t)
	m := newReader(e)
	m.hold = make(chan struct{})
	var r AssignmentRead
	e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{Text: "3.36"}, &r)
	if code := e.do(t, "DELETE", "/api/assignment-reads/"+r.ID, nil, nil); code != 204 {
		t.Fatalf("dismiss %d", code)
	}
	close(m.hold)
	var list AssignmentReads
	e.do(t, "GET", "/api/books/b1/assignments/reads", nil, &list)
	if len(list.Reads) != 0 {
		t.Fatalf("still listed: %+v", list)
	}
	if code := e.do(t, "GET", "/api/assignment-reads/"+r.ID, nil, nil); code != 404 {
		t.Fatalf("dismissed read %d", code)
	}
}

func TestImportingAnAssignmentMakesItsSets(t *testing.T) {
	e := newEnv(t)
	m := newReader(e)
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, coursePage) }))
	defer page.Close()
	first := e.read(t, AssignmentText{URL: page.URL})

	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/assignments", AssignmentImport{Source: page.URL}, &er); code != 422 || er.Field != "groups" {
		t.Fatalf("nothing kept: %d %+v", code, er)
	}
	in := AssignmentImport{ReadID: first.ID, Source: page.URL, Groups: []ImportGroup{
		{Title: "Homework 1", Due: "2026-08-28", Rows: []Draft{{Text: "3.35 , 3.36", InBook: true}}},
		{Title: "Week 2", Due: "2026-09-04", Rows: []Draft{
			{Text: "3.36 (no PSpice)", InBook: true},
			{Text: "A 2 A source drives a 3 Ohm resistor. Find $V$."},
		}},
		{Title: "Empty", Due: "2026-09-11", Rows: []Draft{{Text: " "}}},
	}}
	var out List
	if code := e.do(t, "POST", "/api/books/b1/assignments", in, &out); code != 201 {
		t.Fatalf("import %d", code)
	}
	if len(out.Homework) != 2 || out.Homework[0].Title != "Homework 1" || out.Homework[0].DueDate != "2026-08-28" ||
		out.Homework[0].Total != 2 || out.Homework[1].Total != 2 {
		t.Fatalf("sets %+v", out.Homework)
	}
	d, err := e.svc.Get(t.Context(), out.Homework[1].ID)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(d.Questions[0].Notes, []string{"no PSpice"}) || d.Questions[1].InBook {
		t.Fatalf("questions %+v", d.Questions)
	}
	// The read is done with once it's in.
	var list AssignmentReads
	if e.do(t, "GET", "/api/books/b1/assignments/reads", nil, &list); len(list.Reads) != 0 {
		t.Fatalf("the imported read stayed: %+v", list)
	}

	// Checking the page again: the dates already added are marked, with
	// what the professor changed since.
	m.reply = strings.NewReplacer(`"3.36 (no PSpice)"`, `"3.36 (use PSpice)"`,
		`{"kind": "book", "text": "the one about the ladder"},`, `{"kind": "book", "text": "3.37"},`).Replace(pageReply)
	again := e.read(t, AssignmentText{URL: page.URL})
	g1, g2 := again.Assignment.Groups[0], again.Assignment.Groups[1]
	if !g1.Imported || g1.SetID != out.Homework[0].ID || !g1.Rows[0].Added || len(g1.Gone) != 0 {
		t.Fatalf("unchanged date %+v", g1)
	}
	if !g2.Imported || g2.SetID != out.Homework[1].ID {
		t.Fatalf("changed date %+v", g2)
	}
	changed := g2.Rows[0]
	if !changed.Added || len(changed.Changed) != 1 || !slices.Equal(changed.Changed[0].Was, []string{"no PSpice"}) ||
		!slices.Equal(changed.Changed[0].Now, []string{"use PSpice"}) {
		t.Fatalf("changed instructions %+v", changed)
	}
	if !g2.Rows[1].Added || g2.Rows[2].Added || !slices.Equal(g2.Rows[2].Labels, []string{"3.37"}) {
		t.Fatalf("own line and new line %+v %+v", g2.Rows[1], g2.Rows[2])
	}

	// Applying them: the new problem added, the instructions rewritten,
	// and nothing already there added twice.
	up := AssignmentImport{ReadID: again.ID, Source: page.URL, Groups: []ImportGroup{{
		SetID: g2.SetID,
		Rows:  []Draft{{Text: "3.36 (use PSpice)", InBook: true}, {Text: "3.37", InBook: true}, {Text: "A 2 A source drives a 3 Ohm resistor. Find $V$."}},
		Notes: []NotesUpdate{{QuestionID: changed.Changed[0].QuestionID, Notes: []string{"use PSpice"}}},
	}}}
	if code := e.do(t, "POST", "/api/books/b1/assignments", up, &out); code != 201 || len(out.Homework) != 1 || out.Homework[0].Total != 3 {
		t.Fatalf("update %d %+v", code, out.Homework)
	}
	d, _ = e.svc.Get(t.Context(), g2.SetID)
	if !slices.Equal(d.Questions[0].Notes, []string{"use PSpice"}) || d.Questions[2].Label != "3.37" {
		t.Fatalf("updated set %+v", d.Questions)
	}

	var last AssignmentSource
	if code := e.do(t, "GET", "/api/books/b1/assignments/source", nil, &last); code != 200 || last.URL != page.URL {
		t.Fatalf("last source %d %+v", code, last)
	}
	e.do(t, "POST", "/api/books/b1/assignments", AssignmentImport{Source: "pasted", Groups: in.Groups[:1]}, nil)
	if e.do(t, "GET", "/api/books/b1/assignments/source", nil, &last); last.URL != page.URL {
		t.Fatalf("pasted text became the source: %+v", last)
	}
}

// Any set can be updated from a document, whatever it was made from:
// every date in the document is compared with it.
func TestUpdatingAnySetFromADocument(t *testing.T) {
	e := newEnv(t)
	m := newReader(e)
	set := e.newSet(t)
	e.add(t, set.ID, Draft{Text: "3.35", InBook: true}, Draft{Text: "3.30 (do b)", InBook: true})
	m.reply = `{"title": "Set 3, revised", "groups": [{"due": "2026-09-25", "title": "", "rows": [
		{"kind": "book", "text": "3.35, 3.36"}]}]}`
	r := e.read(t, AssignmentText{Text: "Set 3, revised: 3.35, 3.36", SetID: set.ID})
	if r.SetID != set.ID {
		t.Fatalf("read %+v", r)
	}
	g := r.Assignment.Groups[0]
	if g.SetID != set.ID || g.Imported || len(g.Gone) != 1 || g.Gone[0].Label != "3.30" {
		t.Fatalf("group %+v", g)
	}
	if row := g.Rows[0]; row.Added || !slices.Equal(row.Present, []string{"3.35"}) {
		t.Fatalf("row %+v", row)
	}
	up := AssignmentImport{ReadID: r.ID, Source: "pasted", Groups: []ImportGroup{{
		SetID: set.ID, Rows: []Draft{{Text: "3.35, 3.36", InBook: true}}, Remove: []string{g.Gone[0].QuestionID},
	}}}
	var out List
	if code := e.do(t, "POST", "/api/books/b1/assignments", up, &out); code != 201 {
		t.Fatalf("update %d", code)
	}
	d, _ := e.svc.Get(t.Context(), set.ID)
	var labels []string
	for _, q := range d.Questions {
		labels = append(labels, q.Label)
	}
	if !slices.Equal(labels, []string{"3.35", "3.36"}) {
		t.Fatalf("set now %q", labels)
	}
	// A question from another set can't be removed through this one.
	other := e.newSet(t)
	q := e.add(t, other.ID, Draft{Text: "3.35", InBook: true})[0]
	up.Groups[0].Remove = []string{q.ID}
	up.ReadID = ""
	e.do(t, "POST", "/api/books/b1/assignments", up, nil)
	if _, err := getQuestion(t.Context(), e.svc.c.DB, q.ID); err != nil {
		t.Fatalf("another set's question went: %v", err)
	}
}
