# Public Demo Polish Pass

## Scope

One presentation-only polish pass on the public Farm Empire player surface. The pass is capped at six cohesive improvements and does not alter gameplay, economy, transactions, renderer-world logic, or save compatibility.

## Ranked before audit

1. The HUD had weak interaction hierarchy: action buttons, status cards, crop selection, and contextual feedback used slightly different emphasis and had limited keyboard focus feedback.
2. The compact layout had no explicit overflow strategy for the top status row or crop/action strip, creating a risk of clipped controls at narrower supported widths.
3. Modal close controls were visually clear but lacked an accessible name, while dense market cards needed tighter compact-width wrapping.
4. Title save-slot cards read as clickable but did not provide a strong hover/focus treatment to distinguish load/new-farm actions from supporting text.
5. Contextual help and tractor-operation feedback appeared abruptly and had inconsistent line-height in dense states.
6. Disabled controls did not consistently suppress hover/pressed transforms, making blocked actions feel interactive.

## Implemented fixes

1. Added a consistent visible focus ring for buttons, inputs, links, and title slot targets; this makes keyboard navigation and Escape/modal testing easier to follow.
2. Added restrained hover/pressed/disabled states for Farm HUD cards, crop controls, and buttons, including a non-interactive disabled treatment.
3. Added compact-width overflow handling for the top HUD and crop strip, with action controls kept visible and compact market cards wrapping their sale controls instead of clipping.
4. Improved modal compact framing and added an explicit `Close panel` accessible label to every panel close button.
5. Added small contextual HUD/status entrance transitions with a `prefers-reduced-motion` override.
6. Improved title slot hover/focus styling and tightened compact presentation so the title, farm HUD, town HUD, and panels share a more coherent interaction language.

## Paired evidence

| Surface | Before | After |
| --- | --- | --- |
| Farm at 1280×720 | [before](../screenshots/demo-polish-before-farm-1280x720.png) | [after](../screenshots/demo-polish-after-farm-1280x720.png) |
| County Service Center at 1280×720 | [before](../screenshots/demo-polish-before-county-1280x720.png) | [after](../screenshots/demo-polish-after-county-1280x720.png) |
| Commodity Market panel at 1280×720 | [before](../screenshots/demo-polish-before-market-panel-1280x720.png) | [after](../screenshots/demo-polish-after-market-panel-1280x720.png) |
| Compact layout at 900×700 | [before](../screenshots/demo-polish-before-compact-900x700.png) | [after](../screenshots/demo-polish-after-compact-900x700.png) |

The before and after captures are matched by surface and viewport. Farm clock/camera state can differ because the demo clock advances while the browser is being exercised; no logical state or save schema was changed by the pass.

## Deferred issues

- The farm and town remain Canvas-first, so broad accessibility semantics for world objects and automated full-scene accessibility certification remain outside this visual pass.
- Movement remains straight-line and collision-free; no pathfinding or navigation polish was added.
- The County story remains one finite order; no quest log, deadlines, reputation, hauling, or broader town content was added.
- Existing developer test controls remain present and production-hidden by their existing styling.
- The browser run did not claim visual parity for every possible camera zoom level; the required 1280×720 and 900×700 surfaces were checked.

## Verification

- `npm.cmd test` — 134/134 tests passed across 17 files.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run build` — passed; Vite production bundle generated successfully.
- `git diff --check` — passed; only normal Git line-ending notices were reported.
- Real browser: fresh farm start/name prompt, save/load, farm HUD, crop selection, empty-field target/action menu, seed shop, market/storage, land, equipment, tractor enter/operate, partial 3×3 planting job, job completion feedback, tractor exit, County gateway, County HUD, Save from town, Return to Farm, modal close via Escape, and compact 900×700 layout.
- Browser console verification: no warning or error entries in the exercised tab.
