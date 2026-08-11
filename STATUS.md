# Farm Empire Status

## Current known-good checkpoint

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Head:** `62b6263`
- **Product state:** The complete farm/town loop now includes eight differentiated crops, milestone-derived crop unlocks, an expanded Seed Shop and market, the County Row-Crop Field Kit, recoverable withered crops, lifetime County seed relief, and a purchasable Barn Loft Expansion.
- **Verification:** 150/150 tests passed; strict typecheck, production build, and whitespace checks passed. Browser acceptance covered locked and compact crop ribbons, County-order carrot/tomato unlocks, north-parcel cabbage unlock, loft pumpkin unlock, tractor planting and exact 24-capacity pumpkin harvest, market sale, mounted save/reload, responsive presentation, and a clean console.
- **Review:** The Luna Medium writer completed the bounded catalog package. Independent-review task provisioning was unavailable, so the primary performed the targeted architecture, economy, save, UI, and browser review; the repair checkpoint closed fractional storage, ambiguous lock feedback, emergency-relief selection, carrot role, and legacy maturity-helper findings.

## Current presentation

- A saved logical plot now presents as one large 2.75-world-tile field section.
- Each owned parcel reads as a 3x3 block of large field sections on a flat rectangular mainland.
- Saved coordinates, economy, crop counts, land ownership, and tractor jobs remain compatible; save schema v7 carries the existing contact, field-kit, relief, and loft state, while the catalog adds no new version or unlock field.
- The Farm Empire renderer is isolated from the preserved legacy Paradise Isle renderer.
- A larger four-facing farmer, runtime-only farm dog Scout, and enlarged farm-only barn, tractor, and doghouse establish the current focal-art quality bar.
- Deterministic hay, crates, trough, pump, fences/gates, independent crop/tree motion, tractor exhaust, lamps, and off-field fireflies make the acreage feel occupied without adding interaction or saved state.
- The operated tractor now accelerates and brakes smoothly, turns with a deterministic heading, rolls its wheels, steers visibly, and keeps an upright direction-aware silhouette; all motion state remains transient.
- A signed road gateway now leads to a separate walkable County Service Center with three distinct buildings, three animated townspeople, and real seed, market, land-record, and context-safe equipment services.
- Town actor motion, gestures, camera mode, and location remain transient. Saving in town preserves normal farm business state and reloads safely at the farm gateway.
- Mae Carter now introduces one finite County Pantry corn order whose progress comes from real barn storage; only Eli Morgan can accept the atomic one-time delivery and issue its fixed payout.
- The County Equipment Desk sells one $1,250 Row-Crop Field Kit after the first order; its planting and harvest bonuses apply only while the tractor is physically operated, with a visible toolbar that lowers during field work.
- Farm crops remain ready for a generous 15-minute real-time window, then visibly wither and can be cleared without refund so field sections are never permanently blocked.
- A true zero-asset farm may receive exactly one lifetime wheat seed from Mae; the claim is persisted and cannot be recycled through intentional crop loss.
- Owning the neighboring parcel unlocks a one-time $1,800 Barn Loft Expansion that raises storage from 150 to 200 and visibly adds a lean-to to the barn.
- The crop catalog now contains corn, wheat, soybeans, potatoes, carrots, tomatoes, cabbage, and pumpkins. New crops start with zero seeds and unlock from the existing County-order, neighboring-parcel, and Barn Loft milestones without new saved license state.
- Carrots are a low-capital quick turn; tomatoes trade barn throughput for margin; cabbage is value-dense; pumpkins are the slowest, highest-gross, and consume three barn units per harvested item.
- The public-demo pass improves HUD/modal hierarchy, controls, feedback, transitions, and compact layouts without changing game transactions.

## Immediate authorized work

No further implementation package is authorized. The next step is owner playtesting; use that evidence to choose between physical equipment/logistics, additional acreage/storage, or the first worker/manager progression package.

## Known limitations

- Movement is straight-line and has no collision pathfinding.
- Equipment modal state can remain stale during standalone driving until reopened.
- Machinery motion is intentionally presentation-only; road routing, implements, condition, fuel, hauling, and equipment economy remain deferred.
- The town currently has one compact service center, no interiors, traffic, schedules, broad social simulation, or vehicle travel.
- The town story currently contains one deliberate first contact and one finite order; there is no general quest, reputation, deadline, hauling, or repeat-contract system.
- Eight crops, one neighboring parcel, one tractor kit, and one storage upgrade provide a bounded progression loop; additional acreage, crop inputs/quality, trailers/implements, physical transfers, workers, and managers remain deferred.
- Crop withering uses wall-clock time and a 15-minute post-maturity window; this should be evaluated during the owner's first longer play session.
- The branch has not been pushed; external GitHub authorization is still required.
