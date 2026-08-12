# Farm Empire Status

## Current known-good checkpoint

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Head:** `f3a687c`
- **Product state:** The physical farm/town hauling loop now has a first-play usability repair: fitted and bounded cameras, dependable recovery controls, title return without quitting, a dedicated barn cargo pad, context-correct vehicle panels, safe pickup/gateway separation, explicit watering guidance, and fuller farm/town edge framing. Save v8 and all business transactions remain compatible.
- **Verification:** 170/170 tests passed; strict typecheck, Vite production build, whitespace checks, and full npm audit with zero findings passed. Browser acceptance covered fresh $5,000 creation, farm/town framing at 2048x1152, 1280x720, and 760x640, aggressive pan clamping and recentering, hamburger menu/title return/re-entry, pickup and tractor panel separation, exact barn/pickup transfers, cargo-pad authority and away-from-pad rejection, pickup gate travel and safe return, pump guidance, responsive town footer, and zero console warnings/errors. All three Windows x64 deliverables were rebuilt; the exact OneDrive Desktop shortcut opened one responsive packaged window and closed normally with zero residual game processes, while target, working directory, icon, executable, and app bundle were read back successfully.
- **Review:** One bounded Luna Medium writer completed the repair. Independent Luna Medium review found stale cross-scene camera restoration and active-scene resize framing; both were repaired. Primary acceptance then caught and repaired a core/render dependency, on-foot town-save pickup teleport, input-listener duplication, cargo-pad/locked-field overlap, the road crossing the locked parcel, and legacy gate-position conflicts while preserving cargo.

## Current presentation

- A saved logical plot now presents as one large 2.75-world-tile field section.
- Each owned parcel reads as a 3x3 block of large field sections on a flat rectangular mainland.
- Saved coordinates, economy, crop counts, land ownership, and tractor jobs remain compatible; save schema v8 adds only the normalized pickup position and cargo while preserving the existing contact, field-kit, relief, loft, and catalog state.
- The Farm Empire renderer is isolated from the preserved legacy Paradise Isle renderer.
- A larger four-facing farmer, runtime-only farm dog Scout, and enlarged farm-only barn, tractor, and doghouse establish the current focal-art quality bar.
- Deterministic hay, crates, trough, pump, fences/gates, independent crop/tree motion, tractor exhaust, lamps, and off-field fireflies make the acreage feel occupied without adding interaction or saved state.
- The operated tractor now accelerates and brakes smoothly, turns with a deterministic heading, rolls its wheels, steers visibly, and keeps an upright direction-aware silhouette; all motion state remains transient.
- The owned old pickup has the same deterministic acceleration/turning presentation, a direction-aware upright silhouette, a 72-unit mixed seed/produce bed, persistent farm position, and transient operating state.
- A signed road gateway now leads to a separate walkable County Service Center with three distinct buildings, three animated townspeople, and real seed, market, land-record, and context-safe equipment services.
- Town actor motion, gestures, camera mode, and location remain transient. Saving in town preserves normal farm business state and reloads safely at the farm gateway.
- Farm-side Seed and Market surfaces are cargo-management points: crops and seed bags move reversibly between the barn/farm inventory and the pickup, while ordinary buying and selling are no longer available at the farm.
- Feed & Seed purchases, Grain Exchange sales, and the County Pantry delivery require the pickup at the County Service Center. On-foot visits remain useful for dialogue and inspection but fail closed for cargo transactions.
- Mae Carter's finite County Pantry corn order now measures real pickup corn; only Eli Morgan can consume exactly 12 hauled units and issue the atomic one-time payout.
- The County Equipment Desk sells one $1,250 Row-Crop Field Kit after the first order; its planting and harvest bonuses apply only while the tractor is physically operated, with a visible toolbar that lowers during field work.
- Farm crops remain ready for a generous 15-minute real-time window, then visibly wither and can be cleared without refund so field sections are never permanently blocked.
- A true zero-asset farm may receive exactly one lifetime wheat seed from Mae; the claim is persisted and cannot be recycled through intentional crop loss.
- Owning the neighboring parcel unlocks a one-time $1,800 Barn Loft Expansion that raises storage from 150 to 200 and visibly adds a lean-to to the barn.
- The crop catalog now contains corn, wheat, soybeans, potatoes, carrots, tomatoes, cabbage, and pumpkins. New crops start with zero seeds and unlock from the existing County-order, neighboring-parcel, and Barn Loft milestones without new saved license state.
- Carrots are a low-capital quick turn; tomatoes trade barn throughput for margin; cabbage is value-dense; pumpkins are the slowest, highest-gross, and consume three barn units per harvested item.
- The public-demo pass improves HUD/modal hierarchy, controls, feedback, transitions, and compact layouts without changing game transactions.
- Farm Empire now runs from `Farm Empire.lnk` on the real Windows Desktop without a terminal, browser tab, development server, or internet. The packaged shell loads only bundled files, keeps Node unavailable to game content, and stores saves under the stable `%APPDATA%\Farm Empire` profile.
- Farm and town cameras now fit their current scene, clamp panning so the playable mainland cannot be lost, refit on resize, and expose a persistent top-right menu with Resume, Save, Recenter, How to Play, and Save & Return to Farms.
- The pickup now parks at a visible barn cargo pad that is clear of the neighboring field and town gate. Produce/seed transfer is available only there, with explicit guidance elsewhere; old saves parked exactly under the gate sign normalize safely to the pad without losing cargo.
- A humble presentation-only farmhouse, expanded town-edge homes/field cues, and a routed two-layer farm road reduce empty visual space without inventing new services, changing saves, or crossing the locked parcel.
- The hand pump now states that watering is not yet a gameplay system and crops currently grow automatically.

