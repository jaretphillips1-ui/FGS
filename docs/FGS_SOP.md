# FGS SOP (Source of Truth)

## Golden Rules (No Guessing)
- **No guessing, ever.**
- If the exact current file contents are **not already visible in the chat**, the next step is:
  - `Get-Content -Raw <path>` and paste the full file into chat.
- Only after we have the full current file do we rewrite/patch.

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

## FGS: ONE TRUE SAVE + VERIFY + SHUTDOWN (Canonical)
### Canonical locations (do not improvise)
- Canonical save root:
  - `C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST`
- Desktop mirror (OneDrive Desktop folder-only):
  - `C:\Users\lsphi\OneDrive\Desktop\FGS`
- Local Desktop root mirror is **not enforced** and should usually be **absent**:
  - `C:\Users\lsphi\Desktop\FGS_LATEST.zip` (optional; typically not present)
- **Hard rule:** no local Desktop mirror folder:
  - `C:\Users\lsphi\Desktop\FGS` must not exist

### The procedure (preferred single command)
- Run:
  - `& "scripts\fgs-save-shutdown.ps1"`
- This must:
  - preflight `git status` clean
  - run backup (`scripts\fgs-backup.ps1`)
  - mirror canonical zip + checkpoint note into `OneDrive\Desktop\FGS`
  - verify hashes (canonical == mirror)
  - run `scripts\fgs-verify.ps1`
  - run `scripts\fgs-verify-mirror.ps1`
  - stop node/dev server if running
  - clear `.next\dev\lock` if present
  - end with PASS

### Verification scripts (expected tools)
- `scripts\fgs-verify.ps1` (repo + shortcuts + dev-lock + node check + zip status)
- `scripts\fgs-verify-mirror.ps1` (desktop mirror checks + hash compare)
- Scheduler scripts exist but are not part of the manual save flow:
  - `scripts\fgs-scheduled-verify-install.ps1`
  - `scripts\fgs-scheduled-verify-uninstall.ps1`

### Dev server/process hygiene
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
