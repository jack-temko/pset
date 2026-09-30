// Command agents runs the model team on one change, in its own worktree:
// Opus writes the spec, the cheapest model that can do each task builds
// it, and a fresh reviewer checks every task against the spec before the
// next one starts. What holds the work together is files and gates, not
// shared context: the spec in ideas/, `make test` as a Stop hook
// (gate.sh), `make check` after every round, and findings precise enough
// for a smaller model to act on. tools/agents/README.md has the roles and
// the setup.
package main

import (
	"embed"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
	"text/template"
)

//go:embed prompts
var promptFS embed.FS

var prompts = template.Must(template.ParseFS(promptFS, "prompts/*.md"))

var topicName = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

const usage = `usage:
  go run ./tools/agents plan <topic> <brief...>    Opus writes ideas/<topic>.md in ../pset-<topic>
  go run ./tools/agents build [-reviewer sonnet] <topic>
                                                  builds the spec's open tasks, each one reviewed
  go run ./tools/agents review [-reviewer sonnet] <topic>
                                                  reviews the whole branch against its spec
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	fs := flag.NewFlagSet(os.Args[1], flag.ExitOnError)
	fs.Usage = func() { fmt.Fprint(os.Stderr, usage) }
	reviewerModel := fs.String("reviewer", "opus", "who reviews: opus, or sonnet for a routine change")
	fs.Parse(os.Args[2:])
	if fs.NArg() < 1 || !topicName.MatchString(fs.Arg(0)) {
		fmt.Fprint(os.Stderr, "agents: the topic is kebab-case, named for what the change does\n", usage)
		os.Exit(2)
	}
	if _, ok := models[*reviewerModel]; !ok || models[*reviewerModel].zai {
		fmt.Fprintln(os.Stderr, "agents: the reviewer is opus or sonnet")
		os.Exit(2)
	}

	topic := fs.Arg(0)
	w, err := open(topic, os.Args[1] == "plan")
	if err == nil {
		w.reviewer = *reviewerModel
		switch os.Args[1] {
		case "plan":
			if fs.NArg() < 2 {
				fmt.Fprint(os.Stderr, usage)
				os.Exit(2)
			}
			err = w.plan(strings.Join(fs.Args()[1:], " "))
		case "build":
			err = w.build()
		case "review":
			err = w.reviewBranch()
		default:
			fmt.Fprint(os.Stderr, usage)
			os.Exit(2)
		}
	}
	if w != nil && w.cost > 0 {
		fmt.Printf("Claude spend this run: $%.2f (GLM runs on the coding plan, not counted)\n", w.cost)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "agents:", err)
		os.Exit(1)
	}
}

func render(name string, data any) string {
	var b strings.Builder
	if err := prompts.ExecuteTemplate(&b, name, data); err != nil {
		panic(err)
	}
	return b.String()
}
