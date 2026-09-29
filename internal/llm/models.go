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
	// contents, and the document's repairs. It taught best, with the
	// book's theorems cited and notes where a student trips.
	Writer = Job{Name: "Guides and Ask", Model: "deepseek/deepseek-v4.1-flash"}
	// Finder finds a problem on its pages and boxes it and its figures.
	// It boxed every figure of 23, in two seconds; thinking made it
	// slower and worse. It has one host.
	Finder = Job{Name: "Finding problems", Model: "perceptron/perceptron-mk1.5",
		Fallbacks: []string{"z-ai/glm-5.3-flash"}, Plain: true}
	// Reader writes out what a page shows: a problem's words, and its
	// figures as facts. It read every circuit right, for a tenth of the
	// Writer's price. A new OpenRouter account gets 20 calls a minute of
	// it, which a problem set's readings go over.
	Reader = Job{Name: "Reading figures", Model: "openai/gpt-6-luna",
		Fallbacks: []string{"z-ai/glm-5.3-flash"}}
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
