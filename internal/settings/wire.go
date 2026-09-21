package settings

// ChatConnection is the chat side, as the Settings form holds it.
type ChatConnection struct {
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"apiKey"`
	Model    string `json:"model"`
}

// EmbedConnection is the embeddings side.
type EmbedConnection struct {
	Endpoint string `json:"endpoint"`
	Model    string `json:"model"`
}

// Ready says which sides have been saved, which means tested: Save only
// writes what passed. Home disables adding books until embeddings are.
type Ready struct {
	Chat       bool `json:"chat"`
	Embeddings bool `json:"embeddings"`
}

// Profile is who's studying. The name greets them on Home and is how the
// tutor addresses them; empty means neither uses one.
type Profile struct {
	Name string `json:"name"`
}

// Settings is GET /api/settings. A side never saved shows its defaults.
type Settings struct {
	Profile    Profile         `json:"profile"`
	Chat       ChatConnection  `json:"chat"`
	Embeddings EmbedConnection `json:"embeddings"`
	Ready      Ready           `json:"ready"`
}

// ConnectionInput is the body of Test and Save: exactly one side.
type ConnectionInput struct {
	Chat       *ChatConnection  `json:"chat,omitempty"`
	Embeddings *EmbedConnection `json:"embeddings,omitempty"`
}

// TestResult is what a passing Test found: "Connected", plus the vector
// size for embeddings. The model is already in the field above it, so it
// isn't repeated. A failing Test is an error naming the field.
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

type Health struct {
	Checks []HealthCheck `json:"checks"`
}

// ResetCounts is Reset's dry run, for the confirm dialog.
type ResetCounts struct {
	Books int `json:"books"`
	Pages int `json:"pages"`
}

type About struct {
	Version string `json:"version"`
	DataDir string `json:"dataDir"`
}
