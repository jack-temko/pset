package health

import "github.com/jackt/pset/internal/condition"

// Check is one condition as Settings lists it: whether it holds, and what
// the check found.
type Check struct {
	// Condition is the condition, as the runner and the actions see it: its
	// error and fix while it does not hold.
	Condition condition.Condition `json:"condition"`
	// Name is what Settings calls it ("Tesseract", "Data folder").
	Name string `json:"name"`
	// Detail is what the check found: a version, a path, how to install it.
	// Absent for a condition PSet learns only from what happens (the key,
	// credit, the provider).
	Detail string `json:"detail,omitempty"`
}

// Health is every condition, in the order condition.All lists them, each
// checked where PSet can check it. Never null.
type Health struct {
	// Checks is the list.
	Checks []Check `json:"checks"`
}
