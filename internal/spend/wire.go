package spend

// Model is what one model did for a thing: the calls it answered (or, for
// a call nothing answered, was asked), their tokens and what they cost.
type Model struct {
	// Model is the model that answered, falling back to the one asked for.
	Model string `json:"model"`
	// Calls is how many calls; Failed how many of them failed, which may
	// have cost too.
	Calls  int `json:"calls"`
	Failed int `json:"failed"`
	// Uncounted is how many calls the provider reported no usage for:
	// their tokens and cost are not in the sums, though they may have been
	// billed.
	Uncounted int `json:"uncounted"`
	// Tokens is prompt and completion tokens together.
	Tokens int64 `json:"tokens"`
	// Cost is in US dollars, as the provider reported it.
	Cost float64 `json:"cost"`
	// Ms is the time the calls took, added up.
	Ms int64 `json:"ms"`
}

// Spend is what a course, a material or a set cost in model calls, by
// model, the most tokens first, and the sums. Its calls are those of the
// thing's steps; a thing purged takes them with it.
// CourseSpend is what one course's calls cost.
type CourseSpend struct {
	CourseID string `json:"courseId"`
	// Total is its calls added up; its Model is empty.
	Total Model `json:"total"`
}

// Totals is what every call since a time cost, in all and by course, the
// most first: Settings' month and all time. Never null.
type Totals struct {
	Total    Model         `json:"total"`
	ByCourse []CourseSpend `json:"byCourse"`
}

type Spend struct {
	// Models is never null; empty when nothing was called.
	Models []Model `json:"models"`
	// Total is every model's added up; its Model is empty.
	Total Model `json:"total"`
}
