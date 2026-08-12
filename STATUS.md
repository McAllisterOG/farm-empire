# Farm Empire Status

## Current known-good checkpoint

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Head:** `679a9aa`
- **Product state:** Player Experience & Homestead Expansion V1 is complete. The visible farm is now the primary interface: focal objects own their correct context actions, overlap priority prevents the pickup/gateway and tractor/pickup failures, the compact Farmbook replaces redundant footer controls, Farmer Knowledge derives progress from real farm work, and the homestead/town presentation is denser and easier to navigate without changing save v9 or the economy.
- **Verification:** 185/185 tests passed; strict typecheck, Vite production build, and whitespace checks passed. Browser acceptance covered exact farm-object hover/click routing, crop-field actions, Farmbook guidance, barn/pickup produce and seed transfers, road-following on-foot and pickup County travel, town NPC and pickup interactions, return parking, Save & Return, and a clean console at 1280x720. The unpacked, portable, and NSIS x64 builds were rebuilt under `release/final`. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the current unpacked executable and launched responsive native processes; only the acceptance processes were closed.
- **Review:** A deep bounded adversarial review found one town-context camera leak and one field-cutting on-foot route. The repair hides the farm-only Farmbook action while in town, routes walking travel along the visible County road, and makes Escape cancellation safe. Transaction authority, save neutrality, corrupt-stat handling, vehicle overlap priority, and return normalization were also reviewed with no remaining high- or medium-severity finding.

## Current presentation

- A saved logical plot presents as one large 2.75-world-tile field section.
- The starter acreage is a data-defined 6x6 block (36 sections); the neighboring acreage is an 8x12 commercial tract (96 sections), 2.67 times the starter's working area.
- Existing plot IDs and planted crops remain compatible. Save schema v9 adds missing owned acreage sections defensively while preserving pickup cargo, contact, field-kit, relief, loft, and catalog state.
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
- A humble presentation-only farmhouse, expanded town-edge homes/field cues, and one authoritative waypointed County road reduce empty visual space without inventing new services or crossing either workable acreage.
- The hand pump now states that watering is not yet a gameplay system and crops currently grow automatically.
- Hovering focal objects now identifies what will open, and one authoritative hit-priority map routes pickup, tractor, Scout, farmhouse, pump, barn, doghouse, gateway, acreage, and fields to their correct interaction.
- The Farmbook consolidates the six-step farm loop, live business snapshot, barn/cargo, land, County road, save, and recenter actions without filling the world with buttons.
- Farmer Knowledge V1 derives five presentation-only ranks and short evidence-sourced field notes from real planting, harvesting, hauling, selling, expansion, and County milestones; it adds no hidden yield or cash modifier and no save field.
- The homestead now has a larger farmhouse, pond, reeds, garden rows, flowers, destination pulses, and clearer field outlines; the County Service Center has larger edge homes, tighter framing, named hover cues, and a dedicated correctly scaled pickup bay away from the return sign.

## Immediate authorized work

No new feature package is authorized. Owner-playtest the refreshed Windows Desktop build's world-first interactions, Farmbook, County hauling, Farmer Knowledge pacing, 6x6 starter acreage, 8x12 expansion, and camera framing before selecting the evidence-based economy study, a deeper knowledge/skills package, or another finite package.

## Known limitations

- Equipment modal state can remain stale during standalone driving until reopened.
- Vehicle movement remains collision-free. Pickup gate travel follows the County road, while arbitrary yard/field clicks remain direct; trailers, implements, combines, condition, fuel, and a dealership economy remain deferred.
- The town currently has one compact service center and one freight pickup presence, with no interiors, traffic, schedules, or broad social simulation.
- The town remains a separate Canvas destination rather than one continuous farm-to-town regional map; surrounding houses and fields are presentation cues only.
- The town story currently contains one deliberate first contact and one finite hauled order; there is no general quest, reputation, deadline, or repeat-contract system.
- Eight crops, two working acreages, one tractor kit, one storage upgrade, and one pickup provide a bounded progression loop; further land tiers, crop inputs/quality, trailers/implements, workers, and managers remain deferred.
- The enlarged fields intentionally expose current economy/storage limits: a full 96-section planting can exceed practical starting capital and a mature tract can exceed barn capacity. Partial work is supported, but pricing, yields, storage, and machinery progression still require the planned evidence-based economy study.
- Watering/irrigation is not implemented. Farmer Knowledge V1 records authentic actions and provides sourced notes, but has no skill choices, tutorial branches, or economic modifiers yet.
- The humble farmhouse has no upgrade mechanics yet, and the correct starting availability/timing of the tractor remains an open progression decision.
- Starting cash remains $5,000; no economy values were changed during this repair, pending an evidence-based proportional economy study.
- Crop withering uses wall-clock time and a 15-minute post-maturity window; this should be evaluated during the owner's first longer play session.
- The branch has not been pushed; external GitHub authorization is still required.
- Windows artifacts are local x64 builds and unsigned, so SmartScreen may warn. The executable retains Electron file metadata because this account cannot run the normal resource-edit helper; the supported Desktop shortcut and game window use the verified Farm Empire ICO explicitly.
- Desktop saves are intentionally separate from browser-hosted saves. Removing `%APPDATA%\Farm Empire` removes desktop saves; there is no automatic import, cloud sync, code signing, auto-update, or macOS/Linux package yet.
