PSet for macOS
==============

A study app for textbooks you own as PDFs. It runs on your Mac; your
books and notes stay in ~/.local/share/pset.

Setup (once)
------------
1. Open Terminal, drag this folder onto it after typing "cd ", press Enter.
2. Run:   bash setup.sh
   It installs Homebrew if needed, then poppler, tesseract and ollama,
   and downloads the nomic-embed-text embeddings model.

Run
---
Double-click PSet.command. It starts PSet and opens
http://127.0.0.1:8420 in your browser. Close the Terminal window to stop.

First run
---------
Settings (gear, top right) > Connections:
  - Chat: an OpenAI-compatible endpoint, API key and a vision-capable
    model (the default is Z.ai's glm-5.3-flash).
  - Embeddings: the defaults already point at the local ollama.
Then check Health on the same page.

Needs macOS 12 or newer.
