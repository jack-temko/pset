package engine

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestConfigDefaultsOnFreshDataDir(t *testing.T) {
	// A bare engine, not testEngine: the point is what a fresh data dir
	// answers before anything is saved.
	e, err := New(Config{
		DBPath: filepath.Join(t.TempDir(), "data", "pset.db"),
		Logger: discardLogger(),
	})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := e.Config(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIBaseURL != DefaultAPIBaseURL {
		t.Errorf("apiBaseURL = %q, want %q", cfg.APIBaseURL, DefaultAPIBaseURL)
	}
	if cfg.APIKey != "" {
		t.Errorf("apiKey = %q, want empty", cfg.APIKey)
	}
	if cfg.EmbedBaseURL != DefaultEmbedBaseURL {
		t.Errorf("embedBaseURL = %q, want %q", cfg.EmbedBaseURL, DefaultEmbedBaseURL)
	}
	if cfg.EmbedModel != DefaultEmbedModel {
		t.Errorf("embedModel = %q, want %q", cfg.EmbedModel, DefaultEmbedModel)
	}
	if cfg.ChatConfigured() {
		// apiBaseURL set but no key: chat is NOT configured.
		t.Error("default settings must not count as chat-configured (no key)")
	}
	if !cfg.EmbedConfigured() {
		t.Error("the default embed base URL counts as configured")
	}
	// Loading defaults must not create the file; it appears on first save.
	if _, err := os.Stat(filepath.Join(filepath.Dir(e.DBPath()), "config.json")); !os.IsNotExist(err) {
		t.Error("config.json appeared without a save")
	}
}

func TestConfigRoundTrip(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	in := Settings{
		APIBaseURL:   "https://llm.example/v1",
		APIKey:       "sk-secret",
		EmbedBaseURL: "http://127.0.0.1:11434/v1",
		EmbedModel:   "nomic-embed-text",
	}
	if err := e.SaveConfig(ctx, in); err != nil {
		t.Fatalf("save: %v", err)
	}
	out, err := e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if out != in {
		t.Fatalf("roundtrip = %+v, want %+v", out, in)
	}

	path := filepath.Join(filepath.Dir(e.DBPath()), "config.json")
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("config file missing: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("config mode = %v, want 0600", info.Mode().Perm())
	}

	// Reads are never cached across writes.
	in.APIKey = "sk-second"
	if err := e.SaveConfig(ctx, in); err != nil {
		t.Fatal(err)
	}
	out, err = e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if out.APIKey != "sk-second" {
		t.Errorf("apiKey after rewrite = %q", out.APIKey)
	}
}

func TestTestConnectionAgainstFakes(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	goodEmbed := startFakeEmbed(t, &fakeEmbed{})
	goodChat := startFakeChat(t, "ok")

	override := Settings{
		APIBaseURL:   goodChat.url(),
		APIKey:       "key",
		EmbedBaseURL: goodEmbed.URL,
		EmbedModel:   "m",
	}
	chat, embed, err := e.TestConnection(ctx, &override)
	if err != nil {
		t.Fatal(err)
	}
	if !chat.OK || chat.Detail != "connected" {
		t.Errorf("chat probe = %+v, want connected", chat)
	}
	if !embed.OK || embed.Detail != "connected" {
		t.Errorf("embed probe = %+v, want connected", embed)
	}

	override.APIKey = ""
	chat, _, err = e.TestConnection(ctx, &override)
	if err != nil {
		t.Fatal(err)
	}
	if chat.OK || chat.Detail == "" {
		t.Errorf("chat probe without a key = %+v, want a failure detail", chat)
	}

	override.APIBaseURL = "http://127.0.0.1:1"
	override.APIKey = "key"
	chat, _, err = e.TestConnection(ctx, &override)
	if err != nil {
		t.Fatal(err)
	}
	if chat.OK {
		t.Error("an unreachable chat endpoint cannot probe ok")
	}

	// With no override the saved settings are tested (here: defaults with no
	// key, so the chat probe fails without touching the network).
	_, embed, err = e.TestConnection(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	_ = embed
}
