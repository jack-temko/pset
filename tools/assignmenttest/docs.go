package main

import "strings"

// The documents: made-up lookalikes of the ways Jack's professors assign
// homework (the real ones are theirs, and stay out of the repo), then
// harder ones that stress the reading. Each says what a right reading
// is: its due dates, the problems on each in the book's own labels, the
// professor's notes some of them carry, and how many problems are
// written out. The dates are fall 2026, read with today's date, as the
// app reads them.

const (
	boyce   = "Elementary Differential Equations"    // numbers start again each section: "2.1 #4"
	circuit = "Fundamentals of Electric Circuits"    // through each chapter: "4.27"
	yates   = "Probability and Stochastic Processes" // with the section: "2.1.4"
)

type want struct {
	Due string
	// Labels is every book problem due then, in the book's labels.
	Labels []string
	// Notes is what a problem's professor's notes must say, a phrase of
	// it, by label.
	Notes map[string]string
	// Own is how many problems are written out in the document.
	Own int
}

type doc struct {
	Name  string
	Book  string
	About string
	// One of: a PDF built by pdf, a web page served at a URL, or text
	// pasted in.
	PDF  func() ([]byte, error)
	HTML string
	Text string
	Want []want
	// Optional dates: read or not, either is right (an old assignment
	// quoted in an email).
	Maybe []string
	// NoHomework is a document with nothing to assign: it should be
	// refused, not read into rows.
	NoHomework bool
}

