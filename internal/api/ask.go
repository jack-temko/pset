package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackt/pset/internal/engine"
	"github.com/jackt/pset/internal/store"
)

// --- settings ----------------------------------------------------------------

// configJSON is the wire form of the settings. The API key never leaves the
// server — only whether one is set.
type configJSON struct {
	APIBaseURL   string `json:"apiBaseURL"`
	HasAPIKey    bool   `json:"hasAPIKey"`
	EmbedBaseURL string `json:"embedBaseURL"`
	EmbedModel   string `json:"embedModel"`
}

func configJSONFromSettings(s engine.Settings) configJSON {
	return configJSON{
		APIBaseURL:   s.APIBaseURL,
		HasAPIKey:    s.APIKey != "",
		EmbedBaseURL: s.EmbedBaseURL,
		EmbedModel:   s.EmbedModel,
	}
}

// configUpdate is a PUT /api/config body. Every field is optional; the API
// key is only replaced when a non-empty value arrives.
type configUpdate struct {
	APIBaseURL   *string `json:"apiBaseURL"`
	APIKey       *string `json:"apiKey"`
	EmbedBaseURL *string `json:"embedBaseURL"`
	EmbedModel   *string `json:"embedModel"`
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.eng.Config(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, configJSONFromSettings(cfg))
}

// decodeConfigUpdate reads a config body, rejecting unknown fields so a
// misspelled key never silently does nothing.
func decodeConfigUpdate(r *http.Request) (configUpdate, error) {
	var req configUpdate
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return req, dec.Decode(&req)
}

func (s *Server) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	req, err := decodeConfigUpdate(r)
	if err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	cfg, err := s.eng.Config(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	if req.APIBaseURL != nil {
		cfg.APIBaseURL = strings.TrimSpace(*req.APIBaseURL)
	}
	if req.APIKey != nil && *req.APIKey != "" {
		cfg.APIKey = strings.TrimSpace(*req.APIKey)
	}
	if req.EmbedBaseURL != nil {
		cfg.EmbedBaseURL = strings.TrimSpace(*req.EmbedBaseURL)
	}
	if req.EmbedModel != nil {
		cfg.EmbedModel = strings.TrimSpace(*req.EmbedModel)
	}
	if err := s.eng.SaveConfig(r.Context(), cfg); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, configJSONFromSettings(cfg))
}

// handleConfigTest dials both endpoints. An empty body tests the saved
// settings; fields present in the body override them for this probe only.
func (s *Server) handleConfigTest(w http.ResponseWriter, r *http.Request) {
	req, err := decodeConfigUpdate(r)
	if err != nil && !errors.Is(err, io.EOF) {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	cfg, err := s.eng.Config(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	var override *engine.Settings
	if req.APIBaseURL != nil || req.APIKey != nil || req.EmbedBaseURL != nil || req.EmbedModel != nil {
		if req.APIBaseURL != nil {
			cfg.APIBaseURL = strings.TrimSpace(*req.APIBaseURL)
		}
		if req.APIKey != nil && *req.APIKey != "" {
			cfg.APIKey = strings.TrimSpace(*req.APIKey)
		}
		if req.EmbedBaseURL != nil {
			cfg.EmbedBaseURL = strings.TrimSpace(*req.EmbedBaseURL)
		}
		if req.EmbedModel != nil {
			cfg.EmbedModel = strings.TrimSpace(*req.EmbedModel)
		}
		override = &cfg
	}

	chat, embed, err := s.eng.TestConnection(r.Context(), override)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    chat.OK && embed.OK,
		"chat":  probeJSON{OK: chat.OK, Detail: chat.Detail},
		"embed": probeJSON{OK: embed.OK, Detail: embed.Detail},
	})
}

type probeJSON struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

// --- conversations -------------------------------------------------------------

type conversationJSON struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Pinned         bool      `json:"pinned"`
	MessageCount   int       `json:"messageCount"`
	CreatedAt      time.Time `json:"createdAt"`
	LastActivityAt time.Time `json:"lastActivityAt"`
	BookID         string    `json:"bookId,omitempty"`
	BookSHA256     string    `json:"bookSha256,omitempty"`
	BookTitle      string    `json:"bookTitle,omitempty"`
}

type messageJSON struct {
	ID         string        `json:"id"`
	Role       string        `json:"role"`
	Content    string        `json:"content"`
	Segments   []segmentJSON `json:"segments"`
	Citations  []int         `json:"citations"`
	QuestionID string        `json:"questionId,omitempty"`
	CreatedAt  time.Time     `json:"createdAt"`
}

