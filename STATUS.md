# Farm Empire Status

## Current published checkpoint

- **Release:** Astra 3D Remaster, published and accepted 2026-09-06 (America/Chicago). All six authorized stages are complete; no later package is authorized.
- **Play:** https://farm-empire-hyle.onrender.com
- **Product SHA:** `4a4dd180565873ee4801dda68e25a620be5df07d`, normally fast-forwarded and pushed to `codex/first-town-contact` and `codex/astra-3d-remaster`. Later documentation receipts do not change deployed product code.
- **Render:** existing service `srv-da7sfo0u01pc73bsd4u0`, deployment `dep-daf41e740ujc739g74i0`, `Deploy succeeded | Live`, 23.5 seconds. Branch/configuration unchanged; auto-deploy remains disabled.
- **Result:** Genuine volumetric Farm/Town presentation, mesh picking aligned with the existing orthographic ground camera, original warm low-poly art, instanced crops and batched scenery, cargo/upgrade/work-aware machinery, shared day/weather inputs, phone Services chooser, bounded resource lifecycle and selectable classic Canvas fallback.
- **Authority:** Save v26, existing maps, deterministic gameplay, economy, crop timing, progression and local save ownership remain intact. Two separately approved pre-existing blockers were repaired: Kitchen carrot/tomato registry IDs (`6430c87`) and aggregate-sale UI feedback (`1d354b1`).

## Verification and release gate

- 405 tests / 65 files, strict typecheck, production web build and desktop-relative build pass. No lint script exists.
- One independent Luna Medium read-only review returned **SHIP, no findings** at the exact product SHA. It independently passed nine focused tests in four files, typecheck and actual 3D → Canvas → 3D browser lifecycle smoke. Owner Console accepted the gate; no repair cycle was needed.
- Local playthrough covered farming, storage, loaded pickup/tractor/wagon, 36-section harvesting, worker dispatch, Town purchase, Kitchen delivery, reserved freight, aggregate sale and exact save reload/old-version round trips.
- Hosted acceptance created `Astra Hosted QA 4a4dd18` in an empty Chrome slot, leaving the existing farm unopened and unchanged. Naming, first morning, prepare/plant/water/grow/harvest, automatic barn unload, menu/help, graphics toggles and save/title/online reload passed. Reload retained ten corn in barn, five seeds and $5,000.
- Hosted phone 390x844/844x390 and tablet 768x1024/1024x768 rotations passed without horizontal page overflow. Phone controls and modal close measured at least 44px; browser warning/error logs were empty. Ordinary online refresh upgraded the old app shell without clearing saves.
- Hosted main JS, lazy Three.js renderer, CSS and Three license are byte-identical to local accepted build. HTML, manifest and service worker match after carriage-return normalization; all checked assets/icons returned HTTP 200.
- Dense 132-section farm: 56 draw calls, 480,436 triangles, desktop render-submission P95 0.6 ms / about 28.7 FPS. Phone-size 3D P95 0.5 ms versus Canvas 9.5 ms on the same desktop browser; these are not physical-device GPU measurements.

## Restore and retained artifacts

- Original complete source `6779ee58a48fcc80b9f0836615ecea177961e41a` is preserved in published tag `pre-astra-3d-remaster`, branch `codex/pre-astra-3d-remaster` and a verified full-history bundle. Isolated clone/build/browser soil-preparation rehearsal passed; old/new save round trips retained business state.
- Original hosted product `9244e1e6eff84117fff4562c6a71010ad6de0c7d`, deploy `dep-dabmk5btqb8s73ct11kg`, still exposes Render Rollback after remaster publication. No live rollback was executed. See [restore procedure](docs/owner/PRE_ASTRA_ROLLBACK.md).
- Existing installed Windows package, Desktop shortcut, Paradise Isle code and MIT attribution remain preserved. No Windows package replacement was part of this web release.

## Limits and handoff

- Physical iPad/Safari, real multitouch, cold offline lazy-module behavior and real GPU-driver context loss remain unverified. Context loss/disposal have mocked-GPU unit coverage. Browser saves remain device/profile-local, with no cloud synchronization.
- Vite retains its 500 kB advisory for the lazy renderer chunk. Production dependency audit is clean; two pre-existing development-tool findings remain, also visible in Render build logs.
- Existing gameplay boundaries remain: separate Farm/Town scenes, collision-free vehicle movement, eight crops/two acreages/two reviewed workers, one freight job at a time, no passive/offline worker simulation or new economic systems. Prior history and detailed limitations remain in PLAN, DECISIONS and WORK_LOG.
- Full evidence and exact asset names: [verification](docs/owner/ASTRA_3D_REMASTER_VERIFICATION.md). Local synthetic screenshots, metrics and save fixtures: ignored `release/astra-qa/`.
