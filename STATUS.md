# Farm Empire Status

## Current known-good checkpoint

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Head:** `feat: add first farm morning guide` (local; see Git history for hash)
- **Product state:** First Farm Morning V1 adds a runtime-only welcome only for untouched unmet farms, plus a DOM-free corn-delivery presenter. It truthfully routes prepare → plant → water → manual basket → barn/pickup → Mae → Eli, exposes `Pickup loaded · x/12 corn`, and never changes save, economy, or transaction authority. Farmbook separates Today’s delivery from Later on; one amber field pulse is suppressed during all competing work overlays.
- **Verification:** 268/268 tests passed, including 3 focused first-morning tests; strict typecheck, Vite production build, and `git diff --check` passed. Independent re-review found no High or Medium issue.
- **Browser:** Player-surface validation remains blocked: the prescribed in-app browser runtime exits with the recorded Windows ACL-helper failure. No standalone fallback was used.
## Current presentation
- A saved logical plot presents as one large 2.75-world-tile field section.
- The starter acreage is a data-defined 6x6 block (36 sections); the neighboring acreage is an 8x12 commercial tract (96 sections), 2.67 times the starter's working area.
- Existing plot IDs and planted crops remain compatible. Save schema v17 adds persisted hand-basket crops and destination; v16 grain-silo, v15 roadside-stand, v14 workforce, v13 trailer, v12 freight, v11 tractor restoration, v10 soil, v9 acreage, crops, pickup cargo, contact, field-kit, relief, loft, and catalog state remain intact.
- The Farm Empire renderer is isolated from the preserved legacy Paradise Isle renderer.
- A larger four-facing farmer, runtime-only farm dog Scout, and enlarged farm-only barn, tractor, and doghouse establish the current focal-art quality bar.
- Deterministic hay, crates, trough, pump, fences/gates, independent crop/tree motion, tractor exhaust, lamps, and off-field fireflies make the acreage feel occupied without adding interaction or saved state.
- The operated tractor now accelerates and brakes smoothly, turns with a deterministic heading, rolls its wheels, steers visibly, and keeps an upright direction-aware silhouette; all motion state remains transient.
- The owned old pickup has the same deterministic acceleration/turning presentation, a direction-aware upright silhouette, a 72-unit mixed seed/produce bed, persistent farm position, and transient operating state. The first completed Freight Board haul unlocks one visible $2,400 utility trailer that doubles real cargo capacity to 144.
- A signed road gateway now leads to a separate walkable County Service Center with three distinct buildings, three animated service townspeople, two clock-aware ambient residents, and real seed, market, land-record, and context-safe equipment services.
- Town actor motion, gestures, camera mode, and location remain transient. Saving in town preserves normal farm business state and reloads safely at the farm gateway.
- Farm-side Seed and Market surfaces are cargo-management points: crops and seed bags move reversibly between the barn/farm inventory and the pickup, while ordinary buying and selling are no longer available at the farm.
- Feed & Seed purchases, Grain Exchange sales, and the County Pantry delivery require the pickup at the County Service Center. On-foot visits remain useful for dialogue and inspection but fail closed for cargo transactions.
- Mae Carter's finite County Pantry corn order now measures real pickup corn; only Eli Morgan can consume exactly 12 hauled units and issue the atomic one-time payout.
- After that first delivery, Eli's County Freight Board posts one deterministic unlocked-crop haul per farm day. Accepted terms retain their exact quantity and 25% posted-rate premium across later market/day changes; exact pickup delivery pays once and a new route waits until a later farm day.
- Fresh farms inherit the Old Red Tractor in a visible repair state. The first County delivery unlocks its one-time $1,950 restoration; only then does the Equipment Desk sell the $1,250 Row-Crop Field Kit, whose bonuses apply only while the tractor is physically operated.
- Farm crops remain ready for a generous 15-minute real-time window, then visibly wither and can be cleared without refund so field sections are never permanently blocked.
- A true zero-asset farm may receive exactly one lifetime wheat seed from Mae; the claim is persisted and cannot be recycled through intentional crop loss.
- Manual harvest carries a visible 24-unit saved basket until atomically unloaded to its chosen barn or present pickup destination; basket contents count as assets for County relief and survive reload.
- Owning the neighboring parcel unlocks a one-time $1,800 Barn Loft Expansion that raises storage from 150 to 200 and visibly adds a lean-to to the barn.
- The crop catalog now contains corn, wheat, soybeans, potatoes, carrots, tomatoes, cabbage, and pumpkins. New crops start with zero seeds and unlock from the existing County-order, neighboring-parcel, and Barn Loft milestones without new saved license state.
- Carrots are a low-capital quick turn; tomatoes trade barn throughput for margin; cabbage is value-dense; pumpkins are the slowest, highest-gross, and consume three barn units per harvested item.
- The public-demo pass improves HUD/modal hierarchy, controls, feedback, transitions, and compact layouts without changing game transactions.
- Farm Empire now runs from `Farm Empire.lnk` on the real Windows Desktop without a terminal, browser tab, development server, or internet. The packaged shell loads only bundled files, keeps Node unavailable to game content, and stores saves under the stable `%APPDATA%\Farm Empire` profile.
- Farm and town cameras now fit their current scene, clamp panning so the playable mainland cannot be lost, refit on resize, and expose a persistent top-right menu with Resume, Save, Recenter, How to Play, and Save & Return to Farms.
- The pickup now parks at a visibly labeled barn cargo pad that is clear of the neighboring field and town gate. Its panel can route there in one click and opens the authoritative produce/seed controls on arrival; old saves parked exactly under the gate sign normalize safely to the pad without losing cargo.
- A humble starter farmhouse grows into a wider two-story home when the neighboring acreage is owned; expanded town-edge homes/field cues and one authoritative waypointed County road reduce empty visual space without inventing new services or crossing either workable acreage.
- The hand pump now points players to the field menu for the required first watering; deeper irrigation infrastructure remains deferred.
- The County now has deterministic clear, cloudy, and rainy farm days. A three-day Farmbook forecast supports planning; steady rain automatically supplies only the existing one-time establishment watering, while farm and town share wet lighting, visible rain, and a rain-shaped procedural ambience.
- Hovering focal objects now identifies what will open, and authoritative hit priority routes pickup, tractor, Scout, farmhouse, pump, barn, doghouse, gateway, acreage, fields, full townsperson silhouettes, and the parked County pickup to their correct interaction.
- The Farmbook consolidates the nine-step prepare, plant, water, harvest, load, town, trade, restore, and expand loop plus the live business snapshot and core routes without filling the world with buttons.
- After County trust and neighboring-acreage ownership, Farm Services hires Mara Bell. Workforce in the Farmbook or talking with Mara assigns one whole acreage at a time; her first assignment each farm day costs $120, later same-day assignments are covered, and the owner can continue working elsewhere or visit town.
- After County trust, Farm Services can build a $650 roadside produce stand. It fills one small barn-sourced local request per farm day at 90% of the posted County quote; while that order is open during business hours, a basket-carrying visitor walks the safe roadside shoulder to browse. The Grain Exchange and Freight Board remain the better-paying logistics routes.
- Farmer Knowledge V1 derives five presentation-only ranks and short evidence-sourced field notes from real planting, harvesting, hauling, selling, expansion, and County milestones; it adds no hidden yield or cash modifier and no save field.
- The homestead now has a larger farmhouse, pond, reeds, garden rows, flowers, destination pulses, and clearer field outlines; the County Service Center has larger edge homes, tighter framing, named hover cues, and a dedicated correctly scaled pickup bay away from the return sign.
- A zero-asset procedural soundscape adds filtered rural wind, tractor and pickup idle/motion tone, field-action feedback, transaction cues, and Scout feedback. The repetitive pitched wildlife loop was removed after owner playtesting. Global mute plus separate ambience/effects levels persist locally across farm slots without changing gameplay saves.

