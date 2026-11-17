package probnum

// Form is how a book prints a problem's number.
type Form string

const (
	// FormChapter numbers problems through each chapter: "4.27" is
	// chapter 4's problem 27 (Alexander & Sadiku).
	FormChapter Form = "chapter"
	// FormSection prints the section with the problem: "2.1.4" is
	// section 2.1's problem 4 (Yates & Goodman).
	FormSection Form = "section"
	// FormLocal restarts at 1 in every section and prints only the
	// number, "7.", under the section's Problems heading (Boyce).
	FormLocal Form = "local"
)

// Where is where a book keeps its problems.
type Where string

const (
	// WhereSection is after each section.
	WhereSection Where = "section"
	// WhereChapter is together at the end of each chapter.
	WhereChapter Where = "chapter"
)

// Style is how a book numbers its problems and where it keeps them,
// which decides what a reference like "3.1 #7" means in it.
type Style struct {
	Form  Form  `json:"form"`
	Where Where `json:"where"`
	// Heading is the word over a problem set, as the book prints it
	// ("Problems", "Exercises").
	Heading string `json:"heading,omitempty"`
	// Example is a problem that shows the style, as the book has it, for
	// a person to check against: its label and PDF page.
	Example *Example `json:"example,omitempty"`
	// Sure is false when the book's text didn't make it plain; the
	// student is asked to check.
	Sure bool `json:"sure"`
	// Confirmed is true once the student has said so.
	Confirmed bool `json:"confirmed"`
}

// Example is one problem in the book: its label as a student writes it
// ("3.1 #7", "4.27", "2.1.4") and the PDF page it's on.
type Example struct {
	Label string `json:"label"`
	Page  int    `json:"page"`
}
