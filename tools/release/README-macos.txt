PSet for macOS
==============

A study app for textbooks you own as PDFs. It runs on your Mac; your books
and notes stay in ~/Library/Application Support/pset.

Install (once)
--------------
One command, in Terminal:

  curl -fsSL https://github.com/jack-temko/pset/releases/latest/download/install.sh | sh

or, from this folder:   bash setup.sh

Either installs Homebrew if needed, then poppler, tesseract and Ollama,
downloads the nomic-embed-text embeddings model, and puts the pset command in
~/.local/bin. Run the same command again any time to update.

Run
---
Type  pset  in Terminal, or double-click PSet.command. PSet opens your browser at
http://127.0.0.1:8420. Close the Terminal window (or press Ctrl+C) to stop it.

First run
---------
Settings (gear, top right) > Connections: add an OpenRouter key (openrouter.ai/keys).
PSet picks the models itself. Embeddings use the local Ollama. Then check Health
on the same page. Settings > Updates checks for a newer version.

If macOS says "pset can't be opened because it is from an unidentified
developer": setup.sh clears that for the program it installs. If you opened it
another way, right-click the file, choose Open, and confirm once.

If you used an earlier version, its library is still in ~/.local/share/pset: PSet
doesn't move it. Copy it to ~/Library/Application Support/pset to bring it over.

Needs macOS 12 or newer.
