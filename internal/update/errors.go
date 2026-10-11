package update

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

// Why this program can't replace itself. Each is the Why of its entry plus
// the Fix: Status shows them as one sentence.
var (
	cannotSource = errs.Define(errs.Entry{
		ID:   "update.source_build",
		What: "PSet can't update itself here.",
		Why:  "This is a build from source.",
		Fix:  "Update it by pulling and rebuilding.",
	})
	cannotSystem = errs.Define(errs.Entry{
		ID:   "update.unsupported_system",
		What: "PSet can't update itself here.",
		Why:  "Updating itself isn't supported on this system.",
		Fix:  "Run the installer for the new version instead.",
	})
	cannotNoKey = errs.Define(errs.Entry{
		ID:   "update.no_release_key",
		What: "PSet can't update itself here.",
		Why:  "This build has no release key, so it can't tell a real update from a fake one.",
		Fix:  "Install an official release.",
	})
	cannotFindSelf = errs.Define(errs.Entry{
		ID:   "update.no_program_file",
		What: "PSet can't update itself here.",
		Why:  "PSet can't find its own program file.",
		Fix:  "Run the installer again.",
	})
	cannotWrite = errs.Define(errs.Entry{
		ID:   "update.not_writable",
		What: "PSet can't update itself here.",
		Why:  "PSet can't write to {dir}, where it is installed, so it can't replace itself.",
		Fix:  "Run the installer again instead.",
	})
)

var (
	checkUnreachable = errs.Define(errs.Entry{
		ID:     "update.check_unreachable",
		What:   "Couldn't look for an update.",
		Why:    "PSet couldn't reach GitHub.",
		Fix:    "Check the internet connection, then try again.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	noRelease = errs.Define(errs.Entry{
		ID:     "update.no_release",
		What:   "There is no published release yet.",
		Why:    "No version of PSet has been published to update to.",
		Status: http.StatusNotFound,
	})
	githubError = errs.Define(errs.Entry{
		ID:     "update.github_error",
		What:   "Couldn't look for an update.",
		Why:    "GitHub answered with an error (HTTP {status}).",
		Fix:    "Try again in a minute.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	unreadableRelease = errs.Define(errs.Entry{
		ID:     "update.unreadable_release",
		What:   "Couldn't look for an update.",
		Why:    "GitHub's answer wasn't in a shape PSet can read.",
		Fix:    "Try again later. If it keeps happening, copy the details and report it.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	nothingToInstall = errs.Define(errs.Entry{
		ID:   "update.nothing_to_install",
		What: "There is no newer version to install.",
		Why:  "PSet hasn't found one yet.",
		Fix:  "Check for updates first.",
	})
	alreadyInstalling = errs.Define(errs.Entry{
		ID:     "update.already_installing",
		What:   "An update is already being installed.",
		Why:    "Another request started it a moment ago.",
		Fix:    "Wait for PSet to restart.",
		Status: http.StatusConflict,
	})
	downloadFailed = errs.Define(errs.Entry{
		ID:     "update.download_failed",
		What:   "The update wasn't installed.",
		Why:    "The download failed or broke off. Nothing was changed.",
		Fix:    "Check the internet connection, then try again.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	notTrusted = errs.Define(errs.Entry{
		ID:     "update.not_trusted",
		What:   "The update wasn't installed.",
		Why:    "PSet couldn't verify the download, so it threw it away. Nothing was changed.",
		Fix:    "Try again later. If it keeps happening, copy the details and report it.",
		Status: http.StatusBadGateway,
	})
	notForThisComputer = errs.Define(errs.Entry{
		ID:     "update.not_for_this_computer",
		What:   "The update wasn't installed.",
		Why:    "This release has no build that runs on this computer. Nothing was changed.",
		Fix:    "Check the releases page for a build that does.",
		Status: http.StatusBadGateway,
	})
	replaceFailed = errs.Define(errs.Entry{
		ID:     "update.replace_failed",
		What:   "The update wasn't installed.",
		Why:    "PSet couldn't put the new program in place. Nothing was changed.",
		Fix:    "Make sure PSet's folder can be written to, or run the installer again.",
		Status: http.StatusInternalServerError,
	})
)
