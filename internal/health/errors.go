package health

import (
	"net/http"

	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/errs"
)

var (
	// EmbedModelMissing is Ollama running without the model search's vectors
	// come from: its fix downloads it.
	EmbedModelMissing = errs.Define(errs.Entry{
		ID:     "embed.model_missing",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(condition.IDEmbeddings),
		What:   "Ollama doesn't have {model} yet.",
		Why:    "PSet searches your materials with it, and Ollama hasn't downloaded it.",
		Fix:    "Download it from Settings, under Health (about 270 MB).",
		Action: errs.ActionOpenSettings,
		Status: http.StatusServiceUnavailable,
	})
	makeFolderFailed = errs.Define(errs.Entry{
		ID:   "health.make_folder_failed",
		What: "Couldn't create the data folder.",
		Why:  "PSet isn't allowed to create it there, or the disk is full.",
		Fix:  "Create the folder yourself, or free up space, then check again.",
	})
	pullFailed = errs.Define(errs.Entry{
		ID:     "health.pull_failed",
		What:   "Ollama couldn't download {model}.",
		Why:    "Ollama isn't running, or the download was cut off.",
		Fix:    "Start Ollama and check the internet connection, then try again.",
		Action: errs.ActionRetry,
	})
)
