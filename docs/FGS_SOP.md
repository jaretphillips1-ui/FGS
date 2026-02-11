# FGS SOP (Source of Truth)

## Why this exists (bulletproof rule)
This SOP is the safety system. If a step isn’t written here, it isn’t real.
We use this so we **don’t rely on memory**, and so a broken session can be recovered fast.

## Golden Rules (No Guessing)
- **No guessing, ever.**
- If the exact current file contents are **not already visible in the chat**, the next step is:
  - `Get-Content -Raw <path>` and paste the full file into chat.
- Only after we have the full current file do we rewrite/patch.

## Command Gate System (Green / Red pacing)
This is the required pacing system for all commands.

### Gate definitions
- **🟩 GREEN (OK to continue):** command succeeded and matches Expected Output.
- **🟥 RED (STOP + paste):** command errors OR output does not match Expected Output OR you feel unsure.

### How we run commands
For every “action command” (anything that changes state), we must:
1) State the command
2) State **Expected Output**
3) Run it
4) If Expected Output matches → 🟩 continue
5) If not → 🟥 stop and paste output

### Mandatory stop conditions
- Any error (non-zero exit, exception, red text)
- Any unexpected file path / missing file / “script not found”
- Any sign of drift (git dirty when expected clean, desktop offenders, missing markers)

### 3-fail rule (hard stop)
If we attempt 3 patches/fixes and it keeps mutating:
- STOP editing
- Run a single “read-pack” (dump relevant files/sections)
- Only then proceed with the next plan

(We will keep this rule consistent across chats.)

## File Edit Workflow (Default)
### Read
- You paste full file contents via PowerShell:
  - `Get-Content -Raw <path>`
  - (Optional) `Get-Content -Raw <path> | Set-Clipboard`

### Write (Default = PowerShell, no editor assumptions)
- We overwrite files using a **PowerShell here-string**:
  - `@' ...full final content... '@ | Set-Content -LiteralPath <path> -Encoding UTF8`
- We do **full-file replaces**, not line edits, unless we explicitly choose a safe scripted patch.

### Line endings (LF policy)
- Repo policy prefers **LF**.
- If Git refuses to stage due to line endings (example: `fatal: CRLF would be replaced by LF in <file>`), normalize to LF then stage:
  - `$raw = Get-Content -Raw <path>`
  - `$raw = $raw -replace "`r`n","`n" -replace "`r","`n"`
  - `Set-Content -NoNewline -Encoding UTF8 <path> $raw`
  - then `git add <path>`

