package work

import (
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/step"
)

// Set is a problem set as lists show it (Home's Assignments, the course's
// Work) and as the work pane's header shows it. Its counts follow its
// questions: a change to a question that moves them moves the set's Seq
// too.
type Set struct {
	// ID is the set's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// CourseID is the course it belongs to.
	CourseID string `json:"courseId"`
	// Title is its name ("Problem set 4").
	Title string `json:"title"`
	// Due is the date it is due (YYYY-MM-DD), or empty; the page puts it in
	// words ("Thu"), since it knows what today is.
	Due string `json:"due"`
	// TurnedInAt is when the student turned it in (RFC 3339); absent until
	// then.
	TurnedInAt string `json:"turnedInAt,omitempty"`
	// SheetID is the material it was read from, when it came from an
	// assignment sheet: opened beside the set.
	SheetID string `json:"sheetId,omitempty"`
	// Total is how many questions it has.
	Total int `json:"total"`
	// Done is how many of them the student has marked done.
	Done int `json:"done"`
	// Bar is one entry per question, in order, for the set's progress bar.
	// Never null.
	Bar []BarEntry `json:"bar"`
	// Estimate is the time left at the student's pace; absent until there
	// are two finished questions to learn the pace from.
	Estimate *Estimate `json:"estimate,omitempty"`
	// Timed is how many finished questions the estimate learned the pace
	// from.
	Timed int `json:"timed,omitempty"`
	// Steps is the set's own work: ranking its questions by difficulty.
	// Never null.
	Steps []step.Step `json:"steps"`
	// OpenedAt is when the student last had it open (RFC 3339), for Home's
	// "opened in the last 7 days"; absent if never.
	OpenedAt string `json:"openedAt,omitempty"`
	// CreatedAt is when it was made (RFC 3339).
	CreatedAt string `json:"createdAt"`
	// RemovedAt is when the student removed it (RFC 3339): hidden with its
	// questions, and back with Undo for a week. Absent while it is there.
	RemovedAt string `json:"removedAt,omitempty"`
}

// BarEntry is a question as the set's progress bar draws it: done or not,
// failed, and as wide as it is hard.
type BarEntry struct {
	// Done is true once the student has marked it done.
	Done bool `json:"done"`
	// Failed is true when a step of it failed for good.
	Failed bool `json:"failed,omitempty"`
	// Weight is its difficulty, 1 to 5; 0 until the set is ranked.
	Weight int `json:"weight,omitempty"`
}

// Estimate is the time left on a set at the student's pace, in seconds, and
// the range it could fall in.
type Estimate struct {
	// Seconds is the best guess.
	Seconds int `json:"seconds"`
	// Low is the short end of the range.
	Low int `json:"low"`
	// High is the long end of the range.
	High int `json:"high"`
}

// Reveal is a help step the student has opened on purpose.
type Reveal string

const (
	// RevealHint is the hint.
	RevealHint Reveal = "hint"
	// RevealWalkthrough is the walkthrough.
	RevealWalkthrough Reveal = "walkthrough"
	// RevealAnswers is the final answers.
	RevealAnswers Reveal = "answers"
)

