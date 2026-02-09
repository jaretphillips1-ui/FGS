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

### Safety & Backups
- Before overwriting, create a dated backup folder under:
  - `.patch_backups\<topic>_<yyyyMMdd_HHmmss>\`
- Backups must be explicit and scoped (avoid root/desktop clutter).

## Paste/Command Guardrails
- **No placeholder tokens** inside paste-ready code blocks (examples: `PASTE_*_HERE`).
- If final content is not ready, we do **not** run any overwrite command.

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
