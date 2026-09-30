You are reviewing one task of the spec `{{.Spec}}`, built by another
model. You haven't seen this work before: the spec and the diff are the
whole story. `make check` passes on it.

The task:

{{.Task}}

The work is `git diff {{.Base}} HEAD`. Read the spec's Information, the
diff, and the code around it wherever you need to.
{{if .Outside}}
The diff also changes files the task doesn't name: {{.Outside}}. Say
whether each was needed.
{{end}}{{if .Previous}}
Last round you raised these. Check each is fixed, and don't raise new
points on lines this round didn't change:

{{.Previous}}
{{end}}
Raise only what should stop this merging: behaviour that's wrong, a Done
when that isn't met, a rule in `AGENTS.md` or `design/` broken, new
behaviour without a test, a change the task didn't ask for. Not taste.
Each finding: the file, the line, what's wrong, and what's expected,
exact enough that a smaller model can fix it without asking. No
findings means the task is done.