// Question is one problem of a set as the student made it and works it.
// What PSet makes for it lives on its own resources: its Find, its Reading
// and its guide (a document).
type Question struct {
	// ID is the question's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// SetID is the set it belongs to.
	SetID string `json:"setId"`
	// Position is its place in the set, from 0.
	Position int `json:"position"`
	// Text is what the student typed ("3.1 #7", or a problem written out in
	// full).
	Text string `json:"text"`
	// Label is the problem's name as the strip and the header show it
	// ("3.1 #7"): in the textbook's numbering when it was read as a
	// reference, otherwise its number in the set.
	Label string `json:"label"`
	// Notes are the professor's instructions for it ("do c", "no PSpice"),
	// one a line, as runs: shown above the problem and followed by the
	// guide over the book. Never null, nor any line in it.
	Notes [][]doc.Run `json:"notes"`
	// Find is true for a problem looked up in the course's textbooks (it
	// was typed as a reference, "3.1 #7"); false for one written out in full.
	Find bool `json:"find"`
	// PinPage is the page the student pointed it to ("it's on page 95"),
	// for its find; absent when they haven't.
	PinPage int `json:"pinPage,omitempty"`
	// Done is true once the student has marked it done.
	Done bool `json:"done"`
	// Revealed is the help steps the student has opened. Never null.
	Revealed []Reveal `json:"revealed"`
	// Images are pictures the student attached (a handout's figure), shown
	// with the problem and printed on the worksheet. Never null.
	Images []Image `json:"images"`
	// Difficulty is how hard it is against the rest of its set, 1 to 5;
	// absent until the set is ranked.
	Difficulty int `json:"difficulty,omitempty"`
	// Seconds is the time spent with it open, as of this copy; absent until
	// there is some.
	Seconds int `json:"seconds,omitempty"`
	// GuideID is its guide, a document holding the hint and the
	// walkthrough; absent until the guide is first written or asked for.
	GuideID string `json:"guideId,omitempty"`
	// Steps is PSet's work on it, in order: find, figures (if it has any),
	// guide, check. The guide step's state says whether the guide is out of
	// date. Never null.
	Steps []step.Step `json:"steps"`
	// RemovedAt is when the student removed it (RFC 3339): "Removed 4.62.
	// Undo." Absent while it is there.
	RemovedAt string `json:"removedAt,omitempty"`
}

// Image is a picture the student attached to a question, served by its id.
type Image struct {
	// ID is the image's id.
	ID string `json:"id"`
	// Label is what the problem calls it ("Figure 2"), or empty.
	Label string `json:"label"`
	// Ratio is its height over its width, so it holds its box before it
	// arrives.
	Ratio float64 `json:"ratio"`
}

// Find is where PSet found a question, and the problem as found: its
// statement, its box on the page and its figures. Exactly one of
// MaterialID (with Page) and EarlierID is set. A problem the student wrote
// out in full has no find step and no find: its Text is its statement.
type Find struct {
	// ID is the find's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// QuestionID is the question it is for.
	QuestionID string `json:"questionId"`
	// MaterialID is the material it was found in, when it was found in one.
	MaterialID string `json:"materialId,omitempty"`
	// Page is the PDF page of that material it starts on: the page link
	// ("p. 112").
	Page *int `json:"page,omitempty"`
	// EarlierID is an earlier question it builds on, when the reference
	// pointed at one ("problem 3 of last week's set").
	EarlierID string `json:"earlierId,omitempty"`
	// Boxes are where the problem is on the page, drawn by the finder or by
	// the student pointing it out: the page link outlines them. Never null.
	Boxes []Box `json:"boxes"`
	// Figures are the figures it refers to, cropped from the page. Never
	// null.
	Figures []Figure `json:"figures"`
	// Statement is the problem as it is printed, or as the earlier question
	// has it, as runs. Never null.
	Statement []doc.Run `json:"statement"`
}

// BoxKind is what a box around a problem holds.
type BoxKind string

const (
	// BoxKindText is the problem's words, read in order as its statement.
	BoxKindText BoxKind = "text"
	// BoxKindFigure is one of its figures.
	BoxKindFigure BoxKind = "figure"
)

// Box is a rectangle around part of a problem on a page: its PDF page, and
// where on it as fractions of the page (y from the top).
type Box struct {
	// Page is the PDF page.
	Page int `json:"page"`
	// X is the left edge, as a fraction of the page's width.
	X float64 `json:"x"`
	// Y is the top edge, as a fraction of the page's height.
	Y float64 `json:"y"`
	// W is the width, as a fraction of the page's width.
	W float64 `json:"w"`
	// H is the height, as a fraction of the page's height.
	H float64 `json:"h"`
	// Kind is what the box holds.
	Kind BoxKind `json:"kind"`
}

