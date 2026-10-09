# Release runner: grill

- status: awaiting OK
- date: 2026-10-01
- brief: how PSet is built, checked, packaged, installed and updated for friends on Linux/WSL and macOS, judged from a friend installing it, and from Jack publishing it
- sources: `tools/release/*` (the hand-run macOS build), the Makefile, README, `cmd/pset/main.go`, `web/embed.go`, `internal/settings/health.go`, the deleted GitHub release v0.1.0, `ideas/git-workflow-grill.md`
- locked by Jack before the grill: L1 to L4 below

## Summary

### In one line

A `v*` tag on `main` makes GitHub build Linux (WSL) and macOS binaries from the tagged commit, smoke-test, checksum, sign and publish them with a one-line installer; PSet opens its own browser, and Settings can check for a newer release and update itself.

### Locked by Jack (not asked)

| #   | Rule                                                                          |
| --- | ----------------------------------------------------------------------------- |
| L1  | A `v*` tag on `main` starts the runner (from the git workflow grill, D3).     |
| L2  | Linux/WSL binaries are built as well as macOS. Windows-native is out for now. |
| L3  | Ollama stays required for embeddings.                                         |
| L4  | The old v0.1.0 release is deleted (done 2026-10-01).                          |

### Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                 | Beat                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| D1  | One Linux job cross-compiles Linux (amd64, arm64) and macOS (arm64, amd64) from the tagged commit; a macOS job smoke-tests the Mac binary.                                                                                                                                                                          | The build is pure Go, so no Mac is needed to build; a Mac only matters to try the result. Public repo: runner minutes are free.                     | Linux job only; native build per OS                               |
| D2  | Each release carries a per-platform tarball with its setup script and launcher, and a one-line installer (`install.sh`) that does the same from one command.                                                                                                                                                        | Jack: "keep the install script, but have it also be a oneline install."                                                                             | Tarball only; bare binary; installer only                         |
| D3  | The macOS binary is unsigned; the README documents the step.                                                                                                                                                                                                                                                        | No Apple account, no secrets, and the friends know Jack.                                                                                            | Sign and notarize ($99/yr)                                        |
| D4  | On WSL, Ollama runs inside WSL, installed by the Linux setup.                                                                                                                                                                                                                                                       | It is how Jack has it today, and one place for every Linux.                                                                                         | Windows-side Ollama; user's choice                                |
| D5  | The installer puts the binary at `~/.local/bin/pset`; `pset` starts the server and opens the browser.                                                                                                                                                                                                               | One place on every OS, and updating is re-running it.                                                                                               | A `~/PSet` folder with a launcher; `/usr/local/bin`               |
| D6  | Delete the old `v0.1.0` tag and reuse the number for the first real release.                                                                                                                                                                                                                                        | Jack's choice; see Disagreements.                                                                                                                   | Keep the tag, start at v0.2.0                                     |
| D7  | Backend: PSet opens the browser itself (on WSL, the Windows browser); WSL-aware hints in Health and setup; on macOS the data folder is `~/Library/Application Support/pset` with **no migration** of the old one. No background service.                                                                            | One launch path for every OS; the Mac data folder follows convention. Jack: "skip the migration for macOS."                                         | A launcher per OS; keeping `~/.local/share/pset`; a login service |
| D8  | Updating is in Settings: a Check for updates button (the only time PSet contacts GitHub), then the release's notes and an Update button, which downloads, verifies, backs up the database, swaps the binary and restarts PSet. If a guide is being written it warns first; the job queue resumes after the restart. | Jack: "Add this to the UI, in settings. It should update itself." The two-step keeps the promise as small as it can be and shows what is installed. | Re-run the installer only; check on start; Check installs at once |
| D9  | Before a new version changes the database, PSet backs it up. It keeps no old binary.                                                                                                                                                                                                                                | Jack's choice; see Disagreements.                                                                                                                   | Back up and keep the old binary; replace and migrate              |
| D10 | Each release publishes `SHA256SUMS` and a signature of it, signed with a key held as a repo secret; the public key is built into PSet, which checks the signature and then the checksums before swapping a binary.                                                                                                  | An auto-updater that trusts any download is the worst thing to get wrong.                                                                           | Checksums only; nothing beyond HTTPS                              |
| D11 | The finished release is published automatically, with notes generated from the squash commit titles since the last tag; Jack can edit it after.                                                                                                                                                                     | Pushing the tag is the decision to release, and the smoke test has passed.                                                                          | A draft Jack publishes                                            |
| D12 | The first release, v0.1.0, includes everything: runner, installers, browser opening, data folder, WSL hints, signing and the updater.                                                                                                                                                                               | Every install can update itself from day one, so nobody is stranded.                                                                                | Updater in the second release                                     |
| D13 | Jack tries each release on a real Mac.                                                                                                                                                                                                                                                                              | Real use (setup.sh, poppler paths) is what the smoke test cannot see.                                                                               | The runner's check alone; a friend                                |

