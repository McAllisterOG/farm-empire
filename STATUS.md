# Farm Empire Tractor Field Work Status

## Project control

The durable Owner Console workflow is established in `docs/owner/OWNER_CONSOLE.md`. Farming Business V1 plus the operated tractor field-work slice is the current known-good checkpoint. No later implementation package is authorized; the next action is owner discussion, prioritization, or Brainstorm Mode.

## Branch

`codex/tractor-field-work`

## Commands

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

There is no lint script in this repository.

## Completed systems

- Fresh start: $5,000, one 3×3 field, 150-unit barn, visible operational old tractor, four starter seed types, and one visibly locked neighboring parcel.
- Crops: corn, wheat, soybeans, and potatoes with data-driven seed cost, growth time, yield, storage units, base price, procedural visuals, and visible stages.
- Business loop: buy seed, select crop, plant owned tiles, mature, harvest transactionally to finite storage, inspect prices/events, sell 1/chosen/all, and reinvest.
- Market: deterministic per world-seed/day, bounded to 65%–155% of base, current/previous movement, positive/negative temporary events, persistence, and expiration.
- Land: $6,500 one-time neighboring parcel purchase; exact cash deduction; nine additional usable plots; no repeat purchase; saved ownership.
- Equipment: enter/exit workflow, mounted driver presentation, visible click-to-drive movement, saved fractional tractor position, operational status panel, 20% faster field cycles, and +1 unit harvest yield.
- Field jobs: deterministic serpentine traversal of either owned 3×3 parcel; sequential batch planting/harvesting through the existing transactional actions; live progress, partial-result summaries, and Escape cancellation.
- Save: schema v4, clean `farm-empire:*` localStorage namespace, 15-second autosave, manual save, safe nested defaults, and retained crops/storage/market/events/time/equipment/land.
- Tractor reload safety: completed actions and tractor position persist; active operation/jobs reset safely and the player reloads at a deterministic dismount offset.
- Legacy isolation: Paradise Isle modules, data, tests, attribution, and `paradise-isle:*` browser data remain preserved but are not reachable from the Farm Empire V1 surface.

## Verification

- `npm.cmd test`: 10 files, 93/93 tests passed (74 legacy + 19 Farm Empire).
- `npm.cmd run typecheck`: passed with strict TypeScript.
- `npm.cmd run build`: passed; Vite production bundle created.
- V1 browser acceptance: fresh launch, $5,000 start, seed purchase, selection, canvas planting, visible maturity, 9-unit corn harvest, storage, daily price movement, Wheat Surplus event persistence, chosen-quantity sale, exact $14.95 credit, seed reinvestment, insufficient-funds land rejection, funded parcel purchase, expansion-tile planting, manual save, and reload retention all passed.
- Tractor browser acceptance: enter, mounted presentation, click-drive, two-seed partial planting with seven safe skips, restock and finish, mature, sequential nine-tile harvest to exact 81/150 storage, cancellation, neighboring-parcel unlock/work, exit, mounted and unmounted save/reload, and safe dismount all passed.
- Clean browser reload console: zero errors.
- Independent Red Team: no CRITICAL, HIGH, or MEDIUM findings after one bounded repair/re-review cycle; final recommendation ACCEPT.

## Screenshots

- `docs/screenshots/farm-empire-starter-farm.png`
- `docs/screenshots/farm-empire-expanded-farm.png`
- `docs/screenshots/farm-empire-market.png`
- `docs/screenshots/tractor-field-work.png`

## Known issues / deliberate compromises

- The V1 rural farm still uses the inherited compact island-shaped procedural terrain. Farming presentation, fields, barn, rural paths, tractor, and parcel overlay are complete; a mainland terrain pass is deferred.
- Tractor driving is deliberately simple straight-line click movement without pathfinding, collision physics, implements, fuel, or condition.
- LOW: if the Equipment panel is opened during a standalone tractor drive, its disabled Exit state remains stale until the panel is closed and reopened.
- LOW: input handlers are not explicitly removed during `FarmEmpireApp.destroy()`; no current in-game task-switch path exercises the retained-handler risk.
- Browser acceptance uses development-only, nearly invisible acceleration controls that are never instantiated in production. They mature crops, advance a day, and fund the land purchase test; there is no production cheat interface.
- `npm audit` reports 7 development-dependency findings (4 moderate, 2 high, 1 critical) in the locked toolchain. No forced dependency rewrite was applied during the gameplay milestone.

## Next recommended task

Discuss and package the next milestone with the owner. Leading candidates are the first meaningful implement/equipment-choice slice or a farm-terrain/field-scale expansion, but neither is authorized.
