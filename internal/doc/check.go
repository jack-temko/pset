package doc

import (
	_ "embed"
	"fmt"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// katexCheck is the web app's own KaTeX (web/src/lib/katex-check.ts,
// bundled by `npm run build:check`): the exact parser the browser uses, so
// the server and the page can never disagree about what parses.
//
//go:embed katex-check.js
var katexCheck string

// The engine runs only this one pure function: goja gives a script no
// file, network or timer, and none is handed to it.
var engine struct {
	once    sync.Once
	mu      sync.Mutex
	rt      *goja.Runtime
	check   goja.Callable
	version string
	err     error
	// seen remembers verdicts: a document repeats its math, and a guide is
	// checked again at every chunking of a test.
	seen map[mathKey]string
}

type mathKey struct {
	tex     string
	display bool
}

func loadEngine() {
	engine.once.Do(func() {
		rt := goja.New()
		if _, err := rt.RunString(katexCheck); err != nil {
			engine.err = fmt.Errorf("load the KaTeX check: %w", err)
			return
		}
		lib := rt.Get("PSetKatexCheck").ToObject(rt)
		check, ok := goja.AssertFunction(lib.Get("check"))
		if !ok {
			engine.err = fmt.Errorf("the KaTeX check has no check function")
			return
		}
		engine.rt, engine.check, engine.version = rt, check, lib.Get("version").String()
	})
}

// KatexVersion is the version of KaTeX the check embeds.
func KatexVersion() (string, error) {
	loadEngine()
	return engine.version, engine.err
}

// MathError is why KaTeX can't render tex, in its own words, or "" when it
// can. display checks it as a block. When the engine itself can't load,
// nothing is called wrong: a check that can't run must not reject math.
func MathError(tex string, display bool) string {
	loadEngine()
	if engine.err != nil {
		return ""
	}
	engine.mu.Lock()
	defer engine.mu.Unlock()
	key := mathKey{tex, display}
	if msg, ok := engine.seen[key]; ok {
		return msg
	}
	// A runaway expansion stops instead of holding the server.
	stop := time.AfterFunc(3*time.Second, func() { engine.rt.Interrupt("too slow") })
	defer func() {
		stop.Stop()
		engine.rt.ClearInterrupt()
	}()
	v, err := engine.check(goja.Undefined(), engine.rt.ToValue(tex), engine.rt.ToValue(display))
	msg := ""
	if err != nil {
		msg = err.Error()
	} else {
		msg = v.String()
	}
	if engine.seen == nil || len(engine.seen) > 20000 {
		engine.seen = map[mathKey]string{}
	}
	engine.seen[key] = msg
	return msg
}
