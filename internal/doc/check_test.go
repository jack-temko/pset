package doc

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestMathError(t *testing.T) {
	good := []string{`x^2 + y^2`, `\frac{1}{2}(10.85)`, `\int_0^2 f(b)\,db = \tfrac{11}{6}`, `\$25.42`, `\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`, `\ \dots`}
	for _, g := range good {
		if msg := MathError(g, false); msg != "" {
			t.Errorf("%q: %s", g, msg)
		}
	}
	bad := map[string]string{
		`\tfrac{1}{2}(10.85) \approx \`: "KaTeX parse error",
		`\notacommand{x}`:               "Undefined control sequence",
		`\frac{1}{`:                     "KaTeX parse error",
	}
	for tex, want := range bad {
		if msg := MathError(tex, false); !strings.Contains(msg, want) {
			t.Errorf("%q: got %q, want it to contain %q", tex, msg, want)
		}
	}
	// Display-only environments fail inline, and pass as a block.
	if MathError(`\begin{aligned} a &= b \end{aligned}`, true) != "" {
		t.Error("aligned should render as a block")
	}
}

// The embedded check and the web app must run the same KaTeX: package.json
// pins the version, and the bundle says which it holds. After changing
// either, run `npm run build:check` in web/.
func TestEmbeddedKatexIsThePinnedOne(t *testing.T) {
	raw, err := os.ReadFile("../../web/package.json")
	if err != nil {
		t.Fatal(err)
	}
	var pkg struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(raw, &pkg); err != nil {
		t.Fatal(err)
	}
	pinned := pkg.Dependencies["katex"]
	if pinned == "" || strings.ContainsAny(pinned, "^~<>=*x") {
		t.Fatalf("web/package.json must pin katex to one version, has %q", pinned)
	}
	got, err := KatexVersion()
	if err != nil {
		t.Fatal(err)
	}
	if got != pinned {
		t.Fatalf("the embedded check runs KaTeX %s, web/package.json pins %s: run `npm run build:check` in web/", got, pinned)
	}
}
