# Farm Empire Status

## Current known-good checkpoint

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Head:** `ef8ca19`
- **Product state:** Farming Business V1, physical tractor operation and motion, the large rural farm presentation, Town Gateway - County Service Center, and First Town Contact + County Work Order are complete and browser-verified.
- **Verification:** 128/128 tests passed; strict typecheck passed; production build passed; Mae contact/acceptance, live barn progress, farm-market and barn delivery exclusion, Eli-only fulfillment, exact crop/payout accounting, save-v5 migration/reload, and clean current/fresh-tab browser consoles verified.
- **Review:** Independent Red Team accepted First Town Contact after one bounded repair/re-review made County fulfillment fail closed on the farm and available only through Eli's Grain Exchange; no findings remain.

## Current presentation

- A saved logical plot now presents as one large 2.75-world-tile field section.
- Each owned parcel reads as a 3x3 block of large field sections on a flat rectangular mainland.
- Saved coordinates, economy, crop counts, land ownership, and tractor jobs remain compatible; save schema v5 adds only defensive persistent town-contact status.
- The Farm Empire renderer is isolated from the preserved legacy Paradise Isle renderer.
- A larger four-facing farmer, runtime-only farm dog Scout, and enlarged farm-only barn, tractor, and doghouse establish the current focal-art quality bar.
- Deterministic hay, crates, trough, pump, fences/gates, independent crop/tree motion, tractor exhaust, lamps, and off-field fireflies make the acreage feel occupied without adding interaction or saved state.
- The operated tractor now accelerates and brakes smoothly, turns with a deterministic heading, rolls its wheels, steers visibly, and keeps an upright direction-aware silhouette; all motion state remains transient.
- A signed road gateway now leads to a separate walkable County Service Center with three distinct buildings, three animated townspeople, and real seed, market, land-record, and context-safe equipment services.
- Town actor motion, gestures, camera mode, and location remain transient. Saving in town preserves normal farm business state and reloads safely at the farm gateway.
- Mae Carter now introduces one finite County Pantry corn order whose progress comes from real barn storage; only Eli Morgan can accept the atomic one-time delivery and issue its fixed payout.

## Immediate authorized work

No further implementation package is currently authorized. The next owner session may consider the **County Row-Crop Field Kit** candidate: one post-contact Equipment Desk tractor upgrade with a visible toolbar and normalized existing tractor bonuses, packaged and reviewed before implementation.

## Known limitations

- Movement is straight-line and has no collision pathfinding.
- Equipment modal state can remain stale during standalone driving until reopened.
- Machinery motion is intentionally presentation-only; road routing, implements, condition, fuel, hauling, and equipment economy remain deferred.
- The town currently has one compact service center, no interiors, traffic, schedules, broad social simulation, or vehicle travel.
- The town story currently contains one deliberate first contact and one finite order; there is no general quest, reputation, deadline, hauling, or repeat-contract system.
- The branch has not been pushed; external GitHub authorization is still required.
