\# FGS — START HERE (One True SOP)



This file is the single source of truth for starting, resuming, saving, and shutting down the Fishing Gear System (FGS).



Repo root:

C:\\Users\\lsphi\\OneDrive\\AI\_Workspace\\FGS\\fgs-app



Canonical saves:

C:\\Users\\lsphi\\OneDrive\\AI\_Workspace\\\_SAVES\\FGS\\LATEST



Desktop mirror (ONLY mirror we use):

C:\\Users\\lsphi\\OneDrive\\Desktop\\FGS\\FGS\_LATEST.zip



---



\## Resume FGS (every session)



Open a fresh PowerShell 7.5.4 window and run:



1\) Set-Location "$env:OneDrive\\AI\_Workspace\\FGS\\fgs-app"

2\) git status

3\) git log -1 --oneline



If the working tree is clean and the latest commit is expected:

\- Start the dev server using the Desktop shortcut: \*\*FGS GO\*\*



Notes:

\- Keep the dev-server PowerShell window open while using the app.

\- For edits / log capture while dev server runs, open a separate fresh PowerShell window.



---



\## Save FGS / Save FGS here (canonical procedure trigger)



Any phrasing like “save FGS” means: run the ONE TRUE Save + Verify + Shutdown flow.



Use the Desktop shortcut:

\- \*\*FGS - SAVE + SHUTDOWN\*\*



This should:

\- Verify repo status (clean)

\- Create/update canonical ZIP(s) under \_SAVES\\FGS\\LATEST

\- Mirror the latest ZIP to OneDrive Desktop\\FGS

\- Stop the dev server cleanly (no Next.js lock)



---



\## What we DO NOT do



\- Do not keep two different Desktop mirrors.

\- Do not use a second “resume” shortcut if it’s redundant.

\- Do not rely on random Desktop notes. This file replaces them.



---



\## Quick sanity checks



Repo status:

\- git status



Latest commit:

\- git log -1 --oneline



If dev server won’t start:

\- ensure no prior node instance is running

\- remove any Next.js dev lock file if present under .next\\dev\\ (only if needed)



---



\## UI rule



Rod length entry/display is always in feet + inches (not inches-only).



