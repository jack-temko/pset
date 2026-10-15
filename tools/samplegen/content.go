package main

import (
	"fmt"
	"strings"
)

// para is one drawn paragraph. A paragraph with a non-empty factID plants a
// manifest fact; its verbatim text is the paragraph text.
type para struct {
	text   string
	factID string
}

type chapter struct {
	title string
	paras []para
}

// outlineEntry is one PDF bookmark. Level follows fpdf: 0 is the top level,
// each nesting step adds one. The bookmark lands on the page of its chapter.
type outlineEntry struct {
	title   string
	chapter int
	level   int
	factID  string
}

type digitalSpecT struct {
	title    string
	subtitle string
	author   string
	subject  string
	chapters []chapter
}

// flatPage is one physical page of the flat book. A non-empty heading is
// drawn oversized (the only oversized lines in the book); pages without one
// prove the classifier keeps body-only pages out.
type flatPage struct {
	heading string
	paras   []para
}

// flatSpecT describes a book with no bookmarks: uniform body text whose only
// oversized short lines are the planted section headings, so the engine's
// inference path fires and finds exactly those.
type flatSpecT struct {
	title  string
	author string
	pages  []flatPage
}

type scannedSpecT struct {
	title    string
	subtitle string
	author   string
	chapters []chapter
}

// All content is invented; ASCII only (fpdf core fonts are latin-1 and the
// manifest is matched against extracted text after whitespace normalisation).

var digitalSpec = digitalSpecT{
	title:    "Foundations of Brontolithics",
	subtitle: "An Introduction to Engineered Thunder",
	author:   "H. Marlowe Voss",
	subject:  "Brontolithics: engineered thunder, kettle arrays, and the Voss Register",
	chapters: []chapter{
		{
			title: "What Is Brontolithics?",
			paras: []para{
				{text: "Brontolithics is the study of engineered thunder: thunder that is made on purpose, in copper kettles, by trained operators called ringers. The first kettle was rung on the shores of Lake Vair in 1908, and the trade has kept a written register ever since."},
				{text: "The Voss Register of 1912 catalogued 34 storm families across the Mirefill Basin.", factID: "F1"},
				{text: "Practitioners call a single manufactured clap a gavel, from the old Vairic word gavvel.", factID: "F2"},
			},
		},
		{
			title: "The Kettle Array",
			paras: []para{
				{text: "A kettle is a copper vessel half-sunk in calm water. When its collar ring is struck in the right cadence, the surface compresses the air below and a gavel rolls out across the sky."},
				{text: "Every kettle carries a call sign stamped on its collar, such as KAX-4471, and no two kettles may share a sign.", factID: "F3"},
				{text: "Station Umbel-7 on Lake Vair runs 12 kettles at a mooring depth of 40 fathoms.", factID: "F4"},
				{text: "A collar must be re-silvered every 82 days; ringers call the chore silverpoint and chalk it above the bell shed.", factID: "F5"},
			},
		},
		{
			title: "Measuring a Storm",
			paras: []para{
				{text: "Loudness, duration, and temper are the three measures of a storm family. Loudness is the one that matters to the Register, because a storm that cannot be heard cannot be sworn to."},
				{text: "Loudness is measured in karsts, and a healthy gavel reads 0.37 karsts on the collar meter.", factID: "F6"},
				{text: "The karst scale was fixed by Dr. Odile Prane at the Ninth Concord of 1954 and has not changed since.", factID: "F7"},
				{text: "A storm family is called settled once it has gone 19 days without an echo.", factID: "F8"},
			},
		},
		{
			title: "Safety and Ethics",
			paras: []para{
				{text: "Ringing is regulated work. Every station keeps a copy of the Concord Rules bolted inside the shed door, and the rules are short enough to read in one sitting."},
				{text: "Rule 9 forbids kettle work within 3 leagues of a heronry during nesting season.", factID: "F9"},
				{text: "Every gavel must be filed on a TVR-09 slip and countersigned by a second ringer.", factID: "F10"},
				{text: "The deepest gavel on record came from Vair-Deep 5, at 212 fathoms, on 17 October 1961.", factID: "F11"},
				{text: "Apprentices end each day by speaking the closing words of the Oath: quiet skies, loud learning.", factID: "F12"},
			},
		},
	},
}

// digitalOutline plants the PDF bookmarks: one top-level entry per chapter
// (titles matching the TOC page) plus nested sub-entries on chapter pages.
// The interleaving of items and nested levels exercises document-order
// parsing; stored manifest levels are 1-based (fpdf level + 1).
var digitalOutline = []outlineEntry{
	{title: "What Is Brontolithics?", chapter: 0, level: 0, factID: "O1"},
	{title: "The Voss Register", chapter: 0, level: 1, factID: "O2"},
	{title: "The Kettle Array", chapter: 1, level: 0, factID: "O3"},
	{title: "Measuring a Storm", chapter: 2, level: 0, factID: "O4"},
	{title: "Karsts and the Collar Meter", chapter: 2, level: 1, factID: "O5"},
	{title: "Safety and Ethics", chapter: 3, level: 0, factID: "O6"},
}

