# Pre-Astra rollback

Verified before remaster changes on 2026-09-06 (America/Chicago).

- Complete original source: `6779ee58a48fcc80b9f0836615ecea177961e41a`.
- Permanent annotated tag: `pre-astra-3d-remaster` (tag object `d9e8224a48fba7d94ac086181e6ea557915601d3`).
- Restore branch: `codex/pre-astra-3d-remaster`.
- Both refs were pushed individually to `https://github.com/McAllisterOG/farm-empire.git` and read back at the exact original source commit.
- Remaster work branch: `codex/astra-3d-remaster`.
- Actually live original product: `9244e1e6eff84117fff4562c6a71010ad6de0c7d` (the complete source adds only a publication receipt).
- Existing Render static site: `srv-da7sfo0u01pc73bsd4u0`, original live deploy `dep-dabmk5btqb8s73ct11kg`, [play](https://farm-empire-hyle.onrender.com).
- Live configuration read directly: branch `codex/first-town-contact`, automatic deploy **disabled**, build `npm ci && npm run build`, publish `dist`, empty root directory. Preserve these settings.
- Original product bundles: `index-DBS9lLEM.js`, `index-U2W3TlJZ.css`. Original source and isolated bundle restore both build these exact names.

## Local restore without disturbing current work

Choose a new empty directory. From PowerShell:

```powershell
git clone --branch codex/pre-astra-3d-remaster https://github.com/McAllisterOG/farm-empire.git C:\farm-empire-restored
Set-Location C:\farm-empire-restored
git switch --detach pre-astra-3d-remaster
git rev-parse HEAD
npm.cmd ci
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 5194 --strictPort
```

Expect HEAD `6779ee58a48fcc80b9f0836615ecea177961e41a`. Do not reset/clean the owner's current checkout. Use another unoccupied port if 5194 is already running.

A complete-history Git bundle is retained under ignored `release/astra-qa/pre-astra-3d-remaster.bundle` in the remaster worktree. `git bundle verify` passed. The actual rehearsal used:

```powershell
git clone --no-hardlinks release/astra-qa/pre-astra-3d-remaster.bundle release/astra-qa/restore-rehearsal
Set-Location release/astra-qa/restore-rehearsal
git switch --detach pre-astra-3d-remaster
npm.cmd ci
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 5194 --strictPort
```

Bundle clone may report no default HEAD until the explicit tag checkout. Rehearsal installation and production build passed. Actual isolated browser play created Rollback Rehearsal QA and prepared one soil section with no console errors; rollback-played.png records the result.

## Hosted restore

Open the existing site's [Deploys page](https://dashboard.render.com/static/srv-da7sfo0u01pc73bsd4u0/deploys). After remaster publication, find original deploy `dep-dabmk5btqb8s73ct11kg` / commit `9244e1e`, choose **Rollback**, inspect the confirmation target, and choose **Rollback to this deploy**. Verify the resulting successful deployment and original bundle names. Do not change services or branches. This operation was not executed during rehearsal because it would change production.

Render's [documented rollback](https://render.com/docs/rollbacks) reuses retained build artifacts; retention is finite. Before remaster, the original is the current Live artifact and several preceding deploys expose working Rollback links. If its artifact is later unavailable, use this same site's **Manual Deploy → Deploy a specific commit** and select full original product SHA `9244e1e6eff84117fff4562c6a71010ad6de0c7d`; rebuild with the unchanged configuration. Inspect the final target before triggering. Never force-push the deployment branch to perform rollback. After restoration, the branch may still contain remaster source, so leave auto-deploy disabled until a reviewed forward repair.

## Saves and owner artifacts

The remaster must preserve save v26 in both directions. Browser saves belong to their origin/profile, not Git or Render. Rolling back code does not roll back save data or synchronize devices. Export a save through the normal UI before rollback when practical; never clear site data to refresh code. Verify served release identity and reload normally while online; offline devices can retain an earlier app shell. Synthetic QA fixtures prove compatibility separately from the owner's real saves.

The existing `release/demo-complete-v1/verified-win-unpacked/Farm Empire.exe` and Desktop shortcut are outside this web publication and remain untouched.

Post-publication verification (2026-09-06): remaster product `4a4dd18` is Live as `dep-daf41e740ujc739g74i0`. The original `dep-dabmk5btqb8s73ct11kg` still exposes its exact Rollback link. No rollback was executed; disabled auto-deploy, permanent source refs, bundle and installed Windows artifact are preserved.
