# Astra 3D Remaster — authorized implementation plan

Owner authorization: full six-stage web remaster, local commits, exact GitHub publication and deployment to the existing Render service. One primary writer in `codex/astra-3d-remaster`; Owner Console remains read-only and supplies the independent review gate. No additional stage authorization is required.

## Ordered package

1. Preserve `6779ee58a48fcc80b9f0836615ecea177961e41a` with permanent annotated tag `pre-astra-3d-remaster`, branch `codex/pre-astra-3d-remaster`, published exact refs, and a verified full-history bundle. Rebuild/run the original from the bundle in an isolated directory. Record live product separately and capture baseline browser evidence.
2. Add a bounded Three.js presentation adapter over `RenderScene` and `TownRenderScene`. Fixed orthographic projection must agree numerically with existing camera ground mapping. Use geometry-based picking for raised objects; retain deterministic field footprint selection and active camera DOM anchors. Keep one simulation and animation loop, explicit resource disposal, scene cleanup, recoverable WebGL failure, and selectable Canvas fallback.
3. Remaster Home Farm with original low-poly volumetric buildings, machinery, eight crop identities/stages, people/Scout, paths and coherent landscape. Upgrade/load/work presentation reads existing authority. No new collisions, transactions, timings, balance or map layout.
4. Remaster existing Town with shared art resources, distinct existing services, NPCs, parked cargo vehicle, road and travel cues. Preserve exact service routes and round trip.
5. Refine unobtrusive UI, inspect matched images and make a bounded visual improvement pass. Verify production builds at desktop 1280x800, phone 390x844/844x390 and tablet 768x1024/1024x768 including live rotations. Exercise saves, fieldwork, cargo, vehicles, services, workers, dense farms, fallback and resource lifecycle. Run suite/typecheck/web/desktop-relative builds, old/new/old save invariants and frame-budget measurements. Distinguish emulation from physical-device acceptance.
6. Return tested review-ready checkpoint to Owner Console `01a057e7-8ed3-7093-94a6-32e2fe18a3c7`; pause writing for one independent Luna Medium review. Repair one bounded pass as needed, then integrate tested history normally into existing deployment branch and publish exact SHA to existing Render site. Verify deployment receipt, served release/bundles and hosted QA gameplay before declaring completion.

## Architecture and visual direction

Warm rural miniature with genuine volume, pitched roofs, readable crop silhouettes, restrained directional/ambient light and grounded shadows. Shared geometry/materials and instanced repetitive detail bound draw calls; cap DPR and shadow budget. Renderer state is disposable presentation derived from authoritative snapshots, never a second game state. Rendering preference is separate from save payload. Save v26, Paradise Isle, MIT attribution and old Windows artifact remain protected.

Primary documentation checked: [Three.js npm/Vite installation](https://threejs.org/manual/en/installation.html), [Render rollback behavior and retention](https://render.com/docs/rollbacks).

## Baseline inspection

Fresh verification on 2026-09-06 (local): original checkout and task worktree clean at `6779ee5`; GitHub deployment branch at `9244e1e`; Render confirms that exact product is Live as `dep-dabmk5btqb8s73ct11kg`, auto-deploy disabled, branch `codex/first-town-contact`, build `npm ci && npm run build`, output `dist`. Existing suite: 398 tests / 61 files pass. Production build/typecheck pass and reproduce `index-DBS9lLEM.js` + `index-U2W3TlJZ.css`. Bundle clone also builds those exact bundles.

QA uses fresh local origin `http://127.0.0.1:5193` after detecting existing saves on port 5178; those saves were not opened or modified. Restore rehearsal is served separately on port 5194. Evidence lives under ignored `release/astra-qa`; no owner save is a repository artifact. Baseline browser acceptance and later stages are still in progress.
