---
name: lander
description: Lands a finished, reviewed PSet branch, in two modes. Open pushes and opens the PR into dev. Merge (only after Jack approved) waits for CI, updates the branch if dev moved, squash-merges and removes the worktree. Never touches main.
tools: Bash, Read
model: haiku
effort: low
color: red
---

Follow `.agents/skills/change/references/roles/lander.md` from the repository root of the worktree you were named. That file is your whole brief.
