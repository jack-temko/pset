#!/bin/bash
# One-time setup for PSet on a Mac: installs what it needs with Homebrew,
# puts the program for this Mac in ~/.local/bin and clears the download quarantine.
# PSET_SKIP_DEPS=1 skips the Homebrew part.
set -e
cd "$(dirname "$0")"

say() { printf '\n==> %s\n' "$1"; }

if [ -z "${PSET_SKIP_DEPS:-}" ]; then
	if ! command -v brew >/dev/null 2>&1; then
		for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
			[ -x "$b" ] && eval "$("$b" shellenv)" && break
		done
	fi
	if ! command -v brew >/dev/null 2>&1; then
		say "Homebrew isn't installed. Installing it (it will ask for your password)."
		/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
		for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
			[ -x "$b" ] && eval "$("$b" shellenv)" && break
		done
	fi

	say "Installing poppler, tesseract and ollama"
	brew install poppler tesseract ollama

	say "Starting ollama and fetching the embeddings model"
	brew services start ollama >/dev/null
	for _ in 1 2 3 4 5 6 7 8 9 10; do
		ollama list >/dev/null 2>&1 && break
		sleep 1
	done
	ollama pull nomic-embed-text
fi

say "Installing the PSet program"
mkdir -p "$HOME/.local/bin"
case "$(uname -m)" in
arm64) cp bin/pset-arm64 "$HOME/.local/bin/pset" ;;
*) cp bin/pset-amd64 "$HOME/.local/bin/pset" ;;
esac
chmod +x "$HOME/.local/bin/pset" PSet.command 2>/dev/null || true
# Downloaded through a browser, the files are flagged as from the internet and
# macOS would ask before running them; this program is unsigned, so clear it.
xattr -dr com.apple.quarantine "$HOME/.local/bin/pset" . 2>/dev/null || true

case ":$PATH:" in
*":$HOME/.local/bin:"*) ;;
*)
	# The line written into .zprofile keeps $HOME and $PATH unexpanded.
	# shellcheck disable=SC2016
	printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >>"$HOME/.zprofile"
	echo "    Added ~/.local/bin to your PATH; open a new Terminal window to use  pset  from anywhere."
	;;
esac

say "Done. Run  pset  (or double-click PSet.command) to start it; it opens your browser."
echo "    First, in Settings > Connections, add your OpenRouter key."
