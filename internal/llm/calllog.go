package llm

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// The call log: every chat request and what came back, one JSON object
// per line, so a bad walkthrough can be traced to its exact prompt. Images
// are replaced by a placeholder; they would make the log unreadable and
// huge. The file rolls over at logMax, keeping one previous file.
const logMax = 20 << 20

var callLog struct {
	sync.Mutex
	path string
}

// LogCallsTo starts the call log at path. Empty stops it.
func LogCallsTo(path string) {
	callLog.Lock()
	defer callLog.Unlock()
	callLog.path = path
	if path != "" {
		os.MkdirAll(filepath.Dir(path), 0o700)
	}
}

type callRecord struct {
	At       string     `json:"at"`
	Model    string     `json:"model"`
	Millis   int64      `json:"ms"`
	Messages []logMsg   `json:"messages"`
	Tools    []string   `json:"tools,omitempty"`
	Reply    string     `json:"reply,omitempty"`
	Reasoned int        `json:"reasoned,omitempty"`
	Calls    []ToolCall `json:"toolCalls,omitempty"`
	Error    string     `json:"error,omitempty"`
}

type logMsg struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

func logCall(req ChatRequest, start time.Time, reply Reply, err error) {
	callLog.Lock()
	defer callLog.Unlock()
	if callLog.path == "" {
		return
	}
	rec := callRecord{
		At: start.UTC().Format(time.RFC3339), Model: req.Model,
		Millis: time.Since(start).Milliseconds(), Reply: reply.Content, Calls: reply.ToolCalls, Reasoned: reply.Reasoned,
	}
	for _, t := range req.Tools {
		rec.Tools = append(rec.Tools, t.Function.Name)
	}
	for _, m := range req.Messages {
		text := m.Content.Text()
		if parts := m.Content.Parts(); len(parts) > 0 {
			var b strings.Builder
			for _, p := range parts {
				if p.Type == "text" {
					b.WriteString(p.Text)
				} else {
					b.WriteString("[image]")
				}
				b.WriteString("\n")
			}
			text = b.String()
		}
		rec.Messages = append(rec.Messages, logMsg{m.Role, text})
	}
	if err != nil {
		rec.Error = err.Error()
	}
	line, _ := json.Marshal(rec)
	if st, e := os.Stat(callLog.path); e == nil && st.Size() > logMax {
		os.Rename(callLog.path, callLog.path+".1")
	}
	f, e := os.OpenFile(callLog.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if e != nil {
		return
	}
	f.Write(append(line, '\n'))
	f.Close()
}
