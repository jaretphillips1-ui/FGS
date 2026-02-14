# STUDIO Standards (FGS)

## Purpose
FGS follows STUDIO pro-tier build standards (zero-cost):
- CI quality gates
- Environment discipline (.env.example)
- Small, safe changes (fishing-season priority)
- No placeholder tokens pasted into files

## Day-1 Pro Tier Checklist (Build-Only)
- CI runs: lint + typecheck + tests (if present)
- .env.example exists and stays non-secret
- Changes are small and reversible
- If CI fails, fix before moving on

## Environment Rules
- Never commit real secrets.
- Keep .env.local local only.
- Keep .env.example updated with variable names and comments.

## Scripts
- npm run lint
- npm run typecheck
- npm run build
