package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// A task is one checklist item under a spec's "## Tasks", in the format
// ideas/README.md gives: "- [ ] 2. (glm) What it does", then its Files,
// Do and Done when as indented lines.
type task struct {
	n     int
	model string // who implements it first: flash, glm, sonnet or opus
	title string
	done  bool
	block string   // the item and its indented lines, as the spec has them
	files []string // the paths its Files line names
}

var (
	taskLine = regexp.MustCompile(`^- \[([ x])\] (\d+)\. \(([a-z]+)\) (.+)$`)
	quoted   = regexp.MustCompile("`([^`]+)`")
)

// parseTasks reads the tasks from a spec's "## Tasks" section.
func parseTasks(spec string) ([]task, error) {
	var tasks []task
	var cur *task
	in := false
	end := func() {
		if cur != nil {
			cur.block = strings.TrimRight(cur.block, "\n")
			tasks = append(tasks, *cur)
			cur = nil
		}
	}
	for _, line := range strings.Split(spec, "\n") {
		if strings.HasPrefix(line, "#") {
			end()
			in = strings.TrimSpace(strings.TrimLeft(line, "#")) == "Tasks" && strings.HasPrefix(line, "## ")
			continue
		}
		if !in {
			continue
		}
		if m := taskLine.FindStringSubmatch(line); m != nil {
			end()
			n, _ := strconv.Atoi(m[2])
			if _, ok := ladderIndex(m[3]); !ok {
				return nil, fmt.Errorf("task %d: %q isn't a model (flash, glm, sonnet or opus)", n, m[3])
			}
			cur = &task{n: n, model: m[3], title: m[4], done: m[1] == "x", block: line + "\n"}
			continue
		}
		if cur == nil {
			continue
		}
		if line != "" && line[0] != ' ' && line[0] != '\t' {
			end()
			continue
		}
		cur.block += line + "\n"
		if strings.Contains(line, "Files:") {
			for _, m := range quoted.FindAllStringSubmatch(line, -1) {
				cur.files = append(cur.files, m[1])
			}
		}
	}
	end()
	if len(tasks) == 0 {
		return nil, fmt.Errorf("no tasks under \"## Tasks\"")
	}
	seen := map[int]bool{}
	for _, t := range tasks {
		if seen[t.n] {
			return nil, fmt.Errorf("two tasks numbered %d", t.n)
		}
		seen[t.n] = true
	}
	return tasks, nil
}

// tick checks task n off in the spec.
func tick(spec string, n int) (string, error) {
	lines := strings.Split(spec, "\n")
	for i, line := range lines {
		if m := taskLine.FindStringSubmatch(line); m != nil && m[2] == strconv.Itoa(n) {
			lines[i] = "- [x]" + line[len("- [ ]"):]
			return strings.Join(lines, "\n"), nil
		}
	}
	return "", fmt.Errorf("no task %d to tick", n)
}

// outside is what a task changed beyond the files it names, leaving out
// what's always fine to touch: generated TS types and the spec itself.
func outside(t task, changed []string, spec string) []string {
	named := map[string]bool{spec: true}
	for _, f := range t.files {
		named[f] = true
	}
	var out []string
	for _, f := range changed {
		if !named[f] && !strings.HasPrefix(f, "web/src/api/gen/") {
			out = append(out, f)
		}
	}
	return out
}