var docs = []doc{
	{
		Name:  "math220",
		Book:  boyce,
		About: "a LaTeX-style table like the Math 220 sheet: due date, section and problem numbers, points and notes in the same cell",
		PDF: func() ([]byte, error) {
			return newSheet("").
				center("Math 220, TR 11:00am–12:15, Fall 2026", false).gap(4).
				table([]float64{24, 110, 30}, [][]string{
					{"Due", "Graded Homework. Please turn it into Canvas.", "Points in total"},
					{"Sep 12\nnight", "2.2: 3, 8, (4 pts each)\n2.3: 2, 5 (do a and b, 6 pts each)\n2.3: 11 (also sketch the solution, 8 pts).", "36"},
					{"Sep 19\nnight", "2.4: 1, 9, 22 (5 pts each)\n2.5: 3 (draw the phase line, 8 pts).", "23"},
					{"Sep 26\nnight", "2.6: 4, 10, (5 pts each)\n2.7: 2 (use h = 0.1 only, 6 pts)\n2.8: 1 (5 pts).", "21"},
				}).
				bytes()
		},
		Want: []want{
			{Due: "2026-09-12", Labels: []string{"2.2 #3", "2.2 #8", "2.3 #2", "2.3 #5", "2.3 #11"},
				Notes: map[string]string{"2.3 #2": "a and b", "2.3 #11": "sketch"}},
			{Due: "2026-09-19", Labels: []string{"2.4 #1", "2.4 #9", "2.4 #22", "2.5 #3"},
				Notes: map[string]string{"2.5 #3": "phase line"}},
			{Due: "2026-09-26", Labels: []string{"2.6 #4", "2.6 #10", "2.7 #2", "2.8 #1"},
				Notes: map[string]string{"2.7 #2": "h = 0.1"}},
		},
	},
	{
		Name:  "eecs461",
		Book:  yates,
		About: "a groff-style numbered sheet like EECS 461's: reading and quiz lines, book problems with page numbers, problems written out with parts, a paragraph after a reference, a book problem changed in the professor's words, and a footer mid-problem",
		PDF: func() ([]byte, error) {
			return newSheet("Prof. Quill|Copyright 2026 R. Quill|Fall 2026").
				center("EECS 461 Probability and Statistics", false).
				center("Fall Semester 2026", false).
				center("Assignment #4 Due 22 September 2026", false).gap(3).
				para("Reading: Sections 3.1 - 3.4 (3.5 is optional), 4.1 in Yates/Goodman").
				para("Do all of the Quizzes in the Reading assignment, but do not hand them in. Answers to the Quizzes are on the book’s website.").
				para("For all problems from the book, use the method(s) from the corresponding section to solve the problem.").
				item("1", "Problem 3.1.2, p. 95.").
				item("2", "A bakery sells 40 loaves on a typical morning. Each customer independently buys one loaf with probability 0.6, two loaves with probability 0.3, and three with probability 0.1. Use the PMF you derive to answer the following.",
					"What is the expected number of loaves one customer buys?",
					"If 18 customers arrive, what is the probability the bakery sells out before noon?").
				item("3", "Problem 3.2.5, p. 99. This one has a twist that the book’s answer key gets wrong in the third edition, so check your work against the definition of a PMF rather than the back of the book. The fourth edition fixes it.").
				item("4", "A lab has 9 oscilloscopes, 3 of which are miscalibrated. Four are chosen at random for a class.",
					"How many different sets of four are possible?",
					"What is the probability that exactly one miscalibrated scope is chosen?",
					"What is the probability that none are?").
				item("5", "Problem 3.3.1, p. 102.").
				item("6", "Problem 3.3.6, p. 104. Express your answer in terms of q, the probability of a miss.").
				item("7", "Use MATLAB or any other language/platform to do problem 3.4.3 on p. 108, but simulate 1000 trials instead of 100. Hand in the following.",
					"Your program or script, and the language you used.",
					"A histogram of the 1000 outcomes, with the PMF from the book drawn over it.").
				item("8", "Problem 3.4.7, p. 110.").
				bytes()
		},
		Want: []want{
			{Due: "2026-09-22", Labels: []string{"3.1.2", "3.2.5", "3.3.1", "3.3.6", "3.4.3", "3.4.7"}, Own: 2,
				Notes: map[string]string{"3.3.6": "terms of q", "3.4.3": "1000"}},
		},
	},
	{
		Name:  "eecs202",
		Book:  circuit,
		About: "a Word-export semester table like the EECS 202 page: a row a lecture, several rows due on one date, notes in the cells, a weekday after a date, cells split over lines of source",
		HTML: wordTable("EECS 202 Homework Assignments", [][]string{
			{"M 8/24", "4-19", "8/28", "1.2 , 1.5 , 1.8 (all on page 24)", "Old radios , First transistors"},
			{"W8/26", "30- 35", "9/4", "1.16 , 1.24", ""},
			{"F8/28", "35-44", "9/4", "2.14 , 2.19 , 2.21", "Ohm's Law Explained!"},
			{"M 8/31", "44-51", "9/4", "2.26 , 2.33 , 2.38 (find the power to the 8-Ohm resistor!)", ""},
			{"W 9/2", "80-86", "9/11", "3.4 , 3.9", ""},
			{"F 9/4", "86-95", "9/11", "3.14 , 3.17 , 3.21 (use any computing tool you want)", ""},
			{"W 9/16", "147-148 , 137-146", "9/25", "4.22 , 4.30 , 4.35 (no PSpice or MulitSim)", ""},
			{"W 9/23", "", "9/30 (W)", "4.41 , 4.57 , 4.66", ""},
		}),
		Want: []want{
			{Due: "2026-08-28", Labels: []string{"1.2", "1.5", "1.8"}},
			{Due: "2026-09-04", Labels: []string{"1.16", "1.24", "2.14", "2.19", "2.21", "2.26", "2.33", "2.38"},
				Notes: map[string]string{"2.38": "8-Ohm"}},
			{Due: "2026-09-11", Labels: []string{"3.4", "3.9", "3.14", "3.17", "3.21"},
				Notes: map[string]string{"3.21": "computing tool"}},
			{Due: "2026-09-25", Labels: []string{"4.22", "4.30", "4.35"}, Notes: map[string]string{"4.35": "PSpice"}},
			{Due: "2026-09-30", Labels: []string{"4.41", "4.57", "4.66"}},
		},
	},

	// Harder.
	{
		Name:  "syllabus",
		Book:  circuit,
		About: "a two-page syllabus: policies and grading first, then a weekly schedule whose homework is due the Monday after its week, a range with an en dash, and an exam week with none",
		PDF: func() ([]byte, error) {
			return newSheet("EECS 212 Syllabus|Fall 2026|").
				center("EECS 212: Circuits II", true).
				center("Fall 2026 · MWF 10:00–10:50 · Eaton 2", false).gap(3).
				para("Instructor: Dr. M. Okafor. Office hours Tuesday 2–4pm and by appointment, Eaton 3014.").
				para("Grading: homework 20%, three midterms 45%, final exam 35%. Homework is due at the start of class on the Monday after the week it is assigned. Late homework is accepted up to 48 hours late for half credit. The lowest homework score is dropped.").
				para("Academic integrity: you may discuss homework with classmates, but what you hand in must be your own work. Copying from a solutions manual, including online ones, is a violation of the honor code.").
				para("Accommodations: students needing accommodations should contact Student Access Services in the first two weeks of the semester.").
				page().
				center("Tentative schedule", true).gap(2).
				table([]float64{16, 34, 60, 62}, [][]string{
					{"Week", "Dates", "Topics", "Homework (due the next Monday)"},
					{"5", "Sep 21–25", "Thevenin and Norton", "4.27–4.30, 4.35"},
					{"6", "Sep 28–Oct 2", "Maximum power transfer", "4.61, 4.64 (ignore part c)"},
					{"7", "Oct 5–9", "Midterm 1 (Wed); op amps", "none"},
					{"8", "Oct 12–16", "Inverting and summing amps", "5.12, 5.18, 5.24"},
				}).
				para("The schedule may change; changes will be announced in class and on Canvas.").
				bytes()
		},
		Want: []want{
			{Due: "2026-09-28", Labels: []string{"4.27", "4.28", "4.29", "4.30", "4.35"}},
			{Due: "2026-10-05", Labels: []string{"4.61", "4.64"}, Notes: map[string]string{"4.64": "part c"}},
			{Due: "2026-10-19", Labels: []string{"5.12", "5.18", "5.24"}},
		},
	},
	{
		Name:  "email",
		Book:  boyce,
		About: "a chatty email pasted in: problems in running prose, parts limited in words, a quiz reminder that isn't homework, a signature, and last week's email quoted below it",
		Text: `Subject: HW for Wednesday + quiz Friday

Hi everyone,

For Wednesday, October 1 please do from section 2.6 problems 3, 4 and 10, and from 2.7 do #2 (parts a through c only, skip d). If you don't have MATLAB installed, you can do the numerical part of 2.7 #2 by hand with h = 0.2.

Reminder that the quiz on Friday covers 2.5 and 2.6, so the homework is good practice for it. No need to hand in anything for the quiz.

See you in class,
Prof. Lindqvist
--
Math 220 | Office: Snow Hall 412 | Hours: MW 1-2pm

> On Sep 22, Prof. Lindqvist wrote:
> For Friday Sep 26 please do 2.5: 3, 7 and 2.6: 1.
`,
		Want: []want{
			{Due: "2026-10-01", Labels: []string{"2.6 #3", "2.6 #4", "2.6 #10", "2.7 #2"}, Notes: map[string]string{"2.7 #2": "c"}},
		},
		Maybe: []string{"2026-09-26"},
	},
	{
		Name:  "two-columns",
		Book:  yates,
		About: "two assignments side by side in two columns, so the text layer interleaves them line by line",
		PDF: func() ([]byte, error) {
			return newSheet("").
				center("EECS 461 · Homework 5 and 6", true).gap(3).
				columns(
					[]string{
						"Homework 5, due Tuesday Sep 29",
						"1. Problem 4.1.3, p. 131.",
						"2. Problem 4.2.2, p. 135. Sketch the CDF as well as the PDF.",
						"3. Problem 4.2.6, p. 136.",
						"4. A resistor's value is uniform on [95, 105] ohms. What is the probability it is within 2% of 100 ohms?",
					},
					[]string{
						"Homework 6, due Tuesday Oct 6",
						"1. Problem 4.3.1, p. 140.",
						"2. Problem 4.3.8, p. 142.",
						"3. Problem 4.4.4, p. 147. Use the table in Appendix A only.",
						"4. Problem 4.5.2, p. 152.",
					},
				).
				bytes()
		},
		Want: []want{
			{Due: "2026-09-29", Labels: []string{"4.1.3", "4.2.2", "4.2.6"}, Own: 1, Notes: map[string]string{"4.2.2": "CDF"}},
			{Due: "2026-10-06", Labels: []string{"4.3.1", "4.3.8", "4.4.4", "4.5.2"}, Notes: map[string]string{"4.4.4": "Appendix A"}},
		},
	},
	{
		Name:  "canvas",
		Book:  circuit,
		About: "a Canvas-like assignment page: navigation, scripts, a due line with a time, and a sidebar naming the next assignment with no problems",
		HTML:  canvasPage,
		Want: []want{
			{Due: "2026-10-08", Labels: []string{"5.12", "5.18", "5.24", "5.31"}, Notes: map[string]string{"5.24": "ideal"}},
		},
	},
	{
		Name:  "ranges",
		Book:  boyce,
		About: "ranges of problems: all of one run, the odd ones of another, and a single one after",
		Text:  "HW 9, due Tuesday October 20: 3.1: 1-8 all. 3.2: 1-15 odd, 24.",
		Want: []want{
			{Due: "2026-10-20", Labels: []string{
				"3.1 #1", "3.1 #2", "3.1 #3", "3.1 #4", "3.1 #5", "3.1 #6", "3.1 #7", "3.1 #8",
				"3.2 #1", "3.2 #3", "3.2 #5", "3.2 #7", "3.2 #9", "3.2 #11", "3.2 #13", "3.2 #15", "3.2 #24",
			}},
		},
	},
	{
		Name:  "new-year",
		Book:  circuit,
		About: "a winter-break packet due in January, with no year given",
		Text:  "Winter break packet (optional, but it counts as extra credit). Due the first day of class, Jan 12: 6.2, 6.5, 6.9, and 6.14 (show the equivalent capacitance at each step).",
		Want: []want{
			{Due: "2027-01-12", Labels: []string{"6.2", "6.5", "6.9", "6.14"}, Notes: map[string]string{"6.14": "equivalent capacitance"}},
		},
	},
	{
		Name:       "no-homework",
		Book:       boyce,
		About:      "an announcement with nothing to hand in",
		Text:       "Office hours are moving this week: Thursday 3-5pm in Snow 412 instead of Wednesday. The midterm is still on October 14 and covers chapters 1 and 2. Bring a calculator.",
		NoHomework: true,
	},
}

