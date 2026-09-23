#!/bin/bash
# One-time setup for PSet on a Mac: installs what it needs with Homebrew,
# picks the binary for this Mac and clears the download quarantine.
set -e
cd "$(dirname "$0")"

say() { printf '\n==> %s\n' "$1"; }

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

say "Installing the PSet binary for this Mac"
case "$(uname -m)" in
	arm64) cp bin/pset-arm64 pset ;;
	*) cp bin/pset-amd64 pset ;;
esac
chmod +x pset PSet.command
xattr -dr com.apple.quarantine . 2>/dev/null || true

say "Done. Double-click PSet.command (or run ./pset) and open http://127.0.0.1:8420"
echo "    First, in Settings > Connections, add a chat model API key."
