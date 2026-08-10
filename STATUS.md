# Farm Empire V1 Status

## Project control

The durable Owner Console workflow is established in `docs/owner/OWNER_CONSOLE.md`. Farming Business V1 is the current known-good checkpoint. No Milestone 2 implementation package is authorized; the next action is owner discussion, prioritization, or Brainstorm Mode.

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

There is no lint script in this repository.

## Completed systems

- Fresh start: $5,000, one 3×3 field, 150-unit barn, visible operational old tractor, four starter seed types, and one visibly locked neighboring parcel.
- Crops: corn, wheat, soybeans, and potatoes with data-driven seed cost, growth time, yield, storage units, base price, procedural visuals, and visible stages.
- Business loop: buy seed, select crop, plant owned tiles, mature, harvest transactionally to finite storage, inspect prices/events, sell 1/chosen/all, and reinvest.
- Market: deterministic per world-seed/day, bounded to 65%–155% of base, current/previous movement, positive/negative temporary events, persistence, and expiration.
- Land: $6,500 one-time neighboring parcel purchase; exact cash deduction; nine additional usable plots; no repeat purchase; saved ownership.
- Equipment: structured old-tractor state, visible procedural vehicle, operational status panel, 20% faster field cycles, and +1 unit harvest yield.
- Save: schema v4, clean `farm-empire:*` localStorage namespace, 15-second autosave, manual save, safe nested defaults, and retained crops/storage/market/events/time/equipment/land.
- Legacy isolation: Paradise Isle modules, data, tests, attribution, and `paradise-isle:*` browser data remain preserved but are not reachable from the Farm Empire V1 surface.

## Verification

- `npm.cmd test`: 10 files, 88/88 tests passed (74 legacy + 14 Farm Empire).
- `npm.cmd run typecheck`: passed with strict TypeScript.
- `npm.cmd run build`: passed; Vite production bundle created.
- Browser acceptance: fresh launch, $5,000 start, seed purchase, selection, canvas planting, visible maturity, 9-unit corn harvest, storage, daily price movement, Wheat Surplus event persistence, chosen-quantity sale, exact $14.95 credit, seed reinvestment, insufficient-funds land rejection, funded parcel purchase, expansion-tile planting, manual save, and reload retention all passed.
- Clean browser reload console: zero errors.

## Screenshots

- `docs/screenshots/farm-empire-starter-farm.png`
- `docs/screenshots/farm-empire-expanded-farm.png`
- `docs/screenshots/farm-empire-market.png`

## Known issues / deliberate compromises

- The V1 rural farm still uses the inherited compact island-shaped procedural terrain. Farming presentation, fields, barn, rural paths, tractor, and parcel overlay are complete; a mainland terrain pass is deferred.
- Browser acceptance uses development-only, nearly invisible acceleration controls that are never instantiated in production. They mature crops, advance a day, and fund the land purchase test; there is no production cheat interface.
- `npm audit` reports 7 development-dependency findings (4 moderate, 2 high, 1 critical) in the locked toolchain. No forced dependency rewrite was applied during the gameplay milestone.

## Next recommended task

Discuss and package the next milestone with the owner. The leading roadmap candidate remains field-job batching and the first drivable/equippable tractor slice, but it is not yet authorized for implementation.
