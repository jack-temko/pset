package mathx

import (
	"fmt"
	"math/big"
	"strings"
	"unicode"
)

type tokenKind int

const (
	tokEOF tokenKind = iota
	tokNumber
	tokIdent
	tokOp
)

type token struct {
	kind tokenKind
	text string
	num  *big.Rat // tokNumber
	imag bool     // a j-prefixed number literal such as j6
}

// opRunes are the single-rune operators; opWords are lookalike glyphs the
// model emits often enough to deserve silent translation.
var opRunes = "+-*/^(),∠°"

func lex(src string) ([]token, error) {
	if len(src) > maxExprChars {
		return nil, fmt.Errorf("the expression is longer than %d characters", maxExprChars)
	}
	runes := []rune(strings.TrimSpace(src))
	var out []token
	i := 0
	readNumber := func(start int) (*big.Rat, int, error) {
		j := start
		for j < len(runes) && unicode.IsDigit(runes[j]) {
			j++
		}
		if j < len(runes) && runes[j] == '.' {
			j++
			for j < len(runes) && unicode.IsDigit(runes[j]) {
				j++
			}
		}
		if j < len(runes) && (runes[j] == 'e' || runes[j] == 'E') {
			k := j + 1
			if k < len(runes) && (runes[k] == '+' || runes[k] == '-') {
				k++
			}
			if k < len(runes) && unicode.IsDigit(runes[k]) {
				for k < len(runes) && unicode.IsDigit(runes[k]) {
					k++
				}
				j = k
			}
		}
		r, ok := new(big.Rat).SetString(string(runes[start:j]))
		if !ok {
			return nil, start, fmt.Errorf("%q is not a number", string(runes[start:j]))
		}
		return r, j, nil
	}
	for i < len(runes) {
		r := runes[i]
		switch {
		case unicode.IsSpace(r):
			i++
		case unicode.IsDigit(r) || (r == '.' && i+1 < len(runes) && unicode.IsDigit(runes[i+1])):
			num, next, err := readNumber(i)
			if err != nil {
				return nil, err
			}
			out = append(out, token{kind: tokNumber, text: formatToken(num, false), num: num})
			i = next
		case unicode.IsLetter(r) || r == '_':
			// "j6" / "i6": the imaginary unit fused to its magnitude. The
			// identifier scanner would otherwise swallow the digits into a
			// name, so the fused form is checked before scanning.
			if (r == 'j' || r == 'i') && i+1 < len(runes) &&
				(unicode.IsDigit(runes[i+1]) || (runes[i+1] == '.' && i+2 < len(runes) && unicode.IsDigit(runes[i+2]))) {
				num, next, err := readNumber(i + 1)
				if err != nil {
					return nil, err
				}
				out = append(out, token{kind: tokNumber, text: formatToken(num, true), num: num, imag: true})
				i = next
				continue
			}
			j := i
			for j < len(runes) && (unicode.IsLetter(runes[j]) || runes[j] == '_' || unicode.IsDigit(runes[j])) {
				j++
			}
			name := string(runes[i:j])
			out = append(out, token{kind: tokIdent, text: normalizeName(name)})
			i = j
		case strings.ContainsRune(opRunes, r):
			out = append(out, token{kind: tokOp, text: string(r)})
			i++
		case r == '−' || r == '–': // unicode minus and en-dash
			out = append(out, token{kind: tokOp, text: "-"})
			i++
		case r == '×':
			out = append(out, token{kind: tokOp, text: "*"})
			i++
		case r == '÷':
			out = append(out, token{kind: tokOp, text: "/"})
			i++
		case r == '·':
			out = append(out, token{kind: tokOp, text: "*"})
			i++
		default:
			return nil, fmt.Errorf("the character %q is not valid in an expression", string(r))
		}
	}
	return append(out, token{kind: tokEOF}), nil
}

// normalizeName folds near-synonyms onto canonical identifiers.
func normalizeName(name string) string {
	switch strings.ToLower(name) {
	case "π":
		return "pi"
	default:
		return strings.ToLower(name)
	}
}

func formatToken(num *big.Rat, imag bool) string {
	if imag {
		return num.RatString() + "j"
	}
	return num.RatString()
}
