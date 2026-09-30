package main

import (
	"reflect"
	"strings"
	"testing"
)

const sample = `# Something

## Status

**In progress** on branch ` + "`something`" + `.

- [ ] 9. (glm) Not a task: not under Tasks

## Tasks

- [x] 1. (flash) Rename the thing
  - Files: ` + "`internal/a/a.go`, `internal/a/a_test.go`" + `
  - Do: rename it.

- [ ] 2. (sonnet) The wire type carries the thing
  - Files: ` + "`internal/b/wire.go`" + `
  - Done when: ` + "`go test ./internal/b`" + ` passes.
Not indented: ends the task.

## Notes

- [ ] 3. (glm) Not a task either
`

func TestParseTasks(t *testing.T) {
	tasks, err := parseTasks(sample)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("got %d tasks, want 2: %+v", len(tasks), tasks)
	}
	a, b := tasks[0], tasks[1]
	if a.n != 1 || a.model != "flash" || !a.done || a.title != "Rename the thing" {
		t.Errorf("task 1 = %+v", a)
	}
	if !reflect.DeepEqual(a.files, []string{"internal/a/a.go", "internal/a/a_test.go"}) {
		t.Errorf("task 1 files = %q", a.files)
	}
	if b.n != 2 || b.model != "sonnet" || b.done {
		t.Errorf("task 2 = %+v", b)
	}
	if !reflect.DeepEqual(b.files, []string{"internal/b/wire.go"}) {
		t.Errorf("task 2 files = %q (the Done when's backticks aren't files)", b.files)
	}
	if strings.Contains(b.block, "Not indented") || !strings.HasSuffix(b.block, "passes.") {
		t.Errorf("task 2 block = %q", b.block)
	}
}

func TestParseTasksRejects(t *testing.T) {
	for name, spec := range map[string]string{
		"no tasks":    "# X\n\n## Tasks\n\nNothing yet.\n",
		"bad model":   "## Tasks\n\n- [ ] 1. (gpt) Do it\n",
		"same number": "## Tasks\n\n- [ ] 1. (glm) A\n- [ ] 1. (glm) B\n",
	} {
		if _, err := parseTasks(spec); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
}

func TestTick(t *testing.T) {
	got, err := tick(sample, 2)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "- [x] 2. (sonnet) The wire type") {
		t.Errorf("task 2 not ticked:\n%s", got)
	}
	if !strings.Contains(got, "- [ ] 3. (glm)") || !strings.Contains(got, "- [ ] 9. (glm)") {
		t.Errorf("ticked more than task 2:\n%s", got)
	}
	if _, err := tick(sample, 7); err == nil {
		t.Error("ticked a task that isn't there")
	}
}

func TestOutside(t *testing.T) {
	tasks, _ := parseTasks(sample)
	got := outside(tasks[1], []string{
		"internal/b/wire.go", "web/src/api/gen/b.ts", "ideas/something.md", "internal/c/c.go",
	}, "ideas/something.md")
	if !reflect.DeepEqual(got, []string{"internal/c/c.go"}) {
		t.Errorf("outside = %q", got)
	}
}

func TestPromptsRender(t *testing.T) {
	for _, name := range []string{"plan.md", "implement.md", "review.md", "branch-review.md"} {
		out := render(name, map[string]any{
			"Spec": "ideas/x.md", "Topic": "x", "Brief": "b", "Exists": false,
			"Task": "- [ ] 1. (glm) T", "Feedback": "", "Base": "abc", "Outside": "", "Previous": "",
		})
		if strings.Contains(out, "<no value>") || strings.Contains(out, "\u2014") {
			t.Errorf("%s renders a gap or an em dash:\n%s", name, out)
		}
	}
}
