package library

import (
	"testing"

	"github.com/jackt/pset/internal/llm/llmtest"
)

func TestAuthorLine(t *testing.T) {
	for _, c := range []struct {
		in   []string
		want string
	}{
		{nil, ""},
		{[]string{"Axler"}, "Axler"},
		{[]string{"Alexander", "Sadiku"}, "Alexander & Sadiku"},
		{[]string{"Boyce", "DiPrima", "Meade"}, "Boyce, DiPrima & Meade"},
		{[]string{"Halliday", "Resnick", "Walker", "Krane"}, "Halliday et al."},
	} {
		if got := authorLine(c.in); got != c.want {
			t.Errorf("authorLine(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCheckName(t *testing.T) {
	pages := []string{"ELEMENTARY DIFFERENTIAL\nEQUATIONS AND BOUNDARY\nVALUE PR0BLEMS\n12th Edition", "WILLIAM E. BOYCE\nRICHARD C. DIPRIMA\nDOUGLAS B. MEADE"}
	for _, c := range []struct {
		title   string
		authors []string
		wantT   string
		wantA   string
	}{
		// Title case against capitals, line breaks and an OCR slip.
		{"Elementary Differential Equations and Boundary Value Problems", []string{"Boyce", "DiPrima", "Meade"},
			"Elementary Differential Equations and Boundary Value Problems", "Boyce, DiPrima & Meade"},
		// An invented title or author isn't taken.
		{"Differential Equations Made Easy", []string{"Boyce", "Smith"}, "", ""},
		{"", nil, "", ""},
	} {
		gotT, gotA := checkName(c.title, c.authors, pages)
		if gotT != c.wantT || gotA != c.wantA {
			t.Errorf("checkName(%q, %q) = %q, %q; want %q, %q", c.title, c.authors, gotT, gotA, c.wantT, c.wantA)
		}
	}
}

func TestBookNamedFromItsFirstPages(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	e.useBook(pages)
	e.llm.Script(llmtest.Reply{Text: `{"title":"A Primer of Kettle Work","authors":["Voss","Prane"]}`}, entriesReply(t, kettleEntries))
	var up BookChanged
	e.upload(t, "scan_0042.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)
	if b.Title != "A Primer of Kettle Work" || b.Author != "Voss & Prane" {
		t.Fatalf("named %q by %q", b.Title, b.Author)
	}
	if !e.events.has(EventBookChanged, `"title":"A Primer of Kettle Work"`) {
		t.Fatal("the new name wasn't published")
	}
	// The pages before the contents (PDF 3), as images.
	var images int
	for _, p := range e.llm.Requests()[0].Chat.Messages[1].Content.Parts() {
		if p.Type == "image_url" {
			images++
		}
	}
	if images != 2 {
		t.Fatalf("%d pages shown, want 2", images)
	}
}

func TestNameNotOnThePagesKeepsTheFilename(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	e.useBook(pages)
	e.llm.Script(llmtest.Reply{Text: `{"title":"Thunder for Beginners","authors":["Voss","Keel"]}`}, entriesReply(t, kettleEntries))
	var up BookChanged
	e.upload(t, "scan_0042.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)
	if b.Title != "scan 0042" || b.Author != "" {
		t.Fatalf("named %q by %q", b.Title, b.Author)
	}
}

func TestNamingFailureDoesntStopTheImport(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	e.useBook(pages)
	e.llm.Script(llmtest.Reply{Status: 401, Text: "bad key"}, entriesReply(t, kettleEntries))
	var up BookChanged
	e.upload(t, "scan_0042.pdf", scannedPDF(t, len(pages)), &up)
	if b := e.waitFor(t, up.Book.ID, StateReady); b.Title != "scan 0042" {
		t.Fatalf("title %q", b.Title)
	}
}

func TestNamingNeverReplacesTheStudentsName(t *testing.T) {
	e := newEnv(t)
	pages := kettleBook(true)
	e.useBook(pages)
	// The first run stops at the contents; the student names the book;
	// the retry's naming must leave it be.
	e.llm.Script(noName, llmtest.Reply{Status: 401, Text: "bad key"})
	var up BookChanged
	e.upload(t, "scan_0042.pdf", scannedPDF(t, len(pages)), &up)
	b := e.waitFor(t, up.Book.ID, StateFailed)
	title, author := "Kettles", "Me"
	e.do(t, "PATCH", "/api/books/"+b.ID, BookPatch{Title: &title, Author: &author}, nil)

	e.llm.Script(llmtest.Reply{Text: `{"title":"A Primer of Kettle Work","authors":["Voss","Prane"]}`}, entriesReply(t, kettleEntries))
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	if b = e.waitFor(t, b.ID, StateReady); b.Title != "Kettles" || b.Author != "Me" {
		t.Fatalf("named %q by %q", b.Title, b.Author)
	}
}