// Figure is a figure a problem refers to, cropped from its page and served
// by its find's id and its index.
type Figure struct {
	// Label is what the problem calls it ("Figure 4.62").
	Label string `json:"label"`
	// W is the crop's width as a fraction of the page's, so the image holds
	// its box before it arrives (with the material's aspect).
	W float64 `json:"w"`
	// H is the crop's height as a fraction of the page's.
	H float64 `json:"h"`
}

// Reading is how a question's figures read, one fact a line, which its
// guide is written from and the student can correct.
type Reading struct {
	// ID is the reading's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// QuestionID is the question it is for.
	QuestionID string `json:"questionId"`
	// Lines are the facts, one a line ("Node A: top of the 4 Ω"), as runs.
	// Never null, nor any line in it.
	Lines [][]doc.Run `json:"lines"`
	// Doubts are the points where the figure's readings disagreed, each with
	// what they said and what was settled on: the lines worth checking.
	// Empty once the student has corrected it. Never null, nor any line in
	// it.
	Doubts [][]doc.Run `json:"doubts"`
	// Corrected is true once the student has corrected it; the guide is
	// then out of date until rewritten.
	Corrected bool `json:"corrected"`
}

// Sets is a course's sets, or every course's for Home: due soonest first.
// Never null.
type Sets struct {
	// Sets is every set not removed.
	Sets []Set `json:"sets"`
}

// Detail is one set with everything the work pane draws: its questions in
// order, and what PSet found and read for them. Guides are documents, read
// by their id. Every list is never null.
type Detail struct {
	// Set is the set.
	Set Set `json:"set"`
	// Questions is its questions, in order.
	Questions []Question `json:"questions"`
	// Finds is a find for each question found so far.
	Finds []Find `json:"finds"`
	// Readings is a reading for each question whose figures have been read.
	Readings []Reading `json:"readings"`
}

// RowKind is what a line of an assignment sheet is.
type RowKind string

const (
	// RowKindTextbook is problems from the course's textbook, as the
	// professor wrote the line: "2.1: 1, 4, 6 (do c, 6 pts each)".
	RowKindTextbook RowKind = "textbook"
	// RowKindOwn is a problem the professor wrote out in full.
	RowKindOwn RowKind = "own"
	// RowKindOther is anything that is not a problem to hand in: reading,
	// quizzes, notes.
	RowKindOther RowKind = "other"
)

// Read is an assignment sheet being read into rows in the background, or
// read and waiting for the student's review, until it is added or
// dismissed. Its one step says how the reading is going.
type Read struct {
	// ID is the read's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// CourseID is the course it is for.
	CourseID string `json:"courseId"`
	// Source is where it came from: a web page's address, a file's name, or
	// "pasted".
	Source string `json:"source"`
	// SheetID is the material an uploaded sheet was kept as, once examined;
	// absent for a web page or pasted text.
	SheetID string `json:"sheetId,omitempty"`
	// SetID is the set it was read to update, when it was.
	SetID string `json:"setId,omitempty"`
	// Steps is its one step, read. Never null.
	Steps []step.Step `json:"steps"`
	// Assignment is what was read, once the read step is done, marked
	// against the sets already made from the same source.
	Assignment *Assignment `json:"assignment,omitempty"`
	// CreatedAt is when it was started (RFC 3339).
	CreatedAt string `json:"createdAt"`
}

// Reads is a course's reads still under way or waiting for review, oldest
// first. Never null.
type Reads struct {
	// Reads is every read not yet added or dismissed.
	Reads []Read `json:"reads"`
}

// Assignment is a sheet read out into due dates and lines, for the student
// to review before anything is added.
type Assignment struct {
	// Title is the sheet's own title.
	Title string `json:"title"`
	// Groups is one group per due date. Never null.
	Groups []AssignmentGroup `json:"groups"`
}

