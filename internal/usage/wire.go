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
	// Uncounted is how many of those calls reported no usage: ones that
	// failed or were stopped part-way (the provider still bills what was
	// written, and never says how much) and ones from a provider that
	// doesn't report. Tokens and Cost add up only the counted calls, so
	// with any uncounted they are a minimum, and the card says so.
	Uncounted int `json:"uncounted,omitempty"`
}

// UsageTotal is every row added up.
type UsageTotal struct {
	Ms     int64    `json:"ms"`
	Tokens *int     `json:"tokens,omitempty"`
	Cost   *float64 `json:"cost,omitempty"`
	Calls  int      `json:"calls"`
	// Uncounted is the rows' uncounted calls added up.
	Uncounted int `json:"uncounted,omitempty"`
}

// Detail is everything a modal shows about one job: the totals, the
// stages they split into, and every call, grouped by run. It is fetched
// when the modal opens; lists carry only the Usage line.
type Detail struct {
	Total  DetailTotal `json:"total"`
	Stages []Stage     `json:"stages"`
	// Runs are the subject's runs in order: the first find, a retry, a
	// rewrite after notes. A job that never reran has one.
	Runs []Run `json:"runs"`
}

// DetailTotal is the calls added up, tokens split into what went in and
// what came out. Tokens, reasoning and cached are the counted calls'
// sums and absent when no call reported (never a zero); with any
// Uncounted they are a minimum.
type DetailTotal struct {
	Ms        int64    `json:"ms"`
	TokensIn  *int     `json:"tokensIn,omitempty"`
	TokensOut *int     `json:"tokensOut,omitempty"`
	Reasoning *int     `json:"reasoning,omitempty"`
	Cached    *int     `json:"cached,omitempty"`
	Cost      *float64 `json:"cost,omitempty"`
	Calls     int      `json:"calls"`
	Failed    int      `json:"failed"`
	Uncounted int      `json:"uncounted,omitempty"`
}

// Stage is one part of a job (Find, Figures, Guide, Round 2, Naming)
// with what its calls spent across every run. Attempts is the runs that
// made calls in it. Shared is how many questions a stage shared with
// when its figures are a share of one call set (the difficulty ranking);
// zero for a stage that is the subject's own.
type Stage struct {
	Name      string   `json:"name"`
	Attempts  int      `json:"attempts"`
	Calls     int      `json:"calls"`
	Failed    int      `json:"failed,omitempty"`
	Ms        int64    `json:"ms"`
	TokensIn  *int     `json:"tokensIn,omitempty"`
	TokensOut *int     `json:"tokensOut,omitempty"`
	Reasoning *int     `json:"reasoning,omitempty"`
	Cost      *float64 `json:"cost,omitempty"`
	Uncounted int      `json:"uncounted,omitempty"`
	Shared    int      `json:"shared,omitempty"`
}

// Run is the calls of one run, in time order.
type Run struct {
	Label  string `json:"label"`
	Shared int    `json:"shared,omitempty"`
	Calls  []Call `json:"calls"`
}

// Call is one model call. Asked is the model requested, Answered the one
// that replied (empty when none did). Tools names the tools the reply
// asked for. A failed call has an Error and no counts.
type Call struct {
	// ID is the call's row, which keys it: calls made in the same second are
	// otherwise alike.
	ID        int64    `json:"id"`
	At        string   `json:"at"`
	Stage     string   `json:"stage"`
	Tools     string   `json:"tools,omitempty"`
	Asked     string   `json:"asked"`
	Answered  string   `json:"answered,omitempty"`
	Ms        int64    `json:"ms"`
	TokensIn  *int     `json:"tokensIn,omitempty"`
	TokensOut *int     `json:"tokensOut,omitempty"`
	Reasoning *int     `json:"reasoning,omitempty"`
	Cached    *int     `json:"cached,omitempty"`
	Cost      *float64 `json:"cost,omitempty"`
	Error     string   `json:"error,omitempty"`
}

// BookUsage is what a whole book has cost: the total, a row for each
// kind of thing that spent it, and the import's own stages and calls.
type BookUsage struct {
	Total DetailTotal `json:"total"`
	Kinds []Kind      `json:"kinds"`
	// Import is the book's import (naming, contents), nil when it made no
	// call.
	Import *Detail `json:"import,omitempty"`
}

// Kind is one kind of thing's share of a book: its questions, its Ask
// answers, its assignment reads, its import.
type Kind struct {
	// Kind is "questions", "ask", "reads", "import" or "ranking".
	Kind string `json:"kind"`
	// Items is how many things of the kind spent anything.
	Items int         `json:"items"`
	Total DetailTotal `json:"total"`
}
