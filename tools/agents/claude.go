package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Every model runs in Claude Code, headless. The GLM ones reach Z.ai's
// Anthropic-compatible endpoint on the coding plan, with ZAI_API_KEY.
type model struct {
	id  string
	zai bool
}

var models = map[string]model{
	"opus":   {id: "opus"},
	"sonnet": {id: "sonnet"},
	"glm":    {id: "glm-5.3", zai: true},
	"flash":  {id: "glm-5.3-flash", zai: true},
}

// ladder is who a task escalates through, cheapest first. A task that
// fails twice with one model goes to the next, and stops at sonnet: past
// that the spec is the problem, not the implementer. Only a task the spec
// gives to opus is implemented by opus.
var ladder = []string{"flash", "glm", "sonnet", "opus"}

func ladderIndex(m string) (int, bool) {
	for i, l := range ladder {
		if l == m {
			return i, true
		}
	}
	return 0, false
}

const zaiURL = "https://api.z.ai/api/anthropic"

// A role is what a session may do. Everything else is denied without
// asking (dontAsk), since nobody is there to answer.
type role struct {
	allow, deny []string
	schema      string // structured output the session must end with
}

var (
	planner = role{allow: []string{
		"Read", "Grep", "Glob", "Agent", "Edit(ideas/**)", "Write(ideas/**)",
		"Bash(git log *)", "Bash(git show *)", "Bash(git diff *)", "Bash(ls *)",
	}}
	implementer = role{
		allow: []string{
			"Read", "Grep", "Glob", "Edit", "Write",
			"Bash(go *)", "Bash(gofmt *)", "Bash(make *)", "Bash(cd *)",
			"Bash(npx *)", "Bash(npm run *)", "Bash(ls *)",
			"Bash(git diff *)", "Bash(git status *)", "Bash(git log *)", "Bash(git show *)",
		},
		// The loop commits; nobody here serves the app (make dev never exits).
		deny: []string{
			"Bash(git commit *)", "Bash(git push *)", "Bash(git checkout *)", "Bash(git switch *)",
			"Bash(git reset *)", "Bash(git merge *)", "Bash(git rebase *)", "Bash(git stash *)",
			"Bash(make dev *)", "Bash(make dev)", "Bash(npm run dev *)", "Bash(npm run dev)",
			"Bash(go run ./tools/dev *)", "Bash(go run ./tools/dev)", "Bash(make release *)",
		},
	}
	reviewer = role{
		allow: []string{
			"Read", "Grep", "Glob",
			"Bash(git diff *)", "Bash(git log *)", "Bash(git show *)", "Bash(ls *)",
		},
		schema: `{"type":"object","properties":{"findings":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"},"line":{"type":"integer"},"problem":{"type":"string"},"expected":{"type":"string"}},"required":["file","line","problem","expected"]}}},"required":["findings"]}`,
	}
)

type finding struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Problem  string `json:"problem"`
	Expected string `json:"expected"`
}

func (f finding) String() string {
	return fmt.Sprintf("- %s:%d: %s Expected: %s", f.File, f.Line, f.Problem, f.Expected)
}

// result is what `claude -p --output-format json` prints.
type result struct {
	Result     string          `json:"result"`
	IsError    bool            `json:"is_error"`
	SessionID  string          `json:"session_id"`
	Cost       float64         `json:"total_cost_usd"`
	Structured json.RawMessage `json:"structured_output"`
}

// claude runs one headless session in the worktree. Its whole output is
// kept in the logs, and the session can be opened again with
// `claude --resume <id>` from the worktree to see what it did.
func (w *work) claude(name, modelName, prompt string, r role, gated bool) (result, error) {
	m, ok := models[modelName]
	if !ok {
		return result{}, fmt.Errorf("no model %q", modelName)
	}
	args := []string{"-p", prompt, "--model", m.id, "--output-format", "json",
		"--permission-mode", "dontAsk", "--allowedTools", strings.Join(r.allow, ",")}
	if len(r.deny) > 0 {
		args = append(args, "--disallowedTools", strings.Join(r.deny, ","))
	}
	if r.schema != "" {
		args = append(args, "--json-schema", r.schema)
	}
	cmd := exec.Command("claude", args...)
	cmd.Dir = w.dir
	cmd.Stderr = os.Stderr
	env, err := sessionEnv(m, gated)
	if err != nil {
		return result{}, err
	}
	cmd.Env = env

	out, runErr := cmd.Output()
	log := filepath.Join(w.logs, time.Now().Format("0102-150405")+"-"+name+"-"+modelName+".json")
	os.WriteFile(log, out, 0o644)
	var res result
	if err := json.Unmarshal(out, &res); err != nil {
		if runErr != nil {
			return result{}, fmt.Errorf("%s (%s): %w", name, modelName, runErr)
		}
		return result{}, fmt.Errorf("%s (%s): unreadable output, see %s", name, modelName, log)
	}
	if gated {
		// gate.sh's count of failures sent back, left when it gave up.
		os.Remove(filepath.Join(filepath.Dir(w.logs), "gate-"+res.SessionID))
	}
	if res.IsError {
		return res, fmt.Errorf("%s (%s) failed: %s (session %s)", name, modelName, res.Result, res.SessionID)
	}
	if !m.zai {
		w.cost += res.Cost
	}
	return res, nil
}

// sessionEnv is the environment a session runs with: for GLM, Z.ai in
// place of Anthropic, with every model alias pointing at GLM so any
// subagent it starts stays on the coding plan too.
func sessionEnv(m model, gated bool) ([]string, error) {
	var env []string
	for _, kv := range os.Environ() {
		if m.zai && strings.HasPrefix(kv, "ANTHROPIC_") || strings.HasPrefix(kv, "PSET_GATE=") {
			continue
		}
		env = append(env, kv)
	}
	if gated {
		env = append(env, "PSET_GATE=1")
	}
	if m.zai {
		key := os.Getenv("ZAI_API_KEY")
		if key == "" {
			return nil, fmt.Errorf("ZAI_API_KEY isn't set: the GLM models need the coding plan's key (tools/agents/README.md)")
		}
		env = append(env,
			"ANTHROPIC_BASE_URL="+zaiURL,
			"ANTHROPIC_AUTH_TOKEN="+key,
			"ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3",
			"ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.3",
			"ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.3-flash",
			"API_TIMEOUT_MS=3000000",
			"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
		)
	}
	return env, nil
}
