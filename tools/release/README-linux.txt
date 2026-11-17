PSet for Linux and WSL
======================

A study app for textbooks you own as PDFs. It runs on your machine; your books
and notes stay in ~/.local/share/pset.

Install (once)
--------------
One command:

  curl -fsSL https://github.com/jack-temko/pset/releases/latest/download/install.sh | sh

or, from this folder:   sh setup.sh

Either installs poppler, tesseract and Ollama (Debian and Ubuntu, WSL included),
downloads the nomic-embed-text embeddings model, and puts the pset command in
~/.local/bin. Run the same command again any time to update.

Run
---
Type  pset.  PSet opens your browser at http://127.0.0.1:8420 (under WSL, your
Windows browser). Press Ctrl+C to stop it.

WSL: Ollama runs inside WSL. For it to start by itself, enable systemd: add
  [boot]
  systemd=true
to /etc/wsl.conf, then run  wsl --shutdown  from Windows. Without systemd,
setup starts it for the current session and  ollama serve  starts it again later.

First run
---------
Settings (gear, top right) > Connections: add an OpenRouter key (openrouter.ai/keys).
PSet picks the models itself. Embeddings use the local Ollama. Then check Health
on the same page. Settings > Updates checks for a newer version.
