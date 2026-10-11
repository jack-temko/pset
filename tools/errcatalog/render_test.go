package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/errs"
)

// Every entry's sentences are whole sentences with no em dash, and an entry
// that draws a notice says what to do about it: the catalog is what a tired
// student reads.
func TestEntriesAreWrittenForAStudent(t *testing.T) {
	for _, e := range errs.All() {
		for name, text := range map[string]string{"what": e.What, "why": e.Why, "fix": e.Fix} {
			if text == "" {
				continue
			}
			if !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "?") {
				t.Errorf("%s %s does not end in a period: %q", e.ID, name, text)
			}
			if strings.ContainsAny(text, "—–") {
				t.Errorf("%s %s has a dash: %q", e.ID, name, text)
			}
			if strings.Contains(text, "%") || strings.Contains(text, "<") {
				t.Errorf("%s %s has a format verb or markup: %q", e.ID, name, text)
			}
		}
		if e.Scope == errs.ScopeField && (e.Why != "" || e.Fix != "") {
			t.Errorf("%s is a field line and has a why or a fix, which it never shows", e.ID)
		}
		if e.Scope != errs.ScopeField && e.Why == "" && e.Fix == "" && e.ID != "update.no_release" {
			t.Errorf("%s draws a notice and gives neither a why nor a fix", e.ID)
		}
	}
}

// Placeholders in an entry are plain names.
func TestPlaceholdersAreNames(t *testing.T) {
	for _, e := range errs.All() {
		for _, text := range []string{e.What, e.Why, e.Fix} {
			for rest := text; ; {
				i := strings.Index(rest, "{")
				if i < 0 {
					break
				}
				j := strings.Index(rest[i:], "}")
				if j < 0 {
					t.Errorf("%s: unclosed placeholder in %q", e.ID, text)
					break
				}
				name := rest[i+1 : i+j]
				if name == "" || strings.ToLower(name) != name || strings.ContainsAny(name, " .,") {
					t.Errorf("%s: placeholder {%s} in %q", e.ID, name, text)
				}
				rest = rest[i+j:]
			}
		}
	}
}

// Every package that declares entries is imported by the generator, so its
// entries are in the table.
func TestEveryPackageWithEntriesIsImported(t *testing.T) {
	main, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	dirs, err := filepath.Glob("../../internal/*")
	if err != nil {
		t.Fatal(err)
	}
	for _, dir := range dirs {
		files, _ := filepath.Glob(filepath.Join(dir, "*.go"))
		for _, f := range files {
			if strings.HasSuffix(f, "_test.go") {
				continue
			}
			src, err := os.ReadFile(f)
			if err != nil {
				t.Fatal(err)
			}
			pkg := filepath.Base(dir)
			if pkg != "errs" && strings.Contains(string(src), "errs.Define(") && !strings.Contains(string(main), "internal/"+pkg+`"`) {
				t.Errorf("internal/%s declares entries and tools/errcatalog/main.go does not import it", pkg)
			}
		}
	}
}
