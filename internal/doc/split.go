package doc

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackt/pset/internal/pagenum"
)

// Split turns a string the model wrote into runs. Inline math is
// \(...\) (\[...\] is display). A `$` is money, unless the pandoc rule
// finds it opening and closing math the model wrote anyway: an opening $
// has a non-space after it, a closing $ has a non-space before it and no
// digit after it, and \$ inside math is a dollar sign, not a close. Math
// that is only money ($\$20$) becomes the text "$20". \$ outside math is
// a dollar sign, \textit{..} and \textbf{..} outside math are italic and
// bold, [p. N] is a citation (moved from the printed page to its PDF
// page), and **, * and ` are bold, italic and code.
//
// Split never fails: what it can't read stays as text, and Problems says
// what is left over.
func Split(s string, pages pagenum.Map) []Run {
	toks := tokenize(s, pages)
	pair(toks)
	return runsOf(toks)
}

type tokKind int

const (
	tokText tokKind = iota
	tokMath
	tokCite
	tokMark
)

type tok struct {
	kind tokKind
	s    string // text, TeX, or the marker
	disp bool
	page int
	to   int
	b, i bool
	code bool
	// A marker can open when a non-space follows it, close when one
	// precedes it.
	open, close bool
	paired      bool
}

var cite = regexp.MustCompile(`^\[(pp?)\.\s*(\d+)(?:\s*[–-]\s*(\d+))?\]`)

func isSpace(b byte) bool { return b == ' ' || b == '\t' || b == '\n' || b == '\r' }

func tokenize(s string, pages pagenum.Map) []tok {
	var toks []tok
	var text strings.Builder
	flush := func() {
		if text.Len() > 0 {
			toks = append(toks, tok{kind: tokText, s: text.String()})
			text.Reset()
		}
	}
	for i := 0; i < len(s); {
		c := s[i]
		switch {
		case c == '\\':
			rest := s[i:]
			switch {
			case strings.HasPrefix(rest, `\(`):
				if j := strings.Index(rest[2:], `\)`); j >= 0 {
					flush()
					toks = append(toks, tok{kind: tokMath, s: strings.TrimSpace(rest[2 : 2+j])})
					i += 2 + j + 2
					continue
				}
			case strings.HasPrefix(rest, `\[`):
				if j := strings.Index(rest[2:], `\]`); j >= 0 {
					flush()
					toks = append(toks, tok{kind: tokMath, s: strings.TrimSpace(rest[2 : 2+j]), disp: true})
					i += 2 + j + 2
					continue
				}
			case strings.HasPrefix(rest, `\$`):
				text.WriteByte('$')
				i += 2
				continue
			default:
				for _, cmd := range []struct{ name, flag string }{{`\textit{`, "i"}, {`\emph{`, "i"}, {`\textbf{`, "b"}} {
					if !strings.HasPrefix(rest, cmd.name) {
						continue
					}
					if inner, n, ok := braced(rest[len(cmd.name)-1:]); ok {
						flush()
						sub := tokenize(inner, pages)
						for k := range sub {
							if sub[k].kind == tokText {
								sub[k].b = sub[k].b || cmd.flag == "b"
								sub[k].i = sub[k].i || cmd.flag == "i"
							}
						}
						toks = append(toks, sub...)
						i += len(cmd.name) - 1 + n
						goto next
					}
				}
			}
			text.WriteByte(c)
			i++
		case c == '$':
			if tex, n, disp, ok := dollarMath(s, i); ok {
				flush()
				if money(tex) {
					toks = append(toks, tok{kind: tokText, s: strings.ReplaceAll(strings.TrimSpace(tex), `\$`, "$")})
				} else {
					toks = append(toks, tok{kind: tokMath, s: strings.TrimSpace(tex), disp: disp})
				}
				i += n
				continue
			}
			text.WriteByte(c)
			i++
		case c == '[':
			if m := cite.FindStringSubmatch(s[i:]); m != nil {
				flush()
				a, _ := strconv.Atoi(m[2])
				t := tok{kind: tokCite, page: pages.Nearest(a)}
				if m[3] != "" {
					b, _ := strconv.Atoi(m[3])
					t.to = pages.Nearest(b)
				}
				toks = append(toks, t)
				i += len(m[0])
				continue
			}
			text.WriteByte(c)
			i++
		case c == '`':
			if j := strings.IndexByte(s[i+1:], '`'); j > 0 {
				flush()
				toks = append(toks, tok{kind: tokText, s: s[i+1 : i+1+j], code: true})
				i += j + 2
				continue
			}
			text.WriteByte(c)
			i++
		case c == '*':
			n := 1
			if i+1 < len(s) && s[i+1] == '*' {
				n = 2
			}
			flush()
			t := tok{kind: tokMark, s: s[i : i+n]}
			t.open = i+n < len(s) && !isSpace(s[i+n])
			t.close = i > 0 && !isSpace(s[i-1])
			toks = append(toks, t)
			i += n
		default:
			// Copy a whole rune, so text stays valid UTF-8.
			_, size := utf8.DecodeRuneInString(s[i:])
			text.WriteString(s[i : i+size])
			i += size
		}
		continue
	next:
	}
	flush()
	return toks
}

// braced reads a {...} group at the start of s, nesting counted: its
// inside, and how many bytes it took.
func braced(s string) (string, int, bool) {
	if s == "" || s[0] != '{' {
		return "", 0, false
	}
	depth := 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '\\':
			i++
		case '{':
			depth++
		case '}':
			if depth--; depth == 0 {
				return s[1:i], i + 1, true
			}
		}
	}
	return "", 0, false
}

