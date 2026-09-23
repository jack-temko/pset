#!/bin/bash
# Double-click to run PSet. Close this window (or press Ctrl+C) to stop it.
cd "$(dirname "$0")"
if [ ! -x ./pset ]; then
	echo "Run setup.sh first: open Terminal here and type  bash setup.sh"
	read -r -p "Press Enter to close."
	exit 1
fi
(sleep 2 && open http://127.0.0.1:8420) &
exec ./pset