var flatSpec = flatSpecT{
	title:  "Field Notes on Kettle Weather",
	author: "Odile Prane",
	pages: []flatPage{
		{
			heading: "Reading the Sky",
			paras: []para{
				{text: "A steady east wind means the collars will sing flat, and every ringer learns to read the sky before touching a striker.", factID: "T1"},
				{text: "Cloud bases below 600 feet sharpen a gavel; above 1,200 feet the sound spreads and loses its edge.", factID: "T2"},
			},
		},
		{
			paras: []para{
				{text: "The Register recommends waiting out a sandstorm entirely; a gritty gavel is a broken kettle.", factID: "T3"},
				{text: "Fog is kinder: a gavel rung into fog carries twice as far and loses none of its temper."},
			},
		},
		{
			heading: "Collar Maintenance",
			paras: []para{
				{text: "A collar cleaned at every silverpoint lasts a full season; one that is skipped cracks along the striking ridge.", factID: "T4"},
				{text: "Ringers polish with soft wool only, never with the abrasive pads sold at the harbor stalls.", factID: "T5"},
				{text: "A collar crack is called a whisper line, and any kettle with one is moored apart until re-silvered.", factID: "T6"},
			},
		},
		{
			heading: "Winter Silence",
			paras: []para{
				{text: "When the lake freezes the kettles fall silent, and the sheds turn to mending nets and copying the Register.", factID: "T7"},
				{text: "The silence ends on the first open-water dawn, when the oldest ringer strikes the welcome gavel.", factID: "T8"},
			},
		},
	},
}

var scannedSpec = scannedSpecT{
	title:    "A Little Primer of Brontolithics",
	subtitle: "For the Station Schools",
	author:   "Odile Prane",
	chapters: []chapter{
		{
			title: "A First Gavel",
			paras: []para{
				{text: "This primer was printed for the station school at Umbel-7 in the winter of 1963.", factID: "S1"},
				{text: "Hold the striker flat and strike the collar ring three times, evenly. If the water sings, you were too gentle; if the shed rattles, you were too rough."},
				{text: "A first-year apprentice is expected to ring a clean gavel within 40 tries.", factID: "S2"},
			},
		},
		{
			title: "Reading the Register",
			paras: []para{
				{text: "The Register is the memory of the trade. Every gavel has a line in it, and every line has a slip behind it."},
				{text: "Gavel slips use the TVR-09 form, one slip per gavel, filed by storm family.", factID: "S3"},
				{text: "By the winter of 1971 the Register held 4,006 gavels.", factID: "S4"},
			},
		},
		{
			title: "The Families of Lake Vair",
			paras: []para{
				{text: "A storm family is a group of echoes that return each winter to the same water. Ringers know them the way farmers know fields."},
				{text: "Lake Vair freezes for 55 nights each year, and while it freezes the kettles fall silent.", factID: "S5"},
				{text: "The oldest family, Brontide, has returned every winter since 1908.", factID: "S6"},
			},
		},
		{
			title: "The Oath",
			paras: []para{
				{text: "On the last day of apprenticeship the new ringer stands at the shed door and repeats the Oath after the station master."},
				{text: "The Oath ends with six words: quiet skies, loud learning.", factID: "S7"},
				{text: "A ringer may take the Oath only in sight of open water, with one hand on the collar of the oldest kettle at the station.", factID: "S8"},
			},
		},
	},
}

// chapterPage returns the 1-based physical page of chapter i: page 1 is the
// title page, page 2 the table of contents, chapters follow from page 3.
func chapterPage(i int) int { return 3 + i }

func digitalFacts(spec digitalSpecT) []Fact {
	var facts []Fact
	for i, ch := range spec.chapters {
		for _, p := range ch.paras {
			if p.factID != "" {
				facts = append(facts, Fact{ID: p.factID, Text: p.text, Page: chapterPage(i)})
			}
		}
	}
	return facts
}

// digitalOutlineFacts records the planted bookmarks. Level is 1-based, the
// form the engine stores; the generator itself uses fpdf's 0-based levels.
func digitalOutlineFacts() []Heading {
	var out []Heading
	for _, en := range digitalOutline {
		out = append(out, Heading{
			ID:    en.factID,
			Title: en.title,
			Page:  chapterPage(en.chapter),
			Level: en.level + 1,
		})
	}
	return out
}

func flatFacts(spec flatSpecT) []Fact {
	var facts []Fact
	for i, page := range spec.pages {
		for _, p := range page.paras {
			if p.factID != "" {
				facts = append(facts, Fact{ID: p.factID, Text: p.text, Page: i + 1})
			}
		}
	}
	return facts
}

func flatHeadings(spec flatSpecT) []Heading {
	var out []Heading
	for i, page := range spec.pages {
		if page.heading != "" {
			out = append(out, Heading{ID: headingID(i), Title: page.heading, Page: i + 1, Level: 1})
		}
	}
	return out
}

// headingID numbers the flat book's planted headings H1..Hn in page order.
func headingID(i int) string { return fmt.Sprintf("H%d", i+1) }

func scannedFacts(spec scannedSpecT) []Fact {
	var facts []Fact
	for i, ch := range spec.chapters {
		for _, p := range ch.paras {
			if p.factID != "" {
				facts = append(facts, Fact{ID: p.factID, Text: p.text, Page: chapterPage(i)})
			}
		}
	}
	return facts
}

func countWords(chapters []chapter) int {
	n := 0
	for _, ch := range chapters {
		n += len(strings.Fields(ch.title))
		for _, p := range ch.paras {
			n += len(strings.Fields(p.text))
		}
	}
	return n
}

func countFlatWords(spec flatSpecT) int {
	n := 0
	for _, page := range spec.pages {
		if page.heading != "" {
			n += len(strings.Fields(page.heading))
		}
		for _, p := range page.paras {
			n += len(strings.Fields(p.text))
		}
	}
	return n
}