// segmentJSON is one ordered block of an assistant answer: prose text, a
// typed envelope payload, or a degraded payload kept as raw text.
type segmentJSON struct {
	Type    string          `json:"type"`
	Text    string          `json:"text,omitempty"`
	Kind    string          `json:"kind,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func segmentsJSON(segments []store.Segment) []segmentJSON {
	out := make([]segmentJSON, 0, len(segments))
	for _, seg := range segments {
		out = append(out, segmentJSON{
			Type:    seg.Type,
			Text:    seg.Text,
			Kind:    seg.Kind,
			Payload: seg.Payload,
		})
	}
	return out
}

// messageWire builds the wire form of one stored message. User messages
// speak content, assistant messages speak segments; citations are always a
// present array.
func messageWire(m store.Message) messageJSON {
	citations := m.Citations
	if citations == nil {
		citations = []int{}
	}
	return messageJSON{
		ID:         m.ID,
		Role:       m.Role,
		Content:    m.Content,
		Segments:   segmentsJSON(m.Segments),
		Citations:  citations,
		QuestionID: m.QuestionID,
		CreatedAt:  m.CreatedAt,
	}
}

// handleAllConversations lists every thread across books with the book each
// one belongs to — the sidebar of the Ask page and book-less ?c= links.
func (s *Server) handleAllConversations(w http.ResponseWriter, r *http.Request) {
	convos, err := s.eng.AllConversations(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]conversationJSON, 0, len(convos))
	for _, c := range convos {
		out = append(out, conversationJSON{
			ID:             c.ID,
			Title:          c.Title,
			Pinned:         c.Pinned,
			MessageCount:   c.MessageCount,
			CreatedAt:      c.CreatedAt,
			LastActivityAt: c.UpdatedAt,
			BookID:         c.BookID,
			BookSHA256:     c.BookSHA256,
			BookTitle:      c.BookTitle,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
}

// handleConversationByRef resolves one thread by id alone, no book needed.
func (s *Server) handleConversationByRef(w http.ResponseWriter, r *http.Request) {
	ref, messages, err := s.eng.ConversationByRef(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	msgs := make([]messageJSON, 0, len(messages))
	for _, m := range messages {
		msgs = append(msgs, messageWire(m))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversationJSON{
			ID:             ref.ID,
			Title:          ref.Title,
			Pinned:         ref.Pinned,
			MessageCount:   ref.MessageCount,
			CreatedAt:      ref.CreatedAt,
			LastActivityAt: ref.UpdatedAt,
			BookID:         ref.BookID,
			BookSHA256:     ref.BookSHA256,
			BookTitle:      ref.BookTitle,
		},
		"messages": msgs,
	})
}

// conversationUpdate is a PATCH /api/conversations/{id} body. Both fields
// are optional, but at least one must arrive.
type conversationUpdate struct {
	Title  *string `json:"title"`
	Pinned *bool   `json:"pinned"`
}

// conversationTitleMaxRunes caps a rename (ask-created titles are already
// truncated to ~60).
const conversationTitleMaxRunes = 120

// handleConversationUpdate renames and/or (un)pins a thread by id alone.
// Neither is activity: the conversation's lastActivityAt is not moved.
func (s *Server) handleConversationUpdate(w http.ResponseWriter, r *http.Request) {
	var req conversationUpdate
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			writeErrorMsg(w, http.StatusBadRequest, "the title must not be empty")
			return
		}
		if utf8.RuneCountInString(title) > conversationTitleMaxRunes {
			writeErrorMsg(w, http.StatusBadRequest, fmt.Sprintf("the title is longer than %d characters", conversationTitleMaxRunes))
			return
		}
		req.Title = &title
	}
	if req.Title == nil && req.Pinned == nil {
		writeErrorMsg(w, http.StatusBadRequest, "a title or pinned flag is required")
		return
	}
	ref, err := s.eng.UpdateConversation(r.Context(), r.PathValue("id"), req.Title, req.Pinned)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversationJSON{
			ID:             ref.ID,
			Title:          ref.Title,
			Pinned:         ref.Pinned,
			MessageCount:   ref.MessageCount,
			CreatedAt:      ref.CreatedAt,
			LastActivityAt: ref.UpdatedAt,
			BookID:         ref.BookID,
			BookSHA256:     ref.BookSHA256,
			BookTitle:      ref.BookTitle,
		},
	})
}

func (s *Server) handleConversations(w http.ResponseWriter, r *http.Request) {
	convos, err := s.eng.Conversations(r.Context(), r.PathValue("sha"))
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]conversationJSON, 0, len(convos))
	for _, c := range convos {
		out = append(out, conversationJSON{
			ID:             c.ID,
			Title:          c.Title,
			Pinned:         c.Pinned,
			MessageCount:   c.MessageCount,
			CreatedAt:      c.CreatedAt,
			LastActivityAt: c.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
}

func (s *Server) handleConversation(w http.ResponseWriter, r *http.Request) {
	conv, messages, err := s.eng.Conversation(r.Context(), r.PathValue("sha"), r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	msgs := make([]messageJSON, 0, len(messages))
	for _, m := range messages {
		msgs = append(msgs, messageWire(m))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversationJSON{
			ID:             conv.ID,
			Title:          conv.Title,
			Pinned:         conv.Pinned,
			MessageCount:   conv.MessageCount,
			CreatedAt:      conv.CreatedAt,
			LastActivityAt: conv.UpdatedAt,
		},
		"messages": msgs,
	})
}

func (s *Server) handleConversationDelete(w http.ResponseWriter, r *http.Request) {
	if err := s.eng.DeleteConversation(r.Context(), r.PathValue("sha"), r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{})
}

// --- embed and page image -------------------------------------------------------

func (s *Server) handlePageImage(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 {
		writeErrorMsg(w, http.StatusBadRequest, "invalid page number "+strconv.Quote(r.PathValue("n")))
		return
	}
	png, err := s.eng.PageImage(r.Context(), r.PathValue("sha"), n)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(png)
}

// --- ask (SSE) -------------------------------------------------------------------

type askRequest struct {
	Question       string `json:"question"`
	ConversationID string `json:"conversationId"`
	// The page the question is anchored to (the reader's "ask about this
	// page"); 0 means the whole book. Storage never sees it: the question
	// is stored as asked.
	Page int `json:"page"`
}

// handleAsk answers a question as a server-sent event stream: a meta event,
// then the engine's typed events (prose deltas, the envelope lifecycle), then
// done — or a single error event for a failure that strikes mid-stream.
// Failures before the stream starts are answered as ordinary JSON errors.
func (s *Server) handleAsk(w http.ResponseWriter, r *http.Request) {
	var req askRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Question) == "" {
		writeErrorMsg(w, http.StatusBadRequest, "missing question")
		return
	}
	if req.Page < 0 {
		writeErrorMsg(w, http.StatusBadRequest, "invalid page")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErrorMsg(w, http.StatusInternalServerError, "streaming is not supported here")
		return
	}
	writeEvent, started := sseWriter(w, flusher)

	ans, err := s.eng.Ask(r.Context(), r.PathValue("sha"), req.ConversationID, req.Question, req.Page,
		func(u engine.AskUpdate) error {
			meta := map[string]any{
				"type":           "meta",
				"conversationId": u.ConversationID,
				"pages":          u.Pages,
			}
			if u.Pages == nil {
				meta["pages"] = []int{}
			}
			if len(u.Warnings) > 0 {
				meta["warnings"] = u.Warnings
			}
			return writeEvent(meta)
		},
		func(ev engine.ChatEvent) error { return writeChatEvent(writeEvent, ev) })

	if err != nil {
		if !*started {
			writeError(w, err)
			return
		}
		_, msg := errorStatus(err)
		writeEvent(map[string]any{"type": "error", "error": msg})
		return
	}
	writeEvent(map[string]any{"type": "done", "messageId": ans.MessageID})
}

// sseWriter turns a response into an event stream lazily: the headers are
// set by whichever event is written first, so a failure before the first
// one is still answerable as an ordinary JSON error with a real status
// code. The returned flag reports whether the stream has started.
func sseWriter(w http.ResponseWriter, flusher http.Flusher) (func(any) error, *bool) {
	started := new(bool)
	return func(v any) error {
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		if !*started {
			*started = true
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusOK)
		}
		if _, err := w.Write(append(append([]byte("data: "), data...), '\n', '\n')); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}, started
}

// writeAskEvent maps the prose and envelope lifecycle onto the wire. Both
// chats share it, so their streams fold with one client reducer.
func writeAskEvent(writeEvent func(any) error, ev engine.AskEvent) error {
	switch ev.Type {
	case engine.AskDelta:
		return writeEvent(map[string]any{"type": "delta", "text": ev.Text})
	case engine.AskEnvelopeStart:
		return writeEvent(map[string]any{"type": "envelope-start", "kind": ev.Kind})
	case engine.AskEnvelopeRepairing:
		return writeEvent(map[string]any{"type": "envelope-repairing", "kind": ev.Kind})
	case engine.AskEnvelope:
		payload := ev.Payload
		if payload == nil {
			payload = json.RawMessage("{}")
		}
		return writeEvent(map[string]any{"type": "envelope", "kind": ev.Kind, "payload": payload})
	case engine.AskEnvelopeFailed:
		return writeEvent(map[string]any{"type": "envelope-failed", "kind": ev.Kind, "raw": ev.Text})
	}
	return nil
}
