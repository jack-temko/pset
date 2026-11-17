// Package action is the action catalog: everything a student can do,
// declared once by the package that owns it, with its key, what it needs and
// whether it can be undone (ideas/actions-conditions-place-grill.md,
// ideas/backend-courses-grill.md D12). Every action runs through one route,
// and Undo reads which action it was to say what it took back.
package action