// dollarMath reads math the model wrote in dollars at s[i], by the
// pandoc rule. n is how many bytes it takes, delimiters included.
func dollarMath(s string, i int) (tex string, n int, disp, ok bool) {
	if strings.HasPrefix(s[i:], "$$") {
		if j := strings.Index(s[i+2:], "$$"); j > 0 {
			return s[i+2 : i+2+j], j + 4, true, true
		}
		// A mistyped close ($$...$): read it as inline math.
		if tex, n, ok := singleDollar(s, i+1); ok {
			return tex, n + 1, true, true
		}
		return "", 0, false, false
	}
	tex, n, ok = singleDollar(s, i)
	return tex, n, false, ok
}

func singleDollar(s string, i int) (string, int, bool) {
	if i+1 >= len(s) || isSpace(s[i+1]) || s[i+1] == '$' {
		return "", 0, false
	}
	for j := i + 1; j < len(s); j++ {
		switch {
		case s[j] == '\\':
			j++
		case s[j] == '$':
			if isSpace(s[j-1]) || (j+1 < len(s) && s[j+1] >= '0' && s[j+1] <= '9') {
				// A dollar sign that can't close the math is one it can't
				// hold either: math has no bare $ ("costs $20 ... $M$" is
				// money, then math).
				return "", 0, false
			}
			return s[i+1 : j], j - i + 1, true
		}
	}
	return "", 0, false
}

var moneyOnly = regexp.MustCompile(`^\$\s?\d[\d,]*(\.\d+)?$`)

// money says math is only a dollar amount: $\$20$, $\$25.42$.
func money(tex string) bool {
	t := strings.TrimSpace(tex)
	if !strings.HasPrefix(t, `\$`) {
		return false
	}
	return moneyOnly.MatchString(strings.ReplaceAll(t, `\$`, "$"))
}

// pair matches ** and * markers into bold and italic, and turns the ones
// left over back into text.
func pair(toks []tok) {
	for a := range toks {
		if toks[a].kind != tokMark || toks[a].paired || !toks[a].open {
			continue
		}
		for b := a + 1; b < len(toks); b++ {
			if toks[b].kind != tokMark || toks[b].paired || !toks[b].close || toks[b].s != toks[a].s {
				continue
			}
			for k := a + 1; k < b; k++ {
				if toks[k].kind == tokText {
					if toks[a].s == "**" {
						toks[k].b = true
					} else {
						toks[k].i = true
					}
				}
			}
			toks[a].paired, toks[b].paired = true, true
			break
		}
	}
	for k := range toks {
		if toks[k].kind == tokMark && !toks[k].paired {
			toks[k].kind = tokText
		}
	}
}

func runsOf(toks []tok) []Run {
	var out []Run
	for _, t := range toks {
		var r Run
		switch t.kind {
		case tokText:
			r = Run{T: t.s, B: t.b, I: t.i, Code: t.code}
			if n := len(out); n > 0 && out[n-1].T != "" && out[n-1].B == r.B && out[n-1].I == r.I && out[n-1].Code == r.Code {
				out[n-1].T += r.T
				continue
			}
		case tokMath:
			r = Run{M: t.s, D: t.disp}
		case tokCite:
			r = Run{Cite: t.page, CiteTo: t.to}
		default:
			continue
		}
		if r.T == "" && r.M == "" && r.Cite == 0 {
			continue
		}
		out = append(out, r)
	}
	return out
}

// Problems is what the split left that cannot render: TeX or a math
// delimiter in plain text (a stray backslash, `\(` with no `\)`).
func Problems(runs []Run) []string {
	var out []string
	for _, r := range runs {
		if r.T == "" || r.Code {
			continue
		}
		if i := strings.IndexByte(r.T, '\\'); i >= 0 {
			out = append(out, fmt.Sprintf("TeX or a math delimiter outside math: %q (math goes in \\( ... \\))", excerpt(r.T, i)))
		}
	}
	return out
}

func excerpt(s string, at int) string {
	rs := []rune(s)
	start := utf8.RuneCountInString(s[:at])
	lo, hi := max(0, start-20), min(len(rs), start+30)
	return string(rs[lo:hi])
}

// Source is runs written back as the model writes them (math in \(..\),
// citations on printed pages): for showing text to the model, or for the
// student to edit.
func Source(runs []Run, pages pagenum.Map) string {
	var b strings.Builder
	for _, r := range runs {
		switch {
		case r.M != "" && r.D:
			b.WriteString(`\[` + r.M + `\]`)
		case r.M != "":
			b.WriteString(`\(` + r.M + `\)`)
		case r.Cite != 0:
			page := func(pdf int) int {
				if n, ok := pages.Printed(pdf); ok {
					return n
				}
				return pdf
			}
			if r.CiteTo != 0 {
				fmt.Fprintf(&b, "[pp. %d–%d]", page(r.Cite), page(r.CiteTo))
			} else {
				fmt.Fprintf(&b, "[p. %d]", page(r.Cite))
			}
		case r.Code:
			b.WriteString("`" + r.T + "`")
		case r.B:
			b.WriteString("**" + r.T + "**")
		case r.I:
			b.WriteString("*" + r.T + "*")
		default:
			b.WriteString(r.T)
		}
	}
	return b.String()
}

// Plain is runs as bare text, math as its TeX: for search and the like.
func Plain(runs []Run) string {
	var b strings.Builder
	for _, r := range runs {
		switch {
		case r.M != "":
			b.WriteString(r.M)
		case r.Cite != 0:
			fmt.Fprintf(&b, "[p. %d]", r.Cite)
		default:
			b.WriteString(r.T)
		}
	}
	return b.String()
}

// Empty is runs with nothing to show.
func Empty(runs []Run) bool {
	for _, r := range runs {
		if r.M != "" || r.Cite != 0 || strings.TrimFunc(r.T, unicode.IsSpace) != "" {
			return false
		}
	}
	return true
}
