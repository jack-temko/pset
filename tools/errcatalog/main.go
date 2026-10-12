// Command errcatalog writes the error catalog's generated files from the
// entries the packages declare: the TypeScript the web app reads
// (web/src/api/gen/errors.ts) and the table in design/errors.md. `make gen`
// runs it; `make check-gen` fails when the files are stale.
//
// Every package that declares entries is imported below for its side
// effect. A test fails when one is missing.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/jackt/pset/internal/activity"
	_ "github.com/jackt/pset/internal/agent"
	_ "github.com/jackt/pset/internal/ask"
	_ "github.com/jackt/pset/internal/errlog"
	"github.com/jackt/pset/internal/errs"
	_ "github.com/jackt/pset/internal/events"
	_ "github.com/jackt/pset/internal/homework"
	_ "github.com/jackt/pset/internal/httpx"
	_ "github.com/jackt/pset/internal/library"
	_ "github.com/jackt/pset/internal/llm"
	_ "github.com/jackt/pset/internal/memory"
	_ "github.com/jackt/pset/internal/settings"
	_ "github.com/jackt/pset/internal/update"
)

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	entries := errs.All()
	for path, content := range map[string]string{
		filepath.Join(root, "web/src/api/gen/errors.ts"): typescript(entries),
		filepath.Join(root, "design/errors.md"):          markdown(entries),
	} {
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			fmt.Fprintln(os.Stderr, "errcatalog:", err)
			os.Exit(1)
		}
	}
}
