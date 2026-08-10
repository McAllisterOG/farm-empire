# Farm Empire Plan

## Vision

Farm Empire is an original isometric farming-business simulation: buy inputs, grow crops, manage limited storage, watch a deterministic commodity market, choose when to sell, and reinvest into land and equipment.

## V1 milestone

Deliver one complete desktop-browser loop with $5,000 starting cash, four crops, seed purchasing, planting and visible crop stages, capacity-aware harvest storage, daily commodity prices and temporary events, quantity-based selling, a locked neighboring parcel, a visible old tractor with a clear work-speed benefit, and reliable save/reload.

## Completed work

- Cloned the requested repository and created `codex/farming-business-v1` from `main`.
- Confirmed the original MIT license and attribution.
- Established a clean baseline: 74 tests, strict typecheck, production build, and browser load all pass with no console errors.
- Mapped the deterministic core, data registry, Canvas renderer, DOM UI, orchestration, and save migration seams.

## Acceptance criteria

- The complete buy → plant → grow → harvest → store → inspect market → sell → reinvest loop mutates one consistent saved game state.
- Market updates are deterministic, bounded, event-aware, and visible.
- Storage cannot silently lose crops and overselling is impossible.
- Land purchase deducts exact cash, cannot repeat, unlocks visible usable plots, and persists.
- The tractor is visible and its documented benefit affects field work.
- Fresh and incomplete/older saves load safely.
- Automated farm-business tests, all legacy tests, typecheck, build, and real-browser acceptance pass.

## Deferred features

- Vehicle driving physics, implements, combines, fuel, condition, dealerships, and crop hauling.
- Multiplayer, weather simulation, loans, complex financing, and commercial-farming endgame.
- Large custom-art production, character customization, and dozens of crops.

## Future milestones

1. Equipment and logistics: drivable tractor, implements, trailers, condition, and field-job batching.
2. Regional economy: contracts, transport, grain elevators, weather-linked supply, and operating costs.
3. Scale and depth: more parcels, workers, crop rotation, infrastructure, and long-form progression.

