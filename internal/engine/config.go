package engine

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/jackt/pset/internal/llm"
)

// Default LLM settings applied on first load, before anything is saved.
const (
	DefaultAPIBaseURL   = "https://api.z.ai/api/paas/v4"
	DefaultEmbedBaseURL = "http://localhost:11434/v1"
	DefaultEmbedModel   = "nomic-embed-text"
)

// Settings is the user-configurable LLM connection, stored as JSON in
// <data dir>/config.json (mode 0600). APIKey is the only secret; the API
// layer never echoes it back.
type Settings struct {
	APIBaseURL   string `json:"apiBaseURL"`
	APIKey       string `json:"apiKey"`
	EmbedBaseURL string `json:"embedBaseURL"`
	EmbedModel   string `json:"embedModel"`
}

// ChatConfigured reports whether asking can work: chat endpoint and key set.
func (s Settings) ChatConfigured() bool { return s.APIBaseURL != "" && s.APIKey != "" }

// EmbedConfigured reports whether an embeddings endpoint is configured.
func (s Settings) EmbedConfigured() bool { return s.EmbedBaseURL != "" }

// defaultSettings is what a fresh data directory answers with.
func defaultSettings() Settings {
	return Settings{
		APIBaseURL:   DefaultAPIBaseURL,
		APIKey:       "",
		EmbedBaseURL: DefaultEmbedBaseURL,
		EmbedModel:   DefaultEmbedModel,
	}
}

func (e *Engine) settingsPath() string {
	return filepath.Join(filepath.Dir(e.dbPath), "config.json")
}

// Config loads the settings from disk at call time — never cached across
// writes. A missing file yields the defaults.
func (e *Engine) Config(ctx context.Context) (Settings, error) {
	e.settingsMu.Lock()
	defer e.settingsMu.Unlock()
	return e.loadSettings()
}

// SaveConfig replaces the settings and writes them with mode 0600.
func (e *Engine) SaveConfig(ctx context.Context, s Settings) error {
	e.settingsMu.Lock()
	defer e.settingsMu.Unlock()
	return e.saveSettings(s)
}

func (e *Engine) loadSettings() (Settings, error) {
	s := defaultSettings()
	data, err := os.ReadFile(e.settingsPath())
	if os.IsNotExist(err) {
		return s, nil
	}
	if err != nil {
		return Settings{}, userf(err, "cannot read %s", e.settingsPath())
	}
	if err := json.Unmarshal(data, &s); err != nil {
		return Settings{}, userf(err, "%s is not valid JSON; fix or remove it", e.settingsPath())
	}
	return s, nil
}

func (e *Engine) saveSettings(s Settings) error {
	path := e.settingsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return userf(err, "cannot create data directory %s", filepath.Dir(path))
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return userf(err, "cannot encode the settings")
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o600); err != nil {
		return userf(err, "cannot write %s", path)
	}
	return nil
}

// llmClient builds a client from the settings on disk. The settings must
// already be validated by the caller when chat is about to be used.
func (e *Engine) llmClient(s Settings) *llm.Client {
	return llm.New(s.APIBaseURL, s.APIKey, s.EmbedBaseURL, s.EmbedModel)
}

// ProbeResult is the outcome of dialing one model endpoint.
type ProbeResult struct {
	OK     bool
	Detail string
}

// TestConnection dials the chat endpoint (a 1-token non-streaming request)
// and the embeddings endpoint. A nil override tests the saved settings.
func (e *Engine) TestConnection(ctx context.Context, override *Settings) (chat, embed ProbeResult, err error) {
	settings := override
	if settings == nil {
		s, err := e.Config(ctx)
		if err != nil {
			return ProbeResult{}, ProbeResult{}, err
		}
		settings = &s
	}
	client := e.llmClient(*settings)

	chat = e.probeChat(ctx, client, *settings)
	embed = e.probeEmbed(ctx, client, *settings)
	return chat, embed, nil
}

func (e *Engine) probeChat(ctx context.Context, client *llm.Client, s Settings) ProbeResult {
	if !s.ChatConfigured() {
		return ProbeResult{OK: false, Detail: "no chat endpoint or API key configured"}
	}
	req := llm.ChatRequest{
		Model:     llm.ChatModel,
		Messages:  []llm.Message{llm.TextMessage("user", "Reply with the word ok.")},
		MaxTokens: 1,
	}
	if _, err := client.ChatOnce(ctx, req); err != nil {
		return ProbeResult{OK: false, Detail: llmFailMessage(err)}
	}
	return ProbeResult{OK: true, Detail: "connected"}
}

func (e *Engine) probeEmbed(ctx context.Context, client *llm.Client, s Settings) ProbeResult {
	if !s.EmbedConfigured() {
		return ProbeResult{OK: false, Detail: "no embeddings endpoint configured"}
	}
	if _, err := client.Embed(ctx, []string{"probe"}); err != nil {
		return ProbeResult{OK: false, Detail: llmFailMessage(err)}
	}
	return ProbeResult{OK: true, Detail: "connected"}
}
