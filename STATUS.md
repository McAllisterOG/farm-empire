# Farm Empire Status

## Branch

`codex/farming-business-v1`

## Commands

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

## Current state

- Baseline clone and architecture review complete.
- Baseline: 74/74 tests pass; typecheck passes; build passes; original game loads in a browser with no console errors.
- Farming Business V1 implementation is in progress.

## Known issues

- No lint command is configured.
- `npm audit` reports 7 development-dependency vulnerabilities from the locked dependency tree; no automatic dependency rewrite has been applied.

## Next recommended task

Complete the core Farm Empire state/actions and wire the focused V1 UI and rural render layer.
