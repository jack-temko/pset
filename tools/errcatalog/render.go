package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/errs"
)

// typescript is web/src/api/gen/errors.ts: the ids as a union and every
// entry, for the /errors page and for the errors the web app raises itself.
func typescript(entries []*errs.Entry) string {
	var b strings.Builder
	b.WriteString("// Generated from the error catalog (internal/errs) by tools/errcatalog. Do not edit.\n")
	b.WriteString("import type { Action, Scope } from './errs';\n\n")
	b.WriteString("export type ErrorId =\n")
	for _, e := range entries {
		fmt.Fprintf(&b, "  | %s\n", strconv.Quote(e.ID))
	}
	b.WriteString(";\n\n")
	b.WriteString("export interface CatalogEntry {\n  what: string;\n  why?: string;\n  fix?: string;\n  action?: Action;\n  scope: Scope;\n  status: number;\n  owner: string;\n}\n\n")
	b.WriteString("export const ERRORS: Record<ErrorId, CatalogEntry> = {\n")
	for _, e := range entries {
		fmt.Fprintf(&b, "  %s: {\n", strconv.Quote(e.ID))
		fmt.Fprintf(&b, "    what: %s,\n", strconv.Quote(e.What))
		if e.Why != "" {
			fmt.Fprintf(&b, "    why: %s,\n", strconv.Quote(e.Why))
		}
		if e.Fix != "" {
			fmt.Fprintf(&b, "    fix: %s,\n", strconv.Quote(e.Fix))
		}
		if e.Action != errs.ActionNone {
			fmt.Fprintf(&b, "    action: %s,\n", strconv.Quote(string(e.Action)))
		}
		fmt.Fprintf(&b, "    scope: %s,\n", strconv.Quote(string(e.Scope)))
		fmt.Fprintf(&b, "    status: %d,\n", status(e))
		fmt.Fprintf(&b, "    owner: %s,\n", strconv.Quote(e.Owner))
		b.WriteString("  },\n")
	}
	b.WriteString("};\n")
	return b.String()
}

// status is the status an entry answers with on its own.
func status(e *errs.Entry) int {
	if e.Status != 0 {
		return e.Status
	}
	return 422
}

// markdown is design/errors.md: the table of every entry.
func markdown(entries []*errs.Entry) string {
	var b strings.Builder
	b.WriteString("<!-- Generated from the error catalog (internal/errs) by tools/errcatalog. Do not edit. -->\n\n")
	b.WriteString("# Errors\n\n")
	b.WriteString("Every error PSet can show. An id is stable; the words are read from the catalog when shown. How to add one, and how a chain of errors is composed, is in `design/backend.md`, Errors.\n\n")
	fmt.Fprintf(&b, "%d entries.\n\n", len(entries))
	b.WriteString("| Id | What | Why | Fix | Action | Scope | Owner |\n")
	b.WriteString("|---|---|---|---|---|---|---|\n")
	for _, e := range entries {
		fmt.Fprintf(&b, "| `%s` | %s | %s | %s | %s | %s | %s |\n",
			e.ID, cell(e.What), cell(e.Why), cell(e.Fix), action(e.Action), e.Scope, e.Owner)
	}
	return b.String()
}

func action(a errs.Action) string {
	if a == errs.ActionNone {
		return ""
	}
	return "`" + string(a) + "`"
}

// cell is text safe inside a table cell.
func cell(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "|", `\|`), "\n", " ")
}
