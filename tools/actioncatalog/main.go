// Command actioncatalog writes the action catalog's generated files from
// the actions the features declare (internal/backend): the TypeScript the
// web app reads (web/src/api/gen/actions.ts) and the table in
// design/actions.md, which is where each action's key is corrected. `make
// gen` runs it; `make check-gen` fails when the files are stale.
package main

import (
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/backend"
)

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	c := backend.New(nil, nil).Actions
	entries := c.Entries()
	for path, content := range map[string]string{
		filepath.Join(root, "web/src/api/gen/actions.ts"): typescript(entries, c.Inputs()),
		filepath.Join(root, "design/actions.md"):          markdown(entries),
	} {
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			fmt.Fprintln(os.Stderr, "actioncatalog:", err)
			os.Exit(1)
		}
	}
}

// typescript is the ids as a union, every entry, for the palette, the keys
// and the buttons, and each action's input type, so running one is typed.
func typescript(entries []action.Entry, inputs map[string]action.Input) string {
	var b strings.Builder
	b.WriteString("// Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit.\n")
	b.WriteString("import type { Entry } from './action';\n")
	pkgs := map[string]bool{}
	for _, in := range inputs {
		if in.Name != "" {
			pkgs[in.Package] = true
		}
	}
	for _, p := range slices.Sorted(maps.Keys(pkgs)) {
		fmt.Fprintf(&b, "import type * as %s from './%s';\n", p, p)
	}
	b.WriteString("\n")
	b.WriteString("export type ActionId =\n")
	for _, e := range entries {
		fmt.Fprintf(&b, "  | %s\n", strconv.Quote(e.ID))
	}
	if len(entries) == 0 {
		b.WriteString("  never\n")
	}
	b.WriteString(";\n\n")
	b.WriteString("export const ACTIONS: Record<ActionId, Entry> = {\n")
	for _, e := range entries {
		fmt.Fprintf(&b, "  %s: {\n", strconv.Quote(e.ID))
		fmt.Fprintf(&b, "    id: %s,\n", strconv.Quote(e.ID))
		fmt.Fprintf(&b, "    name: %s,\n", strconv.Quote(e.Name))
		if e.Key != "" {
			fmt.Fprintf(&b, "    key: %s,\n", strconv.Quote(e.Key))
		}
		needs := make([]string, len(e.Needs))
		for i, n := range e.Needs {
			needs[i] = strconv.Quote(string(n))
		}
		fmt.Fprintf(&b, "    needs: [%s],\n", strings.Join(needs, ", "))
		fmt.Fprintf(&b, "    undoable: %t,\n", e.Undoable)
		fmt.Fprintf(&b, "    costs: %t,\n", e.Costs)
		b.WriteString("  },\n")
	}
	b.WriteString("};\n\n")
	b.WriteString("// What each action takes: the body of POST /api/actions/{id}.\n")
	b.WriteString("export interface ActionInputs {\n")
	for _, e := range entries {
		in := inputs[e.ID]
		t := "Record<string, never>"
		if in.Name != "" {
			t = in.Package + "." + in.Name
		}
		fmt.Fprintf(&b, "  %s: %s;\n", strconv.Quote(e.ID), t)
	}
	b.WriteString("}\n")
	return b.String()
}

// markdown is the table of every action.
func markdown(entries []action.Entry) string {
	var b strings.Builder
	b.WriteString("<!-- Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit. -->\n\n")
	b.WriteString("# Actions\n\n")
	b.WriteString("Everything a student can do, as the catalog declares it. Each runs through `POST /api/actions/{id}`; the undoable ones are taken back by `POST /api/undo`. A key is corrected in the action's declaration, and this table follows.\n\n")
	fmt.Fprintf(&b, "%d actions.\n\n", len(entries))
	b.WriteString("| Id | Name | Key | Needs | Undoable | Costs |\n")
	b.WriteString("|---|---|---|---|---|---|\n")
	for _, e := range entries {
		key := ""
		if e.Key != "" {
			key = "`" + e.Key + "`"
		}
		needs := make([]string, len(e.Needs))
		for i, n := range e.Needs {
			needs[i] = "`" + string(n) + "`"
		}
		fmt.Fprintf(&b, "| `%s` | %s | %s | %s | %s | %s |\n", e.ID, e.Name, key, strings.Join(needs, ", "), yes(e.Undoable), yes(e.Costs))
	}
	return b.String()
}

func yes(b bool) string {
	if b {
		return "yes"
	}
	return ""
}
