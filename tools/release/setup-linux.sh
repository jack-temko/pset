#!/bin/sh
# Sets PSet up on Debian, Ubuntu or WSL: installs poppler, tesseract and
# Ollama, fetches the embeddings model and puts `pset` in ~/.local/bin.
# PSET_SKIP_DEPS=1 skips the first part.
set -eu
cd "$(dirname "$0")"

say() { printf '\n==> %s\n' "$1"; }
as_root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo "$@"; fi; }

if [ -z "${PSET_SKIP_DEPS:-}" ]; then
	command -v apt-get >/dev/null || {
		echo "This setup is for Debian and Ubuntu (apt), which includes WSL. On another" >&2
		echo "Linux, install poppler and tesseract with your package manager, Ollama from" >&2
		echo "ollama.com, then run:  PSET_SKIP_DEPS=1 sh setup.sh" >&2
		exit 1
	}
	pkgs=""
	command -v pdftoppm >/dev/null || pkgs="$pkgs poppler-utils"
	command -v tesseract >/dev/null || pkgs="$pkgs tesseract-ocr"
	if [ -n "$pkgs" ]; then
		say "Installing$pkgs"
		as_root apt-get update
		# shellcheck disable=SC2086
		as_root apt-get install -y $pkgs
	fi

	if ! command -v ollama >/dev/null; then
		say "Installing Ollama"
		curl -fsSL https://ollama.com/install.sh | sh
	fi

	if ! curl -fs http://127.0.0.1:11434/ >/dev/null 2>&1; then
		say "Starting Ollama"
		if [ -d /run/systemd/system ]; then
			as_root systemctl enable --now ollama || true
		else
			# WSL without systemd: run it for this session, and say how to do better.
			nohup ollama serve >/dev/null 2>&1 &
			echo "    (WSL without systemd: Ollama runs until you close WSL. To start it by itself, add"
			echo "     [boot] and systemd=true to /etc/wsl.conf, then run  wsl --shutdown  from Windows.)"
		fi
		for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
			curl -fs http://127.0.0.1:11434/ >/dev/null 2>&1 && break
			sleep 1
		done
	fi
	say "Fetching the embeddings model"
	ollama pull nomic-embed-text
fi

say "Installing the PSet program"
mkdir -p "$HOME/.local/bin"
cp pset "$HOME/.local/bin/pset"
chmod +x "$HOME/.local/bin/pset"

case ":$PATH:" in
*":$HOME/.local/bin:"*) ;;
*)
	added=
	for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
		[ -f "$rc" ] && printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >>"$rc" && added=1
	done
	if [ -n "$added" ]; then
		echo "    Added ~/.local/bin to your PATH; open a new terminal to use  pset  from anywhere."
	else
		echo "    Add ~/.local/bin to your PATH to use  pset  from anywhere."
	fi
	;;
esac

say "Done. Run  pset  to start it (it opens your browser)."
echo "    First, in Settings > Connections, add your OpenRouter key."
