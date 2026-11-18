package health

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
)

// LiveOllama is the Ollama on this computer.
type LiveOllama struct{}

// ollamaAPI is Ollama's own API, beside the OpenAI-shaped one PSet embeds
// with: it says which models are pulled, and pulls one.
var ollamaAPI = strings.TrimSuffix(llm.EmbedEndpoint, "/v1") + "/api"

// Models lists the models the local Ollama has.
func (LiveOllama) Models(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ollamaAPI+"/tags", nil)
	if err != nil {
		return nil, fmt.Errorf("build the request to ollama: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, llm.EmbedUnreachable.Wrap(err)
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama answered %d", resp.StatusCode)
	}
	var tags struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return nil, errs.Data.Wrap(err)
	}
	out := make([]string, len(tags.Models))
	for i, m := range tags.Models {
		out[i] = m.Name
	}
	return out, nil
}

// Pull asks the local Ollama to download a model.
func (LiveOllama) Pull(ctx context.Context, model string) error {
	body, _ := json.Marshal(map[string]any{"model": model, "stream": false})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ollamaAPI+"/pull", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build the request to ollama: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return llm.EmbedUnreachable.Wrap(err)
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("ollama answered %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}
