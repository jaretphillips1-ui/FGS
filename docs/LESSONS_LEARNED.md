# FGS – Lessons Learned (Ops + Build)

This file exists so we don’t repeat the same “patch spiral” across future apps.
When things feel stuck, **zoom out, choose a simpler shape**, and protect the workspace with guardrails.

## 1) Patch vs Rewrite: a decision rule

### Prefer a PATCH when:
- The change is localized (1–3 lines / one function).
- The failure mode is understood and testable.
- You can add a small preflight check or assertion to prevent regression.

### Prefer a REWRITE when:
- You’re fighting the tool/language (quoting, escaping, nested strings, scope).
- The fix requires multiple “tiny hacks” across files to keep it alive.
- The mental model is unclear or changing mid-flight.
- You can restate the goal and rebuild it in a simpler shape in < ~20–30 minutes.

**Rule of thumb:** If you’ve made 2–3 patches and the problem mutates, stop and rewrite.

## 2) Command Gate (Green / Red pacing)
We drift when we run too many commands without “stop points”.

**Guardrail:**
- Every action command must have:
  - the command
  - Expected Output
  - then 🟩 continue or 🟥 stop/paste

## 3) The 3-fail rule (hard stop → read-pack)
If we attempt 3 fixes and the problem mutates:
- STOP editing
- Run a single “read-pack” to dump relevant files/sections
- Then choose a simpler shape (patch vs rewrite) with the real facts in view

## 4) PowerShell “gotchas” we hit (and how we avoid them)

### `param()` must be first
In a `.ps1` script, `param()` must appear before any executable statement.

**Guardrail:** Anytime a script uses `param`, keep `param` as the first line.

### StrictMode makes small mistakes loud (good)
StrictMode is great for catching drift, but it requires careful string building.

**Guardrails:**
- Prefer single-quoted here-strings `@' ... '@` for literal content.
- If you must use double-quoted blocks, escape `$` as `` `$ `` inside the block.
- Keep generated content as static as possible.

## 5) Separate concerns: “truth generation” vs “prompt hook”
We got stability by splitting:
- a normal script that computes the “truth” output
- a prompt/profile hook that decides when to print it

**Guardrail:** Don’t bury logic inside a profile string if it can live in a normal `.ps1`.

## 6) Guardrails before writes (anti-clutter, anti-overwrite)
Before writing or mirroring anything:
- Print the exact targets (full paths).
- Ensure folders exist.
- Avoid writing to Desktop root or repo root unless explicitly intended.

**Guardrail:** Every “one-paste” that writes files must enumerate targets first.

## 7) Prefer “known-good primitives” over clever generation
When generation gets tricky:
- Use fewer layers (avoid nested here-strings).
- Build small, testable blocks.
- Run the smallest piece directly before wiring it into anything bigger.

## 8) Make drift visible early (the entire point of HARD TRUTH)
The footer is a drift alarm:
- Git clean/dirty
- Desktop root offenders
- Mirror file counts
- Backup marker presence
- Mirror ZIP drift check

**Guardrail:** If the footer is failing, fix that first — it is a safety system.

## 9) Paste discipline: never paste transcripts into PowerShell
- Do not paste lines beginning with `PS>` / `>>` or copied command output.
- PowerShell will try to execute them, causing cascading errors.

**Guardrail:** Paste **only clean commands** (no prompts, no output).

## 10) File edit workflow discipline (avoids “ghost editor” mistakes)
- Default to PowerShell read/overwrite (no editor assumptions).
- Prefer full-file replaces or a safe scripted patch — not manual line edits.

**Guardrail:** If we don’t have the current file content in chat, we must `Get-Content -Raw <path>` first.

## 11) No placeholders in paste-ready commands (real-path rule)
- Never run paste-ready commands containing fake/example paths like `FULL\PATH\TO\...`.
- Never use placeholder tokens inside paste-ready blocks (e.g. `PASTE_*_HERE`).

**Guardrail:** If a command refers to a path, it must be a real path in your environment.

## 12) Line endings: LF policy + staging failures
If Git refuses to stage due to line endings (example: `fatal: CRLF would be replaced by LF in <file>`), normalize to LF then stage:

- `$raw = Get-Content -Raw <path>`
- `$raw = $raw -replace "`r`n","`n" -replace "`r","`n"`
- `Set-Content -NoNewline -Encoding UTF8 <path> $raw`

## 13) Process hygiene: node / Next.js dev locks
- Prefer graceful stop (Ctrl+C in the dev-server window).
- Forced kill is last resort.
- `.next\dev\lock` is safe to remove only when the dev server is stopped.
- If node processes exist, inspect command lines before killing:
  - `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId,CommandLine`

## 14) Relative paths / PWD drift: the failure that *will* repeat unless we encode it

**Also (the "default page" trap):**
- A brand-new PowerShell window opens at `PS C:\Users\lsphi>` by default.
- Treat that as **RED** for any repo command (`git ...`, `.\scripts\...`, etc.) until you either:
  - `Set-Location "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"` (or run `fgs`), OR
  - use an absolute/runner entrypoint.

We hit a classic PowerShell failure:
- Running `.\scripts\fgs-save-shutdown.ps1` (or `scripts\...`) from `C:\Users\lsphi>` fails because the repo is not the current working directory.

**Guardrail (non-negotiable):**
- Never run relative repo scripts unless your PWD is the repo root:
  - `C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app`
- Preferred entrypoint is the shortcut/runner (works from anywhere):
  - `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\_RUNNERS\FGS_SAVE_SHUTDOWN.ps1"`
- Allowed entrypoint is absolute path to the repo script:
  - `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-save-shutdown.ps1"`
- If using a relative path, enforce a cd first:
  - `Set-Location "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"`

## 15) “Always re-read the rules” trigger (new chat / resume / save)
At the start of:
- new chat / resume / before save / after derailment

We must do a fast context refresh:
- SOP section “Command Gate System” + “Non-negotiable working-directory rule”
- this Lessons section “Relative paths / PWD drift” + “Command Gate”
Then proceed.

(We will automate this with a small script hook in `fgs-resume.ps1` and `fgs-save-shutdown.ps1`.)

## 16) Reuse shared UI primitives for consistency
When multiple pages need the same UX behavior, extract a shared component (example: `SourceLink` for short external URLs).

**Guardrail:** Prefer one shared component over copy/paste logic across pages.

---
Last updated: 2026-02-11

