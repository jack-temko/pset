package doc

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"unicode"
)

// What a model writes and JSON allows are not quite the same: models write
// \( for \\( inside a string, and a \frac reads as a form feed and "rac".
// lenient reads what they meant.

// lenientObjects reads every JSON object in text, however many, leniently.
// Each comes back as compact JSON. A text that isn't wholly objects gives
// none: it is not JSON, and goes to repair.
func lenientObjects(text string) [][]byte {
	for _, t := range []string{text, escapeControls(doubleBadEscapes(text))} {
		if objs, ok := decodeObjects(t); ok {
			return objs
		}
	}
	return nil
}

// lenientObject is lenientObjects when there is exactly one.
func lenientObject(text string) ([]byte, bool) {
	objs := lenientObjects(text)
	if len(objs) != 1 {
		return nil, false
	}
	return objs[0], true
}

func decodeObjects(text string) ([][]byte, bool) {
	dec := json.NewDecoder(strings.NewReader(text))
	var out [][]byte
	for {
		var v any
		err := dec.Decode(&v)
		if err == io.EOF {
			return out, len(out) > 0
		}
		m, ok := v.(map[string]any)
		if err != nil || !ok {
			return nil, false
		}
		b, _ := json.Marshal(restoreControls("", m))
		out = append(out, b)
	}
}

// doubleBadEscapes doubles every backslash that doesn't start a valid JSON
// escape: \( becomes \\(.
func doubleBadEscapes(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c != '\\' {
			b.WriteByte(c)
			continue
		}
		if i+1 < len(s) {
			switch n := s[i+1]; {
			case strings.IndexByte(`"\/bfnrt`, n) >= 0:
				b.WriteByte(c)
				b.WriteByte(n)
				i++
				continue
			case n == 'u' && i+5 < len(s) && isHex(s[i+2:i+6]):
				b.WriteString(s[i : i+6])
				i += 5
				continue
			}
		}
		b.WriteString(`\\`)
	}
	return b.String()
}

func isHex(s string) bool {
	for _, c := range s {
		if !strings.ContainsRune("0123456789abcdefABCDEF", c) {
			return false
		}
	}
	return len(s) == 4
}

// restoreControls puts back the backslash a JSON escape ate: a control
// character (\b \f \t \r, and \n) followed by letters, in a tex field or
// inside a math run, is a TeX command (\frac read as a form feed and
// "rac"). key is the field it is in.
func restoreControls(key string, v any) any {
	switch v := v.(type) {
	case map[string]any:
		for k, x := range v {
			v[k] = restoreControls(k, x)
		}
		return v
	case []any:
		for i, x := range v {
			v[i] = restoreControls(key, x)
		}
		return v
	case string:
		if key == "tex" {
			return restoreAll(v)
		}
		return restoreInMath(v)
	}
	return v
}

var controls = map[rune]string{'\b': `\b`, '\f': `\f`, '\t': `\t`, '\r': `\r`, '\n': `\n`}

func restoreAll(s string) string {
	rs := []rune(s)
	var b strings.Builder
	for i, r := range rs {
		if bs, ok := controls[r]; ok && i+1 < len(rs) && unicode.IsLetter(rs[i+1]) {
			// A form feed, tab, backspace or carriage return before a letter is
			// always a command. A newline is a command only when it makes a
			// known one (\nu, \neq): a newline in an aligned environment is
			// just a newline.
			if r != '\n' || isNCommand(rs[i+1:]) {
				b.WriteString(bs)
				continue
			}
		}
		b.WriteRune(r)
	}
	return b.String()
}

// nCommands are the TeX commands that begin with n, which a JSON \n
// escape eats the backslash of.
var nCommands = map[string]bool{
	"nu": true, "ne": true, "neq": true, "nabla": true, "not": true, "notin": true, "neg": true, "ni": true,
	"nleq": true, "ngeq": true, "nless": true, "ngtr": true, "nmid": true, "nsim": true, "ncong": true,
	"nparallel": true, "nexists": true, "nrightarrow": true, "nleftarrow": true, "newline": true,
	"normalsize": true, "nolimits": true, "nonumber": true, "natural": true, "nwarrow": true, "nearrow": true,
}

// isNCommand says the letters that follow a newline, with an n in front,
// are a TeX command.
func isNCommand(rest []rune) bool {
	n := 0
	for n < len(rest) && unicode.IsLetter(rest[n]) {
		n++
	}
	return nCommands["n"+string(rest[:n])]
}

func restoreInMath(s string) string {
	if !strings.Contains(s, `\(`) && !strings.Contains(s, `\[`) {
		return s
	}
	var out bytes.Buffer
	for len(s) > 0 {
		i := strings.Index(s, `\(`)
		closer := `\)`
		if j := strings.Index(s, `\[`); j >= 0 && (i < 0 || j < i) {
			i, closer = j, `\]`
		}
		if i < 0 {
			out.WriteString(s)
			break
		}
		out.WriteString(s[:i+2])
		s = s[i+2:]
		end := strings.Index(s, closer)
		if end < 0 {
			out.WriteString(restoreAll(s))
			break
		}
		out.WriteString(restoreAll(s[:end]))
		s = s[end:]
	}
	return out.String()
}

// unfinished says text is an object still being written: a brace still
// open, or a string not yet closed.
func unfinished(text string) bool {
	depth, inString, escaped := 0, false, false
	for i := 0; i < len(text); i++ {
		c := text[i]
		switch {
		case escaped:
			escaped = false
		case inString:
			switch c {
			case '\\':
				escaped = true
			case '"':
				inString = false
			}
		case c == '"':
			inString = true
		case c == '{' || c == '[':
			depth++
		case c == '}' || c == ']':
			depth--
		}
	}
	return depth > 0 || inString
}

// escapeControls escapes a raw newline or tab inside a string, which JSON
// forbids and a model writing a long text field does now and then.
func escapeControls(s string) string {
	var b strings.Builder
	inString, escaped := false, false
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case escaped:
			escaped = false
		case inString && c == '\\':
			escaped = true
		case c == '"':
			inString = !inString
		case inString && c == '\n':
			b.WriteString(`\n`)
			continue
		case inString && c == '\t':
			b.WriteString(`\t`)
			continue
		case inString && c == '\r':
			continue
		}
		b.WriteByte(c)
	}
	return b.String()
}
