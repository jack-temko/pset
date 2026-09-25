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
	"sync/atomic"
	"testing"

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

// assignmentModel reads any assignment as two due dates from the
// course page, and counts how often it's asked.
func assignmentModel(asked *atomic.Int32, got *[]string) func(llm.ChatRequest) llmtest.Reply {
	return func(req llm.ChatRequest) llmtest.Reply {
		if !strings.Contains(req.Messages[0].Content.Text(), "You read a course's homework assignment") {
			return fakeModel(req)
		}
		asked.Add(1)
		for _, p := range req.Messages[1].Content.Parts() {
			if p.ImageURL != nil {
				*got = append(*got, p.ImageURL.URL)
			}
			*got = append(*got, p.Text)
		}
		return llmtest.Reply{Text: "```json\n" + `{"title": "EECS 202 Homework", "groups": [
			{"due": "2026-08-28", "title": "", "rows": [
				{"kind": "book", "text": "3.35 , 3.36 (all on page 24)"},
				{"kind": "other", "text": "Reading: pages 4-19"}]},
			{"due": "2026-09-04", "title": "Week 2", "rows": [
				{"kind": "book", "text": "3.36 (no PSpice)"},
				{"kind": "own", "text": "A 2 A source drives a 3 Ohm resistor. Find $V$."},
				{"kind": "book", "text": "the one about the ladder"},
				{"kind": "quiz", "text": "Quiz on Friday"},
				{"kind": "book", "text": "  "}]},
			{"due": "sometime", "title": "", "rows": []}]}` + "\n```"}
	}
}

func TestReadingAnAssignmentFromAWebPage(t *testing.T) {
	e := newEnv(t)
	var asked atomic.Int32
	var got []string
	e.llm.Fallback(assignmentModel(&asked, &got))
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/202/hw.htm" {
			http.NotFound(w, r)
			return
		}
		fmt.Fprint(w, coursePage)
	}))
	defer page.Close()

	var a Assignment
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: page.URL + "/202/hw.htm"}, &a); code != 200 {
		t.Fatalf("read %d", code)
	}
	if !strings.Contains(strings.Join(got, ""), "M 8/24 | 4-19 | 8/28 | 1.1 , 1.6 , 1.9") {
		t.Fatalf("the model wasn't shown the table's rows: %q", got)
	}
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

	// A page that isn't there, or isn't a web page, is said plainly.
	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: page.URL + "/private"}, &er); code != 422 || er.Field != "url" || !strings.Contains(er.Message, "404") {
		t.Fatalf("missing page: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: "file:///etc/passwd"}, &er); code != 422 || er.Field != "url" {
		t.Fatalf("file URL: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{}, &er); code != 422 || er.Field != "source" {
		t.Fatalf("nothing given: %d %+v", code, er)
	}
	if asked.Load() != 1 {
		t.Fatalf("the model was asked %d times", asked.Load())
	}
}

func TestReadingAnUploadedOrPastedAssignment(t *testing.T) {
	e := newEnv(t)
	var asked atomic.Int32
	var got []string
	e.llm.Fallback(assignmentModel(&asked, &got))

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "Assignment 3.txt")
	fmt.Fprint(fw, "ECE 313 Assignment #3, due September 15\n1. Problem 2.1.4, p. 57.\n")
	mw.Close()
	resp, err := http.Post(e.URL+"/api/books/b1/assignments/read", mw.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	var a Assignment
	json.NewDecoder(resp.Body).Decode(&a)
	resp.Body.Close()
	if resp.StatusCode != 200 || a.Source != "Assignment 3.txt" || len(a.Groups) != 2 {
		t.Fatalf("upload %d %+v", resp.StatusCode, a)
	}
	if !strings.Contains(strings.Join(got, ""), "Problem 2.1.4, p. 57.") {
		t.Fatalf("the model wasn't shown the file: %q", got)
	}

	// A photo goes to the model as itself.
	body.Reset()
	mw = multipart.NewWriter(&body)
	fw, _ = mw.CreateFormFile("file", "IMG_2041.jpg")
	fw.Write(blank())
	mw.Close()
	got = nil
	resp, err = http.Post(e.URL+"/api/books/b1/assignments/read", mw.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 || !strings.Contains(strings.Join(got, ""), "data:image/jpeg;base64,") {
		t.Fatalf("photo %d %q", resp.StatusCode, got)
	}

	// Anything else isn't read.
	body.Reset()
	mw = multipart.NewWriter(&body)
	fw, _ = mw.CreateFormFile("file", "a.zip")
	fw.Write([]byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"))
	mw.Close()
	resp, _ = http.Post(e.URL+"/api/books/b1/assignments/read", mw.FormDataContentType(), &body)
	resp.Body.Close()
	if resp.StatusCode != 422 {
		t.Fatalf("zip %d", resp.StatusCode)
	}

	if code := e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{Text: "Due 9/4: 3.36"}, &a); code != 200 || a.Source != "pasted" {
		t.Fatalf("pasted %d %+v", code, a)
	}
	if code := e.do(t, "POST", "/api/books/nope/assignments/read", AssignmentText{Text: "3.36"}, nil); code != 404 {
		t.Fatalf("no book %d", code)
	}
}

func TestImportingAnAssignmentMakesItsSets(t *testing.T) {
	e := newEnv(t)
	var asked atomic.Int32
	var got []string
	e.llm.Fallback(assignmentModel(&asked, &got))
	src := "https://example.edu/202/hw.htm"

	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/assignments", AssignmentImport{Source: src}, &er); code != 422 || er.Field != "groups" {
		t.Fatalf("nothing kept: %d %+v", code, er)
	}
	in := AssignmentImport{Source: src, Groups: []ImportGroup{
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

	// Checking the page again marks what's already in.
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, coursePage) }))
	defer page.Close()
	var a Assignment
	e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: page.URL}, &a)
	if a.Groups[0].Imported || a.Groups[1].Imported {
		t.Fatalf("another page's sets counted: %+v", a.Groups)
	}
	e.svc.c.DB.Exec(`UPDATE homework SET source = ? WHERE source = ?`, page.URL, src)
	e.do(t, "POST", "/api/books/b1/assignments/read", AssignmentText{URL: page.URL}, &a)
	if !a.Groups[0].Imported || !a.Groups[1].Imported {
		t.Fatalf("already imported not marked: %+v", a.Groups)
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
