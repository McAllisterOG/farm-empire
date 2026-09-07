# Astra 3D Remaster verification

Local acceptance: 2026-09-06, branch `codex/astra-3d-remaster`. Publication remains pending independent Owner Console review. Original source checkpoint: `6779ee58a48fcc80b9f0836615ecea177961e41a`; original hosted product: `9244e1e6eff84117fff4562c6a71010ad6de0c7d`.

## Implemented presentation

Farm and Town use original volumetric low-poly Three.js meshes, shared materials, instanced crops, batched scenery, directional shadows, explicit day/weather inputs, upgraded buildings, eight crop identities/stages, cargo-aware vehicles, moving people/wheels and Scout. Fixed orthographic projection shares the existing ground camera; raised targets use mesh picking, while field footprints retain deterministic selection. Town gains a compact Services chooser using the existing walk-to-door service path. Phone panels retain 44px controls.

The existing game loop owns rendering. No new save version, economy, growth timing, collision map or simulation was introduced. Graphics preference is separate from save v26. Three.js loads lazily; classic Canvas remains selectable and handles unavailable WebGL. Resource disposal covers scene geometry, instances, material, shadow/GPU resources, listeners and late module loads. Paradise Isle source and attribution, original MIT license and installed Windows artifact remain preserved; Three.js MIT notice ships in public assets.

Two separately approved pre-existing blockers were isolated in commits: `6430c87` fixes Kitchen carrot/tomato registry IDs without changing its recipe/reward; `1d354b1` fixes aggregate sale feedback attempting a crop lookup for `batch`, without changing sale authority.

## Automated checks

- 405 tests in 65 files pass; strict TypeScript checking and production web build pass.
- Desktop-relative build passes; no Windows installer or installed executable was replaced.
- Projection tests cover 1280x800, 390x844, 844x390, 768x1024 and 1024x768 with pan/zoom, inverse ray projection and Town roof bounds.
- Lifecycle test uses real scenes/models with a mocked GPU: unchanged snapshots, bounded warm caches across four Farm/Town cycles, context-lost/restored behavior and idempotent disposal.
- Registry-correct Kitchen transaction tests cover exact/insufficient/excess cargo, pickup absence, unrelated seeds/produce, payout and normalized reload/once-only behavior. Real aggregate-sale feedback test preserves reserved freight and seeds with exact money and reload invariants.
- Synthetic fixture contains 132 ready sections, all eight crops, legitimate upgrades and explicitly synthetic funds/gates. No owner save was read into an artifact.
- Production dependency audit: zero vulnerabilities. Previously present development-tool findings remain outside this package; no blanket dependency upgrade was made.
- No lint script exists. Vite's >500 kB chunk advisory remains visible: the isolated lazy 3D chunk is 588.51 kB (153.40 kB gzip), rather than being added to title startup.

Final local web assets: `index-oCWsFj-v.js`, `threeFarmRenderer-Bxs8gmAy.js`, `index-BwFvHv6V.css`.

## Actual browser playthrough

Production preview on isolated origin `http://127.0.0.1:5193/`; existing saves found on another origin were not opened or modified.

- Fresh farm: prepare, plant, rain establishment, ready crop mesh selection, harvest 10 corn, unload to barn and reload; second planting manually watered during dry weather. Seed decrements and stored harvest persisted.
- Farm/Town round trip via operated pickup and County Road. Seed shop purchase put one corn seed bag in the pickup for $14. Farm Services and existing equipment/workforce routes opened correctly.
- Kitchen consumed exactly 8 corn, 6 carrot and 4 tomato and paid $115 once. Actual completed save persisted.
- Tractor unloaded its initial 160-lot wagon, harvested all 36 ready starter sections to 466/480, unloaded to barn and returned to parking. Pickup then loaded to 144/144 with seven seed bags retained.
- Accepted 18-carrot freight, sold 119 surplus produce for $681.26, then delivered the reserved carrots for $92.93. Reload preserved $73,511.47, seven seed bags, Kitchen completion and no active freight. Later real Mara dispatch charged the existing $120 wage and completed all 36 rework sections.
- Classic Canvas toggle and return to 3D worked during live crop play and dense fixture benchmarking. Title/load transitions worked repeatedly. Invalid backup failed without replacing farms; valid backup used only the empty third slot; full slots refused another import.
- Farm and Town inspected at desktop, phone portrait/landscape and tablet portrait/landscape, including live rotations. Town fits roof silhouettes; Services provides readable phone targets. Farm retains its established home-focused camera and pan/zoom access to neighboring acreage.
- Final browser log inspection contains only the historical, reproduced aggregate-sale error from the superseded build at 04:07:01 UTC, fixed and retested. No new warning/error appeared in the subsequent final-build checks.

## Performance evidence

Same desktop browser, emulated CSS viewports; recent 180-frame samples. Render time measures CPU submission, not completed GPU time. FPS is observed frame cadence; no claim about physical phone/iPad speed.

| Scene | Viewport | Draw calls | Triangles | P95 render ms | Observed FPS |
| --- | --- | ---: | ---: | ---: | ---: |
| 132-section 3D farm | 1280x800 | 56 | 480,436 | 0.6 | 28.74 |
| Same 3D farm | 390x844 | 55 | 480,412 | 0.5 | 28.64 |
| Same farm, Canvas | 390x844 | n/a | n/a | 9.5 | not instrumented |
| Same 3D farm | 768x1024 | 53 | 479,100 | 0.5 | 28.64 |
| Town 3D | desktop | 29 | 18,100 | 0.4 | 28.67 |

First dense implementation was 236 draw calls and approximately 1.52 million triangles. Batched static scenery and reduced small-plant tessellation materially reduced both. Dense warm cache: 52 models, 30 geometries and three textures. Initial maximum submission spike was 101.4 ms; steady-state percentile excludes neither normal frames nor manual sampling, but startup is outside the recent window. Screenshots compare the same fixture, not an artificially frozen identical clock.

## Save and rollback rehearsal

The permanent tag `pre-astra-3d-remaster` and branch `codex/pre-astra-3d-remaster` are published at original source `6779ee5`. Full-history bundle was verified and cloned into an isolated restore directory; original build reproduced `index-DBS9lLEM.js` and `index-U2W3TlJZ.css`. Real browser rehearsal created a disposable farm and prepared its first soil successfully with no console error.

Dense fixture and actual played remaster saves were read/serialized by the preserved original source and then read again by current source. Completed Kitchen/freight/sale save also passed this round trip with exact business state. Only pre-existing load-time clock re-anchoring and omission of zero-count cargo entries were normalized; no migration or owner save rewrite was needed. See [rollback procedure](PRE_ASTRA_ROLLBACK.md).

## Evidence and limits

Ignored local evidence directory: `release/astra-qa/`. Includes before/after desktop/phone/tablet screenshots; `rollback-played.png`; `kitchen-completed.png`; `market-freight-completed.png`; `dense-*-performance.json`; `town-performance.json`; synthetic and actual QA save round-trip files, plus original-source rehearsal tests. It contains no owner credentials or owner save data.

Physical iPad/Safari, real multi-touch gesture input, cold offline acceptance and real GPU driver context loss were not verified. Context recovery is unit-tested with mocked GPU events. Legacy Paradise Isle remains on its preserved Canvas code path and is not exposed by the Farm Empire title; no separate legacy browser playthrough is claimed. Installed Windows package was intentionally left unchanged. Independent review and exact hosted publication/acceptance are still required.
