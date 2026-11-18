package condition

import "github.com/jackt/pset/internal/errs"

// ID names a condition. The set is fixed; a condition's id is its address,
// not a UUID.
type ID string

const (
	// IDKey is an OpenRouter key saved and accepted.
	IDKey ID = "key"
	// IDCredit is credit left on that key's account.
	IDCredit ID = "credit"
	// IDProvider is the model provider answering.
	IDProvider ID = "provider"
	// IDPDFReader is the program that reads a PDF's text and draws its pages
	// installed.
	IDPDFReader ID = "pdf_reader"
	// IDScanReader is the program that recognizes a scan's text installed.
	IDScanReader ID = "scan_reader"
	// IDDataFolder is the data folder there and writable.
	IDDataFolder ID = "data_folder"
	// IDDatabase is the database sound.
	IDDatabase ID = "database"
	// IDDiskSpace is room left on the disk for pages and images.
	IDDiskSpace ID = "disk_space"
	// IDEmbeddings is the local embedding model answering, for search. It
	// goes if track 4 drops embeddings.
	IDEmbeddings ID = "embeddings"
)

// All is every condition, in the order Settings lists them.
var All = []ID{IDKey, IDCredit, IDProvider, IDPDFReader, IDScanReader, IDDataFolder, IDDatabase, IDDiskSpace, IDEmbeddings}

// Condition is one thing PSet depends on, and whether it holds. A missing
// one is said at the action it blocks, before the student tries.
type Condition struct {
	// ID is which condition it is.
	ID ID `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// Holds is true while it is the case.
	Holds bool `json:"holds"`
	// Since is when it last started or stopped holding (RFC 3339).
	Since string `json:"since"`
	// Error is what is missing and how to fix it, in the student's words,
	// from the error catalog; absent while it holds.
	Error *errs.View `json:"error,omitempty"`
	// Fix is the id of the action that fixes it (saving a key, making the
	// data folder again), when there is one: Settings' Fix button and the
	// blocked action's way out both run it.
	Fix string `json:"fix,omitempty"`
}

// Conditions is every condition, in the order above. Never null.
type Conditions struct {
	// Conditions is the list.
	Conditions []Condition `json:"conditions"`
}
