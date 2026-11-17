#!/bin/bash
# Double-click to run PSet. Close this window (or press Ctrl+C) to stop it.
# PSet opens your browser itself.
export PATH="$HOME/.local/bin:$PATH"
if ! command -v pset >/dev/null; then
	echo "Run setup.sh first: open Terminal here and type  bash setup.sh"
	read -r -p "Press Enter to close."
	exit 1
fi
exec pset
