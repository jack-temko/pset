package work

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/pagenum"
)

// The professor's notes on a problem: what to do ("do c", "also graph the
// solution"), what not to ("no PSpice or MultiSim"), what's changed ("for
// 500 packets, each with 150 bits"). The guide follows them over the book.
// Spec: ideas/professor-notes.md. Copied from the old homework, word for
// word, until the cut-over deletes it.

var (
	// Points are for the grade, not the working: "4 pts each", "(9 pts)".
	notePoints = regexp.MustCompile(`(?i)^\d+\s*(pts?|points?)\.?(\s+each)?$`)
	// A page hint is where to find it, which the finder already used.
	notePage = regexp.MustCompile(`(?i)^(all\s+)?(on|at)\s+(page|pg\.?|p\.)\s*\d+$`)
)

// maxNotes and maxNote bound a question's notes.
const (
	maxNotes = 12
	maxNote  = 300
)

// notesOf is a reference's note as the professor's instructions, one a
// line: a list of short ones split apart ("do c, 6 pts each"), a sentence
// kept whole, the points and page hints left out, and a part the
// reference names ("7c") said plainly.
func notesOf(ref Ref) []string {
	var out []string
	switch parts := strings.Split(ref.Part, ""); {
	case ref.Part == "":
	case len(parts) == 1:
		out = append(out, "Only part ("+ref.Part+").")
	default:
		for i, p := range parts {
			parts[i] = "(" + p + ")"
		}
		out = append(out, "Only parts "+strings.Join(parts[:len(parts)-1], ", ")+" and "+parts[len(parts)-1]+".")
	}
	for _, chunk := range strings.Split(ref.Note, ";") {
		pieces := strings.Split(chunk, ",")
		// A sentence with a comma in it stays one note; a list of short
		// ones splits.
		short := true
		for _, p := range pieces {
			if len(strings.Fields(p)) > 4 {
				short = false
			}
		}
		if !short {
			pieces = []string{chunk}
		}
		for _, p := range pieces {
			p = strings.TrimSpace(strings.TrimRight(strings.TrimSpace(p), "."))
			if p == "" || notePoints.MatchString(p) || notePage.MatchString(p) {
				continue
			}
			out = append(out, p)
		}
	}
	return out
}

// cleanNotes is notes as the student typed them: trimmed, blank lines
// dropped, a list marker taken off, within the caps.
func cleanNotes(lines []string) ([]string, error) {
	out := []string{}
	for _, l := range lines {
		l = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(l), "- "))
		if l == "" {
			continue
		}
		if len([]rune(l)) > maxNote {
			return nil, noteTooLong.New("max", strconv.Itoa(maxNote)).OnField("notes")
		}
		out = append(out, l)
	}
	if len(out) > maxNotes {
		return nil, tooManyNotes.New("max", strconv.Itoa(maxNotes)).OnField("notes")
	}
	return out, nil
}

// runsOf is a line as runs, as the store keeps notes: never null.
func runsOf(s string) []doc.Run {
	runs := doc.Text(strings.TrimSpace(s), pagenum.Map{})
	if runs == nil {
		runs = []doc.Run{}
	}
	return runs
}

// runLists is lines as runs, one list a line.
func runLists(lines []string) [][]doc.Run {
	out := make([][]doc.Run, len(lines))
	for i, l := range lines {
		out[i] = runsOf(l)
	}
	return out
}