### What a release is

| Piece          | What it is                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger        | `git tag v0.1.0` on `main`, pushed. A tag with a hyphen (`v0.1.0-rc.1`) is a pre-release (A3).                                                                                                               |
| Build          | Web app (`npm ci && npm run build`), then Go for linux/amd64, linux/arm64, darwin/arm64, darwin/amd64, `-trimpath`, version stamped from the tag.                                                            |
| Check          | Start each Linux binary and the arm64 Mac binary on a temp data folder; `-version` equals the tag; the web page is served.                                                                                   |
| Assets         | `pset-<version>-linux-<arch>.tar.gz`, `pset-<version>-macos.tar.gz` (both Mac binaries), `install.sh`, `SHA256SUMS`, `SHA256SUMS.sig`.                                                                       |
| One-liner      | `curl -fsSL https://github.com/jack-temko/pset/releases/latest/download/install.sh \| sh`                                                                                                                    |
| Installer does | Pick the platform, download and verify the tarball, install poppler, tesseract and Ollama (apt on Debian/Ubuntu/WSL, brew on macOS), pull the embeddings model, put `pset` in `~/.local/bin`, then start it. |
| Update         | Settings, Check for updates, Update.                                                                                                                                                                         |

### Assumed

Taken at the recommended default; overrule any.

- **A1** Archive names are `pset-<version>-<os>-<arch>.tar.gz` (the Mac one carries both architectures, as today); the checksum file is `SHA256SUMS`, its signature `SHA256SUMS.sig`.
- **A2** The smoke test starts the binary on a temporary data folder, waits for it to answer, fetches `/`, checks `-version` and stops. It runs on Linux and on the arm64 Mac runner; the Intel Mac binary is cross-compiled and not run by CI.
- **A3** A tag with a hyphen (`v0.1.0-rc.1`) is published as a pre-release, which `releases/latest` skips, so Jack can try a build on his Mac before a real tag.
- **A4** A manual run of the workflow on `dev` builds the files without publishing, which is how the runner itself is developed.
- **A5** The signing key is Ed25519, made once by Jack; the private half is a repo secret with an offline copy. If it is lost it is replaced in a new version, and installs on the old key reinstall with the one-liner.
- **A6** The shell installer verifies the checksum only (it cannot verify a signature without a tool on the machine); the updater inside PSet verifies the signature and the checksum.
- **A7** The installer puts `~/.local/bin` on the `PATH` if it is not there, and installs Ollama on Linux with Ollama's own install script (WSL needs systemd enabled; the installer says so if it is not).
- **A8** Settings always shows the running version, with no network call.
- **A9** The updater runs only on a binary the installer or a release put there; a source build (version ending `-dev`) is told to rebuild instead.
- **A10** The README install section and the tarball's README are rewritten: the stale "Chat endpoint with Z.ai" setup text goes (PSet picks its models and needs an OpenRouter key), Linux/WSL is added, and the privacy sentence says PSet contacts only your configured endpoints and, when you press Check, GitHub.
- **A11** The macOS and Linux setup scripts live under `tools/release/` and are what the installer downloads and runs.
- **A12** Two tabs of the same install, or two installs, are not coordinated: the updater says if it cannot replace the binary.

### Open

- **Anyone who ran the old macOS build starts with an empty library** under D7: their data stays in `~/.local/share/pset`. The README says so; Health could notice the old folder and point at it.
- The Intel Mac binary is never run by CI (D1, A2).
- The first install is trusted on HTTPS and the checksum alone (A6); only updates are signature-checked.
- How the updater swaps a running binary on each OS (rename the old file aside, put the new one in place, re-execute) is a build detail to prove on both.
- Release tags are not protected by a ruleset, so a `v*` tag could be moved or deleted; consider one once the first release is out.
- With automatic publishing and a Mac test by hand (D11, D13), a real tag is public before Jack has tried it; A3 is the way around that.
- Linux: only Debian and Ubuntu (apt) are covered; Fedora and Arch friends build or install by hand.

## Reversals

- **R1** "The only things that leave [your machine] are the requests PSet makes to the chat and embeddings endpoints you configure" (README, written 2026-09-22): reversed by Jack in this grill to "...and GitHub, when you press Check for updates." The README is rewritten to say so (A10).

## Disagreements

- **G1** The first release number (D6). Recommended: keep the old `v0.1.0` tag and start at v0.2.0, because anyone who downloaded the old v0.1.0 would hold a different build under the same number. Jack chose to delete the tag and reuse it (the release is already deleted). Not argued again.
- **G2** The safety net (D9). Recommended: back up the database and keep the old binary, so a bad update can be rolled back by PSet itself. Jack chose to back up only. The way back from an update that will not start is the one-line installer, which downloads a good build and leaves the data alone; recorded so nobody re-argues it.

