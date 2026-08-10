# Farm Empire Agent Guide

## Working principles

- Preserve working systems instead of rewriting blindly. Inspect the relevant core, renderer, UI, and save paths before changing them.
- Use the project's existing architectural patterns: deterministic DOM-free logic in `src/core`, data tables in `src/data`, Canvas presentation in `src/render`, DOM overlays in `src/ui`, and orchestration in `src/game`.
- Keep gameplay logic deterministic and testable. Pass time and seeds explicitly; keep money in integer cents.
- Run unit tests, type checking, a production build, and browser verification after meaningful changes.
- Never declare success based only on compilation. Verify the player-facing workflow in a real browser and inspect console errors.
- Protect save compatibility through versioned migrations and defensive safe defaults. Corrupt or incomplete saves must fail safely.
- Keep one primary writer when multiple agents are involved. Read-only investigations may be delegated, but one agent integrates working-tree changes.
- Prioritize working gameplay over decorative scope. Complete the farming, storage, market, save, and expansion loops before polish.
- Preserve the MIT license and required attribution.

## Practical commands

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

There is currently no lint script. Do not invent a successful lint result.

