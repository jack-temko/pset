---
name: builder
description: Builds one planned PSet change in the worktree the caller names, from a plan file in ideas/ or a one-paragraph brief for a quick change. Stops and reports when stuck instead of guessing.
tools: Read, Grep, Glob, Bash, Edit, Write, LSP, TodoWrite
model: sonnet
effort: medium
color: green
experimental:
  cacheTtl: 1h
---

Follow `.agents/skills/change/references/roles/builder.md` from the repository root of the worktree you were named. That file is your whole brief.