// wordTable is a course page as Word exports one: a table in nested
// blockquotes, every cell a paragraph, cells split over lines of source.
func wordTable(title string, rows [][]string) string {
	var b []byte
	b = append(b, `<html><head><meta http-equiv=Content-Type content="text/html; charset=macintosh">
<title>EECS 211 Homework Assignments</title><style><!-- .MsoTitle {font-family:Times;} --></style></head>
<body><div class=Section1><blockquote><blockquote><p class="style3">`+title+`</p>
<p class=MsoTitle>&nbsp;</p><table width="1348" border="1"><tbody>
<tr><td width=90><p><b>Lecture Date</b></p></td><td><p><b>Reading Assignment</b></p></td>
<td><p><b>HW Due Date</b></p></td><td><p><b>HW Problems</b></p></td><td><p><b>Lecture Materials</b></p></td></tr>
`...)
	for _, r := range rows {
		b = append(b, "<tr>"...)
		for i, c := range r {
			if c == "" {
				c = "&nbsp;"
			}
			if i == 3 {
				// Word breaks long cells across lines of source.
				c = replaceNth(c, " , ", " ,\n  ", 2)
			}
			b = append(b, "<td><p>"+c+"</p></td>"...)
		}
		b = append(b, "</tr>\n"...)
	}
	b = append(b, "</tbody></table></blockquote></blockquote></div></body></html>"...)
	return string(b)
}