## Immediate authorized work

No new feature package is authorized. Owner-playtest the refreshed Windows Desktop build's menu, camera, cargo pad, hauling route, and first farm/town loop before selecting Acreage & Field Geometry V2, Farmer Knowledge & Skills, or another finite package.

## Known limitations

- Equipment modal state can remain stale during standalone driving until reopened.
- Vehicle movement remains direct and collision-free; routed roads, trailers, implements, combines, condition, fuel, and a dealership economy remain deferred.
- The town currently has one compact service center and one freight pickup presence, with no interiors, traffic, schedules, or broad social simulation.
- The town remains a separate Canvas destination rather than one continuous farm-to-town regional map; surrounding houses and fields are presentation cues only.
- The town story currently contains one deliberate first contact and one finite hauled order; there is no general quest, reputation, deadline, or repeat-contract system.
- Eight crops, one neighboring parcel, one tractor kit, one storage upgrade, and one pickup provide a bounded progression loop; additional acreage, crop inputs/quality, trailers/implements, workers, and managers remain deferred.
- Current field geometry is still much smaller than the owner's desired future acreage. Expanding it safely requires a coordinated property, save, tractor-time, yield, storage, and economy design.
- Watering/irrigation and farmer knowledge levels are not implemented. The pump is decorative and guidance now says so accurately.
- The humble farmhouse has no upgrade mechanics yet, and the correct starting availability/timing of the tractor remains an open progression decision.
- Starting cash remains $5,000; no economy values were changed during this repair, pending an evidence-based proportional economy study.
- Crop withering uses wall-clock time and a 15-minute post-maturity window; this should be evaluated during the owner's first longer play session.
- The branch has not been pushed; external GitHub authorization is still required.
- Windows artifacts are local x64 builds and unsigned, so SmartScreen may warn. The executable retains Electron file metadata because this account cannot run the normal resource-edit helper; the supported Desktop shortcut and game window use the verified Farm Empire ICO explicitly.
- Desktop saves are intentionally separate from browser-hosted saves. Removing `%APPDATA%\Farm Empire` removes desktop saves; there is no automatic import, cloud sync, code signing, auto-update, or macOS/Linux package yet.
