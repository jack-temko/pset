// Package health checks what PSet depends on (the PDF and scan readers, the
// data folder, the database, Ollama's search model) and keeps what it finds
// as conditions, through the step runner: at start, and each time Settings
// opens. GET /api/health lists every condition, checked or learned; each fix
// PSet can make itself (making the data folder, downloading the search
// model) is an action. Spec: ideas/actions-conditions-place-grill.md (A2,
// A3).
package health