// AssignmentGroup is everything due on one date: one set to make, or to
// add to.
type AssignmentGroup struct {
	// Due is the date (YYYY-MM-DD), or empty.
	Due string `json:"due"`
	// Title is the set's title as read.
	Title string `json:"title"`
	// Rows is its lines, in order. Never null.
	Rows []AssignmentRow `json:"rows"`
	// Imported is true when a set from this source already has this due
	// date: a page checked again offers only what is new.
	Imported bool `json:"imported,omitempty"`
	// SetID is the set this date updates: the one made from it before, or
	// the one the student is updating.
	SetID string `json:"setId,omitempty"`
	// Gone is what that set has that the sheet no longer lists: offered for
	// removal, never removed unasked. Never null.
	Gone []SetQuestion `json:"gone"`
}

// AssignmentRow is one line of an assignment, as read out for review.
type AssignmentRow struct {
	// Kind is what the line is.
	Kind RowKind `json:"kind"`
	// Text is the line as the sheet has it.
	Text string `json:"text"`
	// Labels are the questions a textbook line becomes, in the textbook's
	// numbering ("2.1 #1", "2.1 #4"); none when it could not be read as a
	// reference, which Unread says. Never null.
	Labels []string `json:"labels"`
	// Unread is true when a textbook line could not be read as a reference.
	Unread bool `json:"unread,omitempty"`
	// Notes are the professor's instructions the line carries. Never null.
	Notes []string `json:"notes"`
	// Present is which of its labels the set it updates already has. Never
	// null.
	Present []string `json:"present"`
	// Added is true when the set it updates already has the whole line.
	Added bool `json:"added,omitempty"`
	// Changed is each question the set has whose instructions the sheet
	// now gives differently. Never null.
	Changed []NotesChange `json:"changed"`
}

// NotesChange is a question whose professor's instructions a sheet gives
// differently from its set.
type NotesChange struct {
	// QuestionID is the question.
	QuestionID string `json:"questionId"`
	// Label is its label.
	Label string `json:"label"`
	// Was is its instructions now, one a line. Never null.
	Was []string `json:"was"`
	// Now is what the sheet says instead, one a line. Never null.
	Now []string `json:"now"`
}

// SetQuestion names a question in a set.
type SetQuestion struct {
	// QuestionID is the question.
	QuestionID string `json:"questionId"`
	// Label is its label.
	Label string `json:"label"`
}

// The work's action inputs (internal/action).
type (
	// AddSet makes a set in a course.
	AddSet struct {
		CourseID string `json:"courseId"`
		Title    string `json:"title"`
		// Due is a date (YYYY-MM-DD), or empty.
		Due string `json:"due"`
	}
	// RenameSet renames a set.
	RenameSet struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	// SetDue changes a set's due date; empty clears it.
	SetDue struct {
		ID  string `json:"id"`
		Due string `json:"due"`
	}
	// TurnIn marks a set turned in, or not.
	TurnIn struct {
		ID       string `json:"id"`
		TurnedIn bool   `json:"turnedIn"`
	}
	// RemoveSet removes a set and, with it, its questions.
	RemoveSet struct {
		ID string `json:"id"`
	}
	// AddQuestions adds questions at the end of a set. A draft that is a
	// textbook reference listing several problems ("2.1: 1, 4, 6") becomes
	// one question each.
	AddQuestions struct {
		SetID  string  `json:"setId"`
		Drafts []Draft `json:"drafts"`
	}
	// QuestionMark marks a question done, or not.
	QuestionMark struct {
		ID   string `json:"id"`
		Done bool   `json:"done"`
	}
	// QuestionReveal opens one help step of a question.
	QuestionReveal struct {
		ID     string `json:"id"`
		Reveal Reveal `json:"reveal"`
	}
	// QuestionMove moves a question to a place in its set, from 0.
	QuestionMove struct {
		ID       string `json:"id"`
		Position int    `json:"position"`
	}
	// QuestionNotes replaces a question's notes, one a line.
	QuestionNotes struct {
		ID    string   `json:"id"`
		Notes []string `json:"notes"`
	}
	// RemoveQuestion removes a question.
	RemoveQuestion struct {
		ID string `json:"id"`
	}
)

// Draft is a question as the student typed it: a reference to look up in
// the textbooks (Find), or a problem written out in full.
type Draft struct {
	Text string `json:"text"`
	Find bool   `json:"find"`
}
