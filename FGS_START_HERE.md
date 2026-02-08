# FGS — START HERE (One True SOP)

This file is the **single source of truth** for starting, resuming, saving,
verifying, and shutting down the Fishing Gear System (FGS).

If anything conflicts with this file, **this file wins**.

This SOP is intentionally strict. That strictness is what keeps FGS
recoverable, professional, and drift-free.

---

## Canonical locations (NON-NEGOTIABLE)

**Repo root**
C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app

**ONE TRUE SAVE location**
C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST

This folder is the canonical source of all saved state.

**Desktop mirror (ONLY allowed mirror)**
C:\Users\lsphi\OneDrive\Desktop\FGS

Expected contents of `Desktop\FGS`:
- `FGS_LATEST.zip`
- `FGS_LATEST_CHECKPOINT.txt`

No other Desktop mirrors are allowed.

Root-level Desktop ZIPs (e.g. `Desktop\FGS_LATEST.zip`) are considered
**legacy clutter** and should be removed if found.

---

## Resume FGS (every session)

Open a **fresh PowerShell 7.5.4** window and run:

1) `Set-Location "$env:OneDrive\AI_Workspace\FGS\fgs-app"`
2) `git status`
3) `git log -1 --oneline`

Proceed only if:
- the working tree is clean
- the HEAD commit is expected

➡ Start the dev server using the Desktop shortcut:  
**FGS GO**

### Notes
- Keep the dev-server PowerShell window open while using the app.
- For edits or log capture while the dev server runs, open a **separate**
  fresh PowerShell window.
- Never paste terminal transcript text directly into PowerShell.

---

## Save FGS — Canonical Trigger (NON-NEGOTIABLE)

Any phrasing like:
- “save FGS”
- “save here”
- “lock this in”

means:

**Run the ONE TRUE Save + Verify + Shutdown flow.**

Use the Desktop shortcut:  
**FGS - SAVE + SHUTDOWN**

This flow will:
- Refuse to run if the repo is dirty (unless explicitly forced)
- Create/update canonical ZIP(s) under `_SAVES\FGS\LATEST`
- Mirror the latest ZIP + checkpoint to `OneDrive\Desktop\FGS`
- Enforce retention policy on old timestamped ZIPs
- Stop the dev server cleanly
- Clear any Next.js dev lock
- Perform final drift verification

If this step fails:
- **Do not continue working**
- Fix the reported issue first

---

## Drift protection (professional-grade)

FGS has **four layers of drift protection**:

### 1) Manual (human)
- This file (`FGS_START_HERE.md`)
- You following the Resume / Save procedures exactly

### 2) Local scripted
- `scripts\fgs-backup.ps1` — canonical ZIP creation + retention
- `scripts\fgs-verify.ps1` — repo + runtime integrity
- `scripts\fgs-verify-mirror.ps1` — ZIP + mirror hash integrity
- `scripts\fgs-save-shutdown.ps1` — orchestrated end-of-session flow

You may manually run:
```powershell
.\scripts\fgs-verify.ps1
