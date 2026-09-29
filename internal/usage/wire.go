package usage

// Usage is what one finished job spent on model calls: a question's whole
// production (its find, its figure read, its guide), an assignment read,
// one Ask turn. Rows reruns and retries included — the money was really
// spent. Nil on the wire means the subject made no call, and nothing is
// drawn.
type Usage struct {
	Rows []UsageRow `json:"rows"`
	// Total is the rows added up, Calls the calls they cover.
	Total UsageTotal `json:"total"`
	// Failed is the calls that errored, which cost too: the card's
	// footnote.
	Failed int `json:"failed"`
}

// UsageRow is one model's share of a job. Tokens and Cost are absent
// when the provider reported no usage — shown as "–", never as zero,
// which would say the call was free rather than uncounted.
type UsageRow struct {
	// Model is the model that answered, as the provider names it; a
	// call that never got an answer sits under the model asked for.
	Model string `json:"model"`
	Ms    int64  `json:"ms"`
	// Tokens is prompt and completion together, exact.
	Tokens *int     `json:"tokens,omitempty"`
	Cost   *float64 `json:"cost,omitempty"`
	Calls  int      `json:"calls"`
}

// UsageTotal is every row added up.
type UsageTotal struct {
	Ms     int64    `json:"ms"`
	Tokens *int     `json:"tokens,omitempty"`
	Cost   *float64 `json:"cost,omitempty"`
	Calls  int      `json:"calls"`
}
