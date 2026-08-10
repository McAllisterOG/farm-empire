# Farm Empire Plan

## Vision

Farm Empire is an original isometric farming-business simulation: buy inputs, grow crops, manage limited storage, watch a deterministic commodity market, choose when to sell, and reinvest into land and equipment.

## V1 milestone — complete

Deliver one complete desktop-browser loop with $5,000 starting cash, four crops, seed purchasing, planting and visible crop stages, capacity-aware harvest storage, daily commodity prices and temporary events, quantity-based selling, a locked neighboring parcel, a visible old tractor with a clear work-speed benefit, and reliable save/reload.

## Operated tractor field-work milestone — complete

Make the old tractor a player-operated machine: enter or exit through the equipment UI, click-drive across the farm, and perform visible sequential planting or harvesting jobs across either owned 3×3 parcel in a deterministic serpentine route. Preserve the on-foot loop, existing transactional crop actions, safe partial outcomes, and save compatibility.

## Completed work

- Cloned the requested repository and created `codex/farming-business-v1` from `main`.
- Confirmed the original MIT license and attribution.
- Established a clean baseline: 74 tests, strict typecheck, production build, and browser load all pass with no console errors.
- Mapped the deterministic core, data registry, Canvas renderer, DOM UI, orchestration, and save migration seams.
- Added four data-driven business crops, exact integer-cent purchasing/selling, finite storage, and transactional harvest protection.
- Added deterministic bounded daily commodity prices, previous-price movement, saved temporary events, and 1/chosen/all selling controls.
- Added a saved accelerated farm clock, $6,500 neighboring parcel with nine permanent field tiles, and a visible structured old tractor with faster cycles and +1 harvest yield.
- Replaced the visible title/HUD/panels with a focused Farm Empire interface while retaining legacy systems behind the new entry point.
- Added a clean `farm-empire:*` save namespace, v4 migration support, defensive nested defaults, autosave, manual save, and reload retention.
- Added 14 farming-business tests; all 88 tests, typecheck, production build, and real-browser acceptance pass.
- Captured starter-farm, expanded-farm, and market screenshots in `docs/screenshots/`.
- Added mounted tractor operation, click-to-drive movement, deterministic parcel-job planning, sequential planting/harvesting, live progress, safe cancellation, and partial-result feedback.
- Preserved tractor position and completed work while treating active jobs as transient; mounted saves reload at a safe deterministic dismount position.
- Added five focused tractor/save tests; all 93 tests, typecheck, production build, primary browser acceptance, and independent Red Team review pass.
- Captured the operated tractor on the expanded farm in `docs/screenshots/tractor-field-work.png`.

## Acceptance criteria

- [x] The complete buy → plant → grow → harvest → store → inspect market → sell → reinvest loop mutates one consistent saved game state.
- [x] Market updates are deterministic, bounded, event-aware, persisted, and visible.
- [x] Storage cannot silently lose crops and overselling is impossible.
- [x] Land purchase deducts exact cash, cannot repeat, unlocks visible usable plots, and persists.
- [x] The tractor is visible and its documented benefit affects field work.
- [x] Fresh and incomplete saves load safely; legacy browser saves remain isolated and untouched.
- [x] Automated farm-business tests, all legacy tests, typecheck, build, and real-browser acceptance pass.

## Deferred features

- Vehicle driving physics, implements, combines, fuel, condition, dealerships, and crop hauling.
- Multiplayer, weather simulation, loans, complex financing, and commercial-farming endgame.
- Large custom-art production, character customization, and dozens of crops.

## Future milestones

1. Equipment and logistics continuation: implements, larger field-job shapes, trailers, condition, and more grounded vehicle movement. The first operated tractor and parcel-job slice is complete.
2. Regional economy: contracts, transport, grain elevators, weather-linked supply, and operating costs.
3. Scale and depth: more parcels, workers, crop rotation, infrastructure, and long-form progression.