// replaceNth replaces the nth occurrence of old.
func replaceNth(s, old, new string, n int) string {
	at := 0
	for k := 1; ; k++ {
		i := strings.Index(s[at:], old)
		if i < 0 {
			return s
		}
		if k == n {
			return s[:at+i] + new + s[at+i+len(old):]
		}
		at += i + len(old)
	}
}

const canvasPage = `<!DOCTYPE html>
<html lang="en"><head><title>HW 7: EECS 212 Fall 2026</title>
<script>window.ENV = {"current_user":{"id":"4411"},"FEATURES":{"new_nav":true}};</script>
<style>.ic-app-nav { display: flex } .hidden { display: none }</style></head>
<body class="ic-app">
<nav class="ic-app-header"><ul><li><a href="/">Dashboard</a></li><li><a href="/courses">Courses</a></li>
<li><a href="/calendar">Calendar</a></li><li><a href="/conversations">Inbox <span class="badge">3</span></a></li></ul></nav>
<div id="left-side"><ul><li>Home</li><li>Announcements</li><li class="active">Assignments</li><li>Grades</li><li>Modules</li></ul></div>
<div id="content">
  <h1 class="title">HW 7</h1>
  <div class="assignment-details">
    <span class="title">Due</span> <span class="value">Oct 8, 2026 11:59pm</span>
    <span class="title">Points</span> <span class="value">20</span>
    <span class="title">Submitting</span> <span class="value">a file upload</span>
  </div>
  <div class="user_content">
    <p>Chapter 5 problems:</p>
    <ul><li>5.12</li><li>5.18</li><li>5.24 (use the ideal op-amp model)</li><li>5.31</li></ul>
    <p>Scan your work into a single PDF. Please make sure it is legible.</p>
  </div>
  <div class="hidden">Rubric: 5 points per problem.</div>
</div>
<aside id="right-side"><h2>Coming up</h2><ul><li>HW 8 &middot; due Oct 15</li><li>Midterm 2 &middot; Oct 21</li></ul></aside>
<script src="/dist/main.js"></script>
</body></html>`
