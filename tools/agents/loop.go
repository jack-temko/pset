package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// work is one change: its worktree beside the repo, on a branch named for
// it, and a log folder inside .git, where nothing ends up in the repo.
type work struct {
	topic    string
	dir      string // ../pset-<topic>
	spec     string // ideas/<topic>.md, relative to dir
	logs     string // <git common dir>/agents/<topic>
	reviewer string
	cost     float64 // what the Claude sessions cost
}

// roundsPerModel is how many tries a model gets at a task (its first, and
// one to fix what the gate or the review found) before the next one up
// takes over.
const roundsPerModel = 2

func open(topic string, create bool) (*work, error) {
	root, err := git("", "rev-parse", "--show-toplevel")
	if err != nil {
		return nil, err
	}
	common, err := git("", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return nil, err
	}
	w := &work{
		topic: topic,
		dir:   filepath.Join(filepath.Dir(root), "pset-"+topic),
		spec:  "ideas/" + topic + ".md",
		logs:  filepath.Join(common, "agents", topic),
	}
	if _, err := os.Stat(w.dir); os.IsNotExist(err) {
		if !create {
			return nil, fmt.Errorf("no worktree at %s: plan it first", w.dir)
		}
		if _, err := git(root, "worktree", "add", w.dir, "-b", topic, "main"); err != nil {
			return nil, err
		}
	}
	return w, os.MkdirAll(w.logs, 0o755)
}

func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out)), nil
}

func (w *work) make(targets ...string) (string, bool) {
	cmd := exec.Command("make", targets...)
	cmd.Dir = w.dir
	out, err := cmd.CombinedOutput()
	return string(out), err == nil
}

func say(format string, args ...any) { fmt.Printf("• "+format+"\n", args...) }

func (w *work) plan(brief string) error {
	_, err := os.Stat(filepath.Join(w.dir, w.spec))
	exists := err == nil
	say("%s: opus is writing %s", w.topic, w.spec)
	res, err := w.claude("plan", "opus", render("plan.md", map[string]any{
		"Spec": w.spec, "Topic": w.topic, "Brief": brief, "Exists": exists,
	}), planner, false)
	if err != nil {
		return err
	}
	spec, err := os.ReadFile(filepath.Join(w.dir, w.spec))
	if err != nil {
		return fmt.Errorf("opus didn't write %s: %s", w.spec, res.Result)
	}
	if _, err := parseTasks(string(spec)); err != nil {
		return fmt.Errorf("%s: %w (fix it, or plan again)", w.spec, err)
	}
	if _, err := git(w.dir, "add", "ideas"); err != nil {
		return err
	}
	if _, err := git(w.dir, "commit", "-q", "-m", "The spec for "+w.topic+", to build"); err != nil {
		return err
	}
	fmt.Printf("\n%s\n\nRead %s, edit and commit what's wrong, then:\n  go run ./tools/agents build %s\n",
		res.Result, filepath.Join(w.dir, w.spec), w.topic)
	return nil
}

func (w *work) build() error {
	if st, _ := git(w.dir, "status", "--porcelain"); st != "" {
		return fmt.Errorf("%s has uncommitted changes: commit or discard them first", w.dir)
	}
	// A fresh worktree has no node_modules, and make test needs them.
	if out, ok := w.make("web/node_modules"); !ok {
		return fmt.Errorf("npm ci:\n%s", out)
	}
	for {
		spec, err := os.ReadFile(filepath.Join(w.dir, w.spec))
		if err != nil {
			return err
		}
		tasks, err := parseTasks(string(spec))
		if err != nil {
			return fmt.Errorf("%s: %w", w.spec, err)
		}
		next := -1
		for i, t := range tasks {
			if !t.done {
				next = i
				break
			}
		}
		if next < 0 {
			break
		}
		if err := w.task(tasks[next]); err != nil {
			return err
		}
	}
	say("every task is done; %s reviews the whole branch", w.reviewer)
	return w.reviewBranch()
}

