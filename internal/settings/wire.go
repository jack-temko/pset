package settings

// Ready says what's been set up. Home refuses a book until the key is:
// preparing one needs it.
type Ready struct {
	// Key: an OpenRouter key was saved, which means tested.
	Key bool `json:"key"`
}

// ModelUse is one job and the model PSet does it with.
type ModelUse struct {
	Job   string `json:"job"`
	Model string `json:"model"`
}

// Profile is who's studying. The name greets them on Home and is how the
// tutor addresses them; empty means neither uses one.
type Profile struct {
	Name string `json:"name"`
}

// Settings is GET /api/settings.
type Settings struct {
	Profile Profile `json:"profile"`
	// APIKey is the saved OpenRouter key: the one connection a student
	// sets up. PSet picks the models; Models says which.
	APIKey string     `json:"apiKey"`
	Models []ModelUse `json:"models"`
	Ready  Ready      `json:"ready"`
}

// KeyInput is the body of Test and Save.
type KeyInput struct {
	APIKey string `json:"apiKey"`
}

// TestResult is what a passing Test found: "Connected". A failing Test
// is an error, on the key's field when the key is the trouble.
type TestResult struct {
	Detail string `json:"detail"`
}

// SaveResult is a passing Save: the settings as now stored.
type SaveResult struct {
	Settings Settings `json:"settings"`
	Detail   string   `json:"detail"`
}

// HealthCheck is one local-system check.
type HealthCheck struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Detail  string `json:"detail"`
	Fixable bool   `json:"fixable"`
}

// Health is the checks of what PSet needs to run.
type Health struct {
	Checks []HealthCheck `json:"checks"`
}

// ResetCounts is Reset's dry run, for the confirm dialog.
type ResetCounts struct {
	Books int `json:"books"`
	Pages int `json:"pages"`
}

// About is what the About page shows.
type About struct {
	Version string `json:"version"`
	DataDir string `json:"dataDir"`
}
