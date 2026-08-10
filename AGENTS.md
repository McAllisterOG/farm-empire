# Farm Empire Agent Guide

## Owner Console workflow

Farm Empire uses a durable Owner Console workflow. Read `docs/owner/OWNER_CONSOLE.md`, `PLAN.md`, `STATUS.md`, and relevant entries in `docs/owner/DECISIONS.md` before planning or authorizing project work. Use `docs/owner/WORK_LOG.md` for major completed packages and verification results.

- Owner Console is the planning and project-control layer, not the default implementation writer.
- Ordinary owner discussion does not authorize code or documentation changes. Clear language such as "build it", "implement that", "go ahead", or "proceed" authorizes a reasonably clear bounded package.
- The exact phrase `brainstorm` enters Brainstorm Mode. During that mode, discuss only: do not edit files, run implementation commands, dispatch implementation agents, commit, or record ideas as decisions. Stay in that mode until the owner says `end brainstorm`; then synthesize without implementing.
- Authorized implementation should normally be delegated to one primary writer with a finite scope and stopping condition. That writer may use a small number of read-only research agents. Avoid overlapping writers and recursive agent trees.
- Substantial milestones should normally receive one independent read-only Red Team review after implementation and testing. Use one bounded repair/re-review cycle unless a genuine critical defect remains.
- Do not create `/goal`, automation, or an open-ended persistent loop unless the owner explicitly requests it.
- Keep `STATUS.md` concise and current, `PLAN.md` as the roadmap, `DECISIONS.md` limited to approved durable decisions, and `WORK_LOG.md` limited to major completed packages. Do not turn ordinary chat into repository paperwork.
- No later milestone is authorized merely because it appears in the roadmap. Discuss and package it first; implement only after owner authorization.

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

## Model and usage efficiency

- Create Farm Empire tasks with `gpt-5.6-luna` at `medium` reasoning by default, including research, implementation, and review tasks.
- Do not use a Sol model, Fast mode/service-tier override, or reasoning above `medium` unless the owner explicitly authorizes that model and effort for a named finite task.
- Use the fewest tasks that materially improve the outcome. Prefer one bounded primary writer and add one independent reviewer only for a substantial checkpoint.
- Do not create parallel analyses when one Luna Medium task can answer the question. Stop or avoid redundant tasks as soon as sufficient evidence exists.
- A current task's model cannot be changed by child-task instructions; enforce this policy on every newly created or continued task through explicit model and reasoning settings.

## Practical commands

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

There is currently no lint script. Do not invent a successful lint result.