// task builds one task: the model the spec names tries it, the gate and
// the reviewer hand back what's wrong, and after roundsPerModel tries the
// next model up takes over from where it got to.
func (w *work) task(t task) error {
	base, err := git(w.dir, "rev-parse", "HEAD")
	if err != nil {
		return err
	}
	start, _ := ladderIndex(t.model)
	top, _ := ladderIndex("sonnet")
	top = max(top, start)
	var feedback string
	var last []finding
	for tier := start; tier <= top; tier++ {
		m := ladder[tier]
		for round := 1; round <= roundsPerModel; round++ {
			say("task %d (%s): %s", t.n, m, map[bool]string{true: "building", false: "fixing"}[feedback == ""])
			name := fmt.Sprintf("task%d-build", t.n)
			if _, err := w.claude(name, m, render("implement.md", map[string]any{
				"Spec": w.spec, "Task": t.block, "Feedback": feedback,
			}), implementer, true); err != nil {
				return err
			}
			changed, err := w.commit(base, t.title)
			if err != nil {
				return err
			}
			if !changed {
				feedback = "Nothing in the tree changed: the task isn't built yet."
				continue
			}
			if out, ok := w.make("check"); !ok {
				say("task %d: make check fails", t.n)
				feedback = "`make check` fails. The end of its output:\n\n" + tail(out, 60)
				continue
			}
			found, err := w.review(t, base, last)
			if err != nil {
				return err
			}
			if len(found) == 0 {
				say("task %d: approved", t.n)
				return w.tick(t)
			}
			say("task %d: %d findings", t.n, len(found))
			feedback, last = list(found), found
		}
		if tier < top {
			say("task %d: %s didn't finish it; %s takes over", t.n, m, ladder[tier+1])
		}
	}
	os.WriteFile(filepath.Join(w.logs, fmt.Sprintf("task%d-left.md", t.n)), []byte(feedback), 0o644)
	return fmt.Errorf("task %d isn't done after %s: what's left is in %s. Rework the task in the spec, or finish it by hand, and build again",
		t.n, ladder[top], filepath.Join(w.logs, fmt.Sprintf("task%d-left.md", t.n)))
}

// commit keeps a task's work as one commit, amended round by round, and
// says whether the task has changed anything since base.
func (w *work) commit(base, title string) (bool, error) {
	if _, err := git(w.dir, "add", "-A"); err != nil {
		return false, err
	}
	head, err := git(w.dir, "rev-parse", "HEAD")
	if err != nil {
		return false, err
	}
	if staged, _ := git(w.dir, "diff", "--cached", "--name-only"); staged != "" {
		args := []string{"commit", "-q", "-m", title}
		if head != base {
			args = append(args, "--amend")
		}
		if _, err := git(w.dir, args...); err != nil {
			return false, err
		}
	}
	diff, err := git(w.dir, "diff", "--name-only", base, "HEAD")
	return diff != "", err
}

func (w *work) tick(t task) error {
	path := filepath.Join(w.dir, w.spec)
	spec, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	ticked, err := tick(string(spec), t.n)
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, []byte(ticked), 0o644); err != nil {
		return err
	}
	if _, err := git(w.dir, "add", w.spec); err != nil {
		return err
	}
	_, err = git(w.dir, "commit", "-q", "--amend", "--no-edit")
	return err
}

func (w *work) review(t task, base string, previous []finding) ([]finding, error) {
	changed, err := git(w.dir, "diff", "--name-only", base, "HEAD")
	if err != nil {
		return nil, err
	}
	say("task %d: %s reviews", t.n, w.reviewer)
	res, err := w.claude(fmt.Sprintf("task%d-review", t.n), w.reviewer, render("review.md", map[string]any{
		"Spec": w.spec, "Task": t.block, "Base": base,
		"Outside":  strings.Join(outside(t, strings.Fields(changed), w.spec), ", "),
		"Previous": list(previous),
	}), reviewer, false)
	if err != nil {
		return nil, err
	}
	return findings(res)
}

func (w *work) reviewBranch() error {
	res, err := w.claude("branch-review", w.reviewer, render("branch-review.md", map[string]any{
		"Spec": w.spec, "Topic": w.topic,
	}), reviewer, false)
	if err != nil {
		return err
	}
	fs, err := findings(res)
	if err != nil {
		return err
	}
	if len(fs) == 0 {
		fmt.Printf("\n%s is ready to merge. Check any UI it changed in the app first (AGENTS.md).\n", w.topic)
		return nil
	}
	path := filepath.Join(w.logs, "branch-review.md")
	os.WriteFile(path, []byte(list(fs)), 0o644)
	fmt.Printf("\n%s\n", list(fs))
	return fmt.Errorf("the branch review found %d things (%s): add tasks for them to the spec and build again, or fix them by hand", len(fs), path)
}

func findings(res result) ([]finding, error) {
	var out struct {
		Findings []finding `json:"findings"`
	}
	if err := json.Unmarshal(res.Structured, &out); err != nil {
		return nil, fmt.Errorf("the review didn't end in findings (session %s): %v", res.SessionID, err)
	}
	return out.Findings, nil
}

func list(fs []finding) string {
	var lines []string
	for _, f := range fs {
		lines = append(lines, f.String())
	}
	return strings.Join(lines, "\n")
}

func tail(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	return strings.Join(lines[max(0, len(lines)-n):], "\n")
}