## Frontier

Empty. Everything left is assumed or open above.

## To build once this is approved

Nothing is built yet. In order, each its own pull request into `dev`:

1. **Backend:** PSet opens the browser itself (WSL included), WSL-aware hints, the macOS data folder.
2. **Release scripts:** the Linux and macOS setup scripts, the launcher, `install.sh`, the tarball layout, and the rewritten READMEs.
3. **The runner:** the tag workflow and the manual run, the smoke test, checksums, signing and the generated notes.
4. **The updater:** a version and update endpoint in Go and the Settings section: check, verify, back up, swap, restart.
5. **Then, by Jack:** delete the old `v0.1.0` tag, make the signing key, add a ruleset for `v*` tags, try `v0.1.0-rc.1` on a Mac, and tag `v0.1.0`.

## Log

### Setup (before the batches)

- Jack, on the audit: "Delete the v0.1.0 release. Linux/WSL binaries should be built. What else of that looks wrong and why. Ollama is still required. Skip windows for now." (The release was deleted; the tag stayed.)

### Batch 1

- Where is the release built, and what is checked before it is published? Options: Linux builds all, Mac smoke-tests (Recommended) / Linux job only / Native build per OS. Answer: **Linux builds all, Mac smoke-tests (Recommended)**.
- What does a friend download for each platform? Options: Tarball with setup script (Recommended) / Bare binary + instructions / One-line installer. Answer, as typed: "keep the install script, but have it also be a oneline install".
- How should macOS handle the unidentified-developer warning? Options: Unsigned, document the step (Recommended) / Sign and notarize. Answer: **Unsigned, document the step (Recommended)**.
- On WSL, where does Ollama run? Options: Inside WSL (Recommended) / On the Windows side / Let the user choose. Answer: **Inside WSL (Recommended)**.

### Batch 2

- Where does the one-line installer put PSet? Options: ~/.local/bin/pset + `pset` command (Recommended) / A ~/PSet folder with a launcher / System-wide in /usr/local/bin. Answer: **~/.local/bin/pset + `pset` command (Recommended)**.
- The old v0.1.0 tag: what becomes the first release number? Options: Keep the tag, next is v0.2.0 (Recommended) / Delete the tag, reuse v0.1.0. Answer: **Delete the tag, reuse v0.1.0**.
- Which backend changes? (multi-select) Options: PSet opens the browser itself / macOS data folder convention / WSL-aware hints / Run it in the background. Answer: "skip the migration for macOS.", "PSet opens the browser itself", "macOS data folder convention", "WSL-aware hints".
- How does a friend get an update? Options: Re-run the installer (Recommended) / `pset update` command / Tell them, they download. Answer, as typed: "Add this to the UI, in settings. It should update itself."

### Batch 3

- This reverses the README's promise that PSet only contacts the endpoints you configure. When does it talk to GitHub? Options: Only when you press Check (Recommended) / On start, once a day / No, keep the promise. Answer: **Only when you press Check (Recommended)**.
- Before a new version changes the database, what protects a library? Options: Back up first, keep the old binary (Recommended) / Replace and migrate / Back up only. Answer: **Back up only**.
- How much is a download verified? Options: SHA256SUMS in each release (Recommended) / Checksums + a signature / Nothing beyond HTTPS. Answer: **Checksums + a signature**.
- When the runner finishes a tagged build, what happens to the release? Options: Published automatically (Recommended) / A draft you publish. Answer: **Published automatically (Recommended)**.

### Batch 4

- When you press Check and a newer version exists, what happens? Options: Shows it, then an Update button (Recommended) / Check installs at once. Answer: **Shows it, then an Update button (Recommended)**.
- What goes in the first release (v0.1.0)? Options: Everything, updater included (Recommended) / Updater in the second release. Answer: **Everything, updater included (Recommended)**.
- Do you have a Mac you can try a release on before friends do? Options: No, rely on the runner's check / Yes, I can test / A friend will test. Answer: **Yes, I can test**.

## Built so far (2026-10-02)

1. Backend (PR 4): `internal/platform`, the browser opening, per-OS hints, the Mac data folder.
2. Release scripts (PR 5): `build.sh`, `install.sh`, the Linux and macOS setup scripts and READMEs.
3. The runner (this change): `.github/workflows/release.yml` (tag or manual run: build, smoke-test on Linux and a Mac, sign, publish), `tools/release/sign`, `internal/releasesign` and `tools/release/smoke.sh`. The first manual run on GitHub is how it is proved.
4. The updater (this change): `internal/update`, Settings > Updates, and the database backup before a migration. It cannot work until the public key is built in: `go run ./tools/release/sign -setup` makes the key, stores the secret and prints the public half for `internal/update/key.go`.
5. Jack's steps: the key, deleting the old tag, a `v*` ruleset, `v0.1.0-rc.1`, `v0.1.0`.