## Immediate authorized work

No additional feature package is currently active. First browser/playtest the manual harvest basket across destination switching, automatic unload/resume, cancellation, reload, full destinations, and mounted exclusion; the required browser pass was blocked by a Windows ACL-helper failure. Continue evaluating County life, weather readability, Mara's daily shift, the Freight Board/trailer, tractor restoration, row fieldwork, farmhouse growth, and storage pressure before selecting another finite package.

## Known limitations

- Equipment modal state can remain stale during standalone driving until reopened.
- Vehicle movement remains collision-free. Pickup gate travel follows the County road, while arbitrary yard/field clicks remain direct; the utility trailer is automatically attached rather than manually hitched. Implements, combines, ongoing condition, fuel, and a dealership economy remain deferred.
- The town currently has one compact service center, two non-interactive ambient residents, and one freight pickup presence, with no interiors, traffic, schedules, dialogue for passersby, or broad social simulation.
- The town remains a separate Canvas destination rather than one continuous farm-to-town regional map; surrounding houses and fields are presentation cues only.
- The County Freight Board offers one generated haul at a time and no deadline or penalty. There is no multi-job choice, negotiation, reputation, contract chain, hauling traffic, or general quest system yet.
- Eight crops, two working acreages, one farmhand, one roadside stand, one tractor kit, one storage upgrade, one pickup, and one utility trailer provide a bounded progression loop; further land tiers, crop inputs/quality, more local-order depth, trailers/implements, multiple workers, and managers remain deferred.
- Mara is one generalist with one concurrent acreage assignment and one daily shift price. She has no schedule, skill tree, housing, needs, payroll simulation, autonomous crop choice, multiple-worker coordination, or manager/passive-income layer.
- The enlarged fields intentionally expose current economy/storage limits: a full 96-section planting can exceed practical starting capital and a mature tract can exceed barn capacity. Partial work is supported, but pricing, yields, storage, and machinery progression still require the planned evidence-based economy study.
- Weather V1 has clear, cloudy, and steady-rain days only. Rain supplies the existing one-time establishment watering; recurring moisture, irrigation equipment, storms, drought, temperature, fertilizer, soil health, crop quality, and weather-driven yield modifiers are not implemented. Farmer Knowledge still has no skill choices or economic modifiers.
- Multi-section manual work intentionally automates walking and repeated short actions; it does not add pathfinding, stamina, tool durability, worker assignment, or a character-skill modifier.
- Audio is an original procedural V1: quiet filtered wind and a restrained rain mix replace the removed recurring wildlife notes; no recorded soundtrack, voice acting, spatial occlusion, or accessibility captions for environmental cues are included yet.
- The farmhouse has one land-derived visual tier but no separately purchased renovations, rooms, or functional bonuses. Tractor timing now has one finite first-restoration step, but later machinery tiers remain undesigned.
- Starting cash remains $5,000; no economy values were changed during this repair, pending an evidence-based proportional economy study.
- Crop withering uses wall-clock time and a 15-minute post-maturity window; this should be evaluated during the owner's first longer play session.
- The branch has not been pushed; external GitHub authorization is still required.
- Windows artifacts are local x64 builds and unsigned, so SmartScreen may warn. The executable retains Electron file metadata because this account cannot run the normal resource-edit helper; the supported Desktop shortcut and game window use the verified Farm Empire ICO explicitly.
- Desktop saves are intentionally separate from browser-hosted saves. Removing `%APPDATA%\Farm Empire` removes desktop saves; there is no automatic import, cloud sync, code signing, auto-update, or macOS/Linux package yet.
