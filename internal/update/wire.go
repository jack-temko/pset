package update

// Status is GET /api/update: what is running, whether it can update itself,
// and what the last check found. Nothing here touches the network: the check
// is its own act.
type Status struct {
	// Version is what is running ("0.1.0", or ending "-dev" for a build from source).
	Version string `json:"version"`
	// CanUpdate says PSet can replace itself; Why says what stops it when not.
	CanUpdate bool   `json:"canUpdate"`
	Why       string `json:"why,omitempty"`
	// Busy is how many jobs (guides being written, answers) are running or
	// waiting: an update restarts PSet, and they resume afterwards.
	Busy int `json:"busy"`
	// Checked is the newest release the last check found, if one was made
	// since PSet started.
	Checked *Release `json:"checked,omitempty"`
}

// Release is a published release as the check saw it.
type Release struct {
	Version   string `json:"version"`
	Notes     string `json:"notes"`
	Published string `json:"published"`
	// Newer is whether it is newer than what is running.
	Newer bool `json:"newer"`
}

// Applied is POST /api/update/apply's answer: the new program is in place and
// PSet is restarting itself. The page waits for it to come back.
type Applied struct {
	Version    string `json:"version"`
	Restarting bool   `json:"restarting"`
}
