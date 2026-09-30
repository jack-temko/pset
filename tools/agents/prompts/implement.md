You are implementing one task of the spec `{{.Spec}}`. Read the spec's
Information for why and what's decided, then do this task and only this
task:

{{.Task}}

## Rules

- Change the files the task names, their tests, and generated files
  (`make gen` after a `wire.go` change). If it can't be done without
  touching another file, make the smallest change there and say which
  and why in your last message.
- Don't commit, push, switch branches or run the app: the loop commits,
  and Jack checks the UI.
- `make test` has to pass before you finish. A hook runs it when you stop
  and hands you what fails.
{{if .Feedback}}
## This round

Your earlier work on this task is in the tree. Fix exactly these, and
don't change anything else:

{{.Feedback}}
{{end}}
Your last message: what you changed, file by file, and anything the task
left open that you had to decide.
