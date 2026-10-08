package llm

// PSet picks its own models: the student brings an OpenRouter key and
// nothing else. Each job goes to the model that did it best when they
// were tested side by side (design/backend.md, "Models"), and a job whose
// model has a single host or a tight rate limit names a second to fall
// back on.

// OpenRouter is where every chat call goes.
const OpenRouter = "https://openrouter.ai/api/v1"

// Embeddings run on the student's own machine, on Ollama.
const (
	EmbedEndpoint = "http://localhost:11434/v1"
	EmbedModel    = "nomic-embed-text"
)

// Job is a kind of work and the models that do it.
type Job struct {
	// Name is what the job is, as Settings lists it.
	Name  string
	Model string
	// Fallbacks take over, in order, when Model fails or is rate limited.
	Fallbacks []string
	// Plain leaves reasoning out of the request, for a model that does
	// worse thinking than not: it answers at its own default.
	Plain bool
}

var (
	// Writer writes: guides, Ask's answers, assignment reads, a book's
	// contents, and the document's repairs. On 22 hard guides (2026-10-08)
	// it got 20 right, for $0.0075 a guide in 26 s; DeepSeek, the Writer
	// before it and now behind it, got 18 for three times the price. It
	// needs its signed reasoning back between tool rounds
	// (reasoning_details), or it loses its plan.
	Writer = Job{Name: "Guides and Ask", Model: "anthropic/claude-haiku-5.5",
		Fallbacks: []string{"deepseek/deepseek-v4.1-flash"}}
	// Finder finds a problem on its pages and boxes it and its figures.
	// It boxed every figure of 23, in two seconds; thinking made it
	// slower and worse. It has one host.
	Finder = Job{Name: "Finding problems", Model: "perceptron/perceptron-mk1.5",
		Fallbacks: []string{"z-ai/glm-5.3-flash"}, Plain: true}
	// Reader writes out what a page shows: a problem's words, and its
	// figures as facts. On the scanned DE book and the circuits book
	// (2026-10-08) it wrote out 44 problems of 44 right and read 27
	// figures of 28, where Luna, the Reader before it and now behind it,
	// got 38 and 24, and misread the same figures every time (a 120v_o
	// read as 12v_o), which the three readings can't catch. It costs
	// about 8 times Luna: $0.0016 a problem, $0.019 a figure.
	Reader = Job{Name: "Reading figures", Model: "google/gemini-3.8-flash",
		Fallbacks: []string{"openai/gpt-6-luna"}}
)

// Jobs is every job, in the order Settings lists them.
var Jobs = []Job{Writer, Finder, Reader}

// Ask is a request made for this job: its model and fallbacks, and its
// reasoning left out when the job runs plain.
func (j Job) Ask(req ChatRequest) ChatRequest {
	req.Model, req.Fallbacks = j.Model, j.Fallbacks
	if j.Plain {
		req.ReasoningEffort = ownDefault
	}
	return req
}

// ownDefault is the ReasoningEffort that sends no reasoning at all.
const ownDefault = "own"