### Safety & Backups
- Before overwriting, create a dated backup folder under:
  - `.patch_backups\<topic>_<yyyyMMdd_HHmmss>\`
- Backups must be explicit and scoped (avoid root/desktop clutter).

## Paste/Command Guardrails
- **No placeholder tokens** inside paste-ready code blocks (examples: `PASTE_*_HERE`).
- If final content is not ready, we do **not** run any overwrite command.
- If a command refers to a path, it must be a **real path** (no fake examples like `FULL\PATH\...` in paste-ready commands).

## PowerShell Window Rules
- Assume you will close the current PowerShell window after a command/paste.
- If a long-running process is needed (dev server), I must explicitly say:
  - “Keep this window open for the dev server”
  - and where to open a fresh window for edits/logs.

## ESLint (Flat Config)
- This repo uses flat config: `eslint.config.mjs`
- Do **not** use `.eslintignore` (unsupported).
- Ignore folders using `globalIgnores([...])` / `ignores` inside `eslint.config.mjs`.

## “Save FGS” Trigger
- Any phrasing like “save FGS” means:
  - Run the canonical **FGS: ONE TRUE SAVE + VERIFY + SHUTDOWN** procedure.

## “Switch chat” Trigger (hard save rule)
Before switching to a new chat (or when chat feels laggy / unreliable):
- Run **FGS: ONE TRUE SAVE + VERIFY + SHUTDOWN**
- AND create/refresh a **RECOVERY pack** (zip + checkpoint + repo bundle + manifest hashes)
- Only then switch chats

## Non-negotiable working-directory rule (the thing that broke today)

### The "default page" trap (new windows)
A new PowerShell window typically starts at `PS C:\Users\lsphi>`.
Treat that as **🟥 RED** for repo work until you re-enter via:
- `Set-Location "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"` (or run `fgs`)
- or a runner/absolute-path entrypoint.

**Never run** `.\scripts\...` or `scripts\...` unless your current directory is the repo root:
- `C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app`

If you are at `C:\Users\lsphi>` (or anywhere else), relative script paths will fail.

**Guardrail:** Use one of the “safe entrypoints” below every time.

## “Always re-read the rules” trigger (new chat / resume / save)
At the start of any of these moments:
- new chat / resume FGS / before save FGS / after any derailment

We must do a fast “context refresh”:
- open/read this SOP section (“Command Gate System”, “Non-negotiable working-directory rule”)
- open/read Lessons Learned section “Relative paths / PWD drift” + “Command Gate”
- then proceed

(We will automate this via a small script hook in `fgs-resume.ps1` and `fgs-save-shutdown.ps1`.)

---

# FGS: ONE TRUE SAVE + VERIFY + SHUTDOWN (Canonical)

## Canonical locations (do not improvise)
- Canonical save root:
  - `C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST`
- Desktop mirror (OneDrive Desktop folder-only):
  - `C:\Users\lsphi\OneDrive\Desktop\FGS`
- Local Desktop root mirror is **not enforced** and should usually be **absent**:
  - `C:\Users\lsphi\Desktop\FGS_LATEST.zip` (optional; typically not present)
- **Hard rule:** no local Desktop mirror folder:
  - `C:\Users\lsphi\Desktop\FGS` must not exist

## Safe entrypoints (use these, not memory)

### Preferred: use the shortcut / runner (works from any folder)
- Use the desktop shortcut:
  - **FGS - SAVE + SHUTDOWN.lnk**
- Or run the runner script directly:
  - `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\_RUNNERS\FGS_SAVE_SHUTDOWN.ps1"`

These do not depend on your current directory.

### Allowed: absolute-path to repo script (works from any folder)
- `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-save-shutdown.ps1"`

### Allowed: cd to repo first, then run repo script (only if you are in repo root)
- `Set-Location "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"`
- `& "scripts\fgs-save-shutdown.ps1"`

### Forbidden pattern (this is what caused the “not recognized” failure)
- Running:
  - `.\scripts\fgs-save-shutdown.ps1`
  - or `& "scripts\fgs-save-shutdown.ps1"`
- while NOT in the repo root.

If you are not already at repo root, use the runner/shortcut or absolute path.

## The procedure (what the save script must do)
The save/shutdown flow must:
- preflight `git status` clean
- run backup (`scripts\fgs-backup.ps1`)
- mirror canonical zip + checkpoint note into `OneDrive\Desktop\FGS`
- verify hashes (canonical == mirror)
- run `scripts\fgs-verify.ps1`
- run `scripts\fgs-verify-mirror.ps1`
- stop node/dev server if running
- clear `.next\dev\lock` if present
- end with PASS

## Verification scripts (manual expected commands)
- Repo verify:
  - `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-verify.ps1"`
- Mirror verify:
  - `& "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-verify-mirror.ps1"`

Scheduler scripts exist but are not part of the manual save flow:
- `scripts\fgs-scheduled-verify-install.ps1`
- `scripts\fgs-scheduled-verify-uninstall.ps1`

## Dev server/process hygiene
- If `fgs-verify.ps1` reports node processes running, confirm command lines before killing:
  - `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId,CommandLine`
- Prefer graceful stop (Ctrl+C in the dev-server window). Forced kill is last resort.
- `.next\dev\lock` is safe to remove only when dev server is stopped.

## Close-out Rule
- After a “save FGS” / end-of-session:
  - repo must be clean
  - verify must PASS
  - canonical zip and OneDrive Desktop mirror zip must hash-match
  - no node processes running
  - no `.next\dev\lock`


