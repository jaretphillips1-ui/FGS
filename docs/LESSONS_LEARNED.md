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

## 2) PowerShell “gotchas” we hit (and how we avoid them)

### `param()` must be first
In a `.ps1` script, `param()` must appear before any executable statement.  
If you put `Set-StrictMode` first, the script fails in surprising ways.

**Guardrail:** Anytime a script uses `param`, keep `param` as the first line.

### StrictMode makes small mistakes loud (good)
StrictMode is great for catching drift (like `$_` not existing), but it requires careful string building.

**Guardrail:** When generating scripts or profile blocks, avoid accidental interpolation of `$()`, `$var`, and `$_`:
- Prefer single-quoted here-strings `@' ... '@` for literal content.
- If you *must* use double-quoted blocks, escape `$` as `` `$ `` inside the block.
- Keep error messages static inside generated blocks unless you explicitly escape.

## 3) Separate concerns: “truth generation” vs “prompt hook”

We got stability by splitting:
- `scripts\fgs-truth.ps1` = **compute the footer text**
- Profile block / `prompt` = **decide when to print** + cache behavior

**Guardrail:** Don’t bury logic inside a profile string if it can live in a normal `.ps1`.

## 4) Guardrails before writes (anti-clutter, anti-overwrite)

Before writing or mirroring anything:
- Print the exact targets (full paths).
- Create a dedicated backup bucket (e.g., `scripts\_bak\YYYYMMDD_HHMMSS`).
- Backup any existing targets there (never Desktop root, never repo root).

**Guardrail:** Every “one-paste” should enumerate targets first.

## 5) Prefer “known-good primitives” over clever generation

When generation gets tricky:
- Use fewer layers (avoid nested here-strings).
- Build small, testable blocks.
- Run the smallest piece directly (call the script manually) before wiring it into the prompt.

**Guardrail:** Test the truth script alone (`& scripts\fgs-truth.ps1`) before installing the prompt wrapper.

## 6) Make drift visible early (the entire point of HARD TRUTH)

The footer is not “nice-to-have”; it’s a drift alarm:
- Git clean/dirty
- Desktop root offenders
- Mirror file counts
- Backup marker presence
- Mirror ZIP drift check

**Guardrail:** If the footer is failing, fix that first — it is a safety system.

## 7) Stop laser-focus: ask “What is the simplest shape?”

When stuck, answer these:
- What is the goal in one sentence?
- What is the simplest data shape?
- Can we split this into two scripts?
- Can we delete complexity instead of preserving it?

If the answer is “yes”, rewrite.

---
Last updated: 2026-02-05
