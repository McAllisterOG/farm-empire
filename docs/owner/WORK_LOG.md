# Farm Empire Work Log

Record major completed packages and stable checkpoints here. Keep day-to-day chat and minor edits out.

## Farming Business V1 - complete

- **Date:** 2026-08-09
- **Branch:** `codex/farming-business-v1`
- **Commits:** `ce100df`, `7a520ba`, `e29464b`, `75e5024`
- **Result:** Implemented the complete seed-to-expansion farming-business loop with four crops, finite barn storage, deterministic commodity prices and temporary events, selling and reinvestment, a purchasable neighboring parcel, structured old-tractor benefits, focused Farm Empire UI, and save schema v4.
- **Verification:** 88/88 tests passed; strict typecheck passed; production build passed; fresh-save browser acceptance and save/reload passed; clean browser reload had zero console errors.
- **Push:** `origin/codex/farming-business-v1`
- **Known limitations:** Compact inherited island terrain, straight-line movement, abstract non-drivable tractor, and deferred equipment/logistics/business depth.

## Owner Console infrastructure - complete

- **Date:** 2026-08-09
- **Branch:** `codex/farming-business-v1`
- **Scope:** Documentation and coordination workflow only; no gameplay code or Milestone 2 work.
- **Result:** Added durable game-vision, recovery, discussion, Brainstorm Mode, authorization, bounded worker, Red Team, decision-record, work-log, and checkpoint-maintenance documentation.
- **Verification:** Documentation read-back, Git diff review, and whitespace validation.

## Operated tractor field work - complete

- **Date:** 2026-08-10
- **Branch:** `codex/tractor-field-work`
- **Commits:** `fd1dcd0`, `0690cda`
- **Scope:** Operated old tractor, click-to-drive movement, and sequential batch planting/harvesting across one owned 3×3 parcel at a time; no advanced vehicle or logistics systems.
- **Result:** Added deterministic serpentine parcel planning, mounted presentation, live job progress, safe partial outcomes and cancellation, persisted tractor position, and safe dismount behavior after mounted saves while preserving the on-foot loop.
- **Verification:** 93/93 tests passed; strict typecheck passed; production build passed; primary and Owner Console browser acceptance passed; console had zero warnings/errors.
- **Review:** Independent Red Team found no CRITICAL/HIGH issues, identified one mounted-save MEDIUM defect, and accepted the milestone after one repair/re-review cycle with no remaining MEDIUM findings.
- **Screenshot:** `docs/screenshots/tractor-field-work.png`
- **Known limitations:** Straight-line movement has no pathfinding/collision physics; Equipment panel state may remain stale during standalone driving until reopened; retained input-listener cleanup is a deferred LOW lifecycle concern.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Farm Scale & Terrain Overhaul - complete

- **Date:** 2026-08-10
- **Branch:** `codex/farm-scale-overhaul`
- **Commits:** `4286383`, `4cf6d00`, `fedeff2`
- **Scope:** Save-compatible presentation projection, large field sections, 3x3 parcel-scale land, flat mainland terrain, rural framing, denser crop rows, and stronger barn/tractor silhouettes; no economy, simulation, or save-schema changes.
- **Result:** Replaced the compact inherited island view with a substantially larger working farm while preserving logical plot coordinates, input behavior, land ownership, tractor jobs, and old saves.
- **Verification:** 98/98 tests passed; strict typecheck passed; production build passed; fresh and expanded farm browser acceptance, crop interaction and harvest, land purchase, tractor entry, mounted save/reload, and clean console verified.
- **Review:** Independent Red Team found no MEDIUM-or-higher issues and accepted the milestone after one bounded cleanup of legacy path diamonds, grass variation, terminology, and footprint regression coverage.
- **Screenshots:** `docs/screenshots/farm-scale-starter-crops.png`, `docs/screenshots/farm-scale-expanded-property.png`
- **Known limitations:** The farmer and farm focal objects remain small relative to the new field scale; the next bounded package addresses farmyard identity and life.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Farmyard Identity Slice - complete

- **Date:** 2026-08-10
- **Branch:** `codex/farmyard-identity`
- **Commits:** `714da7c`, `89f636d`, `3481ea4`, `004e2e3`, `720eddb`, `eb10f20`, `c770732`
- **Scope:** Larger animated farm-only farmer; transient Scout follow/home/sit/scratches behavior; detailed farm-only barn, tractor, and doghouse art; no save, economy, quest, adoption, or legacy-system changes.
- **Result:** Added a visibly larger four-facing rural farmer, an expressive farm dog who follows on foot and rests during tractor work, reliable near/far scratches with visible heart feedback, and farmyard focal objects scaled to the enlarged property.
- **Verification:** 104/104 tests passed; strict typecheck and production build passed; browser acceptance covered movement/facing, Scout follow and held far approach, scratch feedback, tractor home travel/sit/exit resume, barn/tractor/field interactions, alternate-click cancellation, save/reload, and a console with zero warnings/errors.
- **Review:** Independent Red Team accepted after the bounded repair/re-review closed teleport, depth sorting, missing focal-art, delayed-menu, and travel-pose findings; no MEDIUM-or-higher issues remain.
- **Screenshots:** `docs/screenshots/farmyard-identity-on-foot.png`, `docs/screenshots/farmyard-identity-tractor.png`
- **Known limitations:** Scout has no persisted bonding/economy system by design; the large open yard still needs more non-interactive rural set dressing and ambient motion.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Farm Atmosphere & Set Dressing Slice - complete

- **Date:** 2026-08-10
- **Branch:** `codex/farm-atmosphere`
- **Commits:** `cb8f67e`, `60b5a0c`, `8708898`
- **Scope:** Render-only deterministic hay, crates, trough, pump, fence/gate cues, independent crop/tree motion, tractor exhaust/dust, farm-clock day/night lighting, lamps, and six safe off-field fireflies.
- **Result:** Filled the enlarged farm's empty service areas and added restrained ambient life while preserving every field, barn, tractor, land, Scout, movement, and save interaction.
- **Verification:** 107/107 tests passed; strict typecheck and production build passed; browser acceptance covered readable day/night presentation, clock/lighting agreement, props, Save, tractor interaction, reload, and a fresh-tab console with zero warnings/errors.
- **Review:** Independent Red Team found no MEDIUM-or-higher issues, then accepted the bounded firefly-fade and farm-clock lighting repair.
- **Screenshots:** `docs/screenshots/farm-atmosphere-day.png`, `docs/screenshots/farm-atmosphere-night.png`
- **Known limitations:** Decorative gates and props intentionally have no collision or interactions; broader weather, animals, story, and equipment systems remain deferred.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Operated Tractor Motion & Silhouette - complete

- **Date:** 2026-08-10
- **Branch:** `codex/machinery-motion-v2`
- **Commit:** `98e9e83`
- **Scope:** Runtime-only tractor acceleration, braking, bounded turning, wheel roll, steering, direction-aware effects, and upright isometric presentation; no save, economy, collision, routing, implement, or field-transaction changes.
- **Result:** Replaced constant-rate sliding with deterministic eased travel while preserving exact target snapping and existing click-drive and sequential 3x3 job callbacks. The farm tractor now visibly turns, steers, rolls, and reverses without rotating its flat cab sideways.
- **Verification:** 113/113 tests passed; strict typecheck and production build passed; browser acceptance covered directional driving, cancellation, exact reverse travel, a complete 9-section planting job, exit, save/reload, and zero console warnings/errors.
- **Review:** Independent Red Team identified exact-opposite heading degeneration and vertical-screen sideways rotation as MEDIUM findings; one bounded repair/re-review added deterministic angular U-turns and a clamped upright pose, then accepted with no remaining MEDIUM-or-higher issues.
- **Known limitations:** Motion remains direct and collision-free; implements, fuel, condition, road routing, hauling, and equipment economy remain deferred.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Town Gateway - County Service Center - complete

- **Date:** 2026-08-10
- **Branch:** `codex/town-gateway`
- **Commit:** `b698575`
- **Scope:** Signed farm gateway, separate walkable town scene, three functional service buildings, three animated rural NPCs, town HUD, shared farm-clock lighting, and save-safe farm return; no interiors, traffic, social system, vehicle travel, legacy currency, or town save fields.
- **Result:** Created a real rural destination where the seed supplier, commodity market, land records, and Equipment Desk exist as physical storefronts and townspeople. The Equipment Desk remains context-safe and cannot operate the tractor.
- **Verification:** 123/123 tests passed; strict typecheck and production build passed; browser acceptance covered mounted rejection, on-foot travel, all NPC/building services, exact seed and grain transactions, town day/night, save-in-town reload, return restoration, compact layout, Escape cancellation, and clean current/fresh-tab consoles.
- **Review:** Independent Red Team found one live-resize/input MEDIUM plus delayed-callback and plaza-footprint LOWs; one bounded repair/re-review added resize lifecycle handling, cancellable town walks, and exhaustive public-segment/building separation, then accepted with no remaining findings.
- **Known limitations:** One compact outdoor service center only; no interiors, schedules, traffic, broad story/social model, town vehicles, or hauling.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## First Town Contact + County Work Order - complete

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Commit:** `ef8ca19`
- **Scope:** One persistent Mae Carter introduction and one finite County Pantry corn order fulfilled only through Eli Morgan; no generic quests, reputation, deadlines, RNG, repeat contracts, hauling, or social-system revival.
- **Result:** Added a data-defined 12-corn order with live barn-derived progress, atomic one-time 8,500-cent fulfillment, named town dialogue, an Eli-only delivery card integrated with the ordinary market, and defensive save-v5 migration/defaults.
- **Verification:** 128/128 tests passed; strict typecheck and production build passed; browser acceptance covered Mae offer/acceptance, active save/reload, insufficient and ready progress, farm HUD and barn delivery exclusion, Eli delivery, exact $85/storage changes, completion persistence, ordinary market continuity, and clean current/fresh-tab consoles.
- **Review:** Independent Red Team found one MEDIUM context leak that exposed delivery in farm-side market panels; one bounded repair/re-review added an explicit fail-closed market context and was accepted with no remaining findings.
- **Known limitations:** The first town story is deliberately finite; there is no general contract log, repeat reward, reputation, deadline, vehicle hauling, or broader NPC relationship system.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Row-Crop Field Kit - complete

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Commit:** `6dd4122`
- **Scope:** One post-order Equipment Desk tractor upgrade, explicit manual/operated work contexts, and visible toolbar motion; no implements, logistics, fuel, condition, or broader economy rewrite.
- **Result:** Added a data-defined $1,250 kit whose speed/yield benefits apply only to physically operated tractor jobs, with town-only purchase and save-v6 grandfathering for existing farms.
- **Verification:** 134/134 tests passed; strict typecheck and production build passed; browser acceptance covered prerequisite, exact cash, save/reload, toolbar states, operated bonuses, manual base results, and clean console.
- **Review:** Independent Red Team accepted after one bounded repair made omitted work context fail closed and tightened save behavior; no MEDIUM-or-higher findings remain.
- **Screenshots:** `docs/screenshots/farm-kit-desk-locked.png`, `docs/screenshots/farm-kit-toolbar-raised.png`, `docs/screenshots/farm-kit-toolbar-lowered.png`
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Public Demo Polish Pass - complete

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Commit:** `85a9701`
- **Scope:** Capped presentation-only pass across farm/town HUD, panels, controls, feedback, transitions, and compact layout; no gameplay, economy, or save changes.
- **Result:** Improved visual hierarchy, consistent interaction states, modal readability, responsive spacing, and reduced-motion-aware presentation while preserving the complete player loop.
- **Verification:** 134/134 tests passed; strict typecheck and production build passed; browser acceptance covered desktop/compact farm and town, panels, crop/tractor flow, Save/reload, Escape behavior, and clean console.
- **Evidence:** `docs/demo/PUBLIC_DEMO_POLISH.md` and matched `docs/screenshots/demo-polish-*` images.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Barn Expansion & Recovery - complete

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Commit:** `52337dd`
- **Scope:** Recoverable withered crops, one lifetime true-zero County seed, one north-parcel-gated barn upgrade, working-capital guidance, and save v7; no new crops, rebalance, logistics, workers, or managers.
- **Result:** Added an authoritative farm crop stage with a 15-minute ready window, no-refund clearing, non-recyclable relief, exact $1,800 loft purchase, storage 150 to 200, and a visible barn lean-to.
- **Verification:** 142/142 tests passed; strict typecheck, production build, and diff checks passed; browser acceptance covered service routing, land guidance, exact purchase/capacity, barn presentation, normal relief rejection, Save/reload, and clean console.
- **Review:** Independent Red Team initially found three MEDIUM edge cases; one bounded repair hardened malformed saves, enforced the parcel prerequisite during normalization, and made relief lifetime one-time. Re-review accepted with no MEDIUM-or-higher findings.
- **Screenshots:** `docs/screenshots/barn-loft-before.png`, `docs/screenshots/barn-loft-after.png`
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Crop Catalog & Market Choice - complete

- **Date:** 2026-08-10
- **Branch:** `codex/first-town-contact`
- **Commits:** `f9ffc84`, `62b6263`
- **Scope:** Add carrots, tomatoes, cabbage, and pumpkins with milestone-derived unlocks, authoritative lock guards, differentiated economics, procedural field art, Seed Shop/market support, and old-save zero-seed defaults; no new save version, acreage, logistics, workers, or crop-input systems.
- **Result:** Expanded the playable catalog from four to eight crops. County completion unlocks carrots/tomatoes, the neighboring parcel unlocks cabbage, and the Barn Loft unlocks bulky pumpkins; the compact crop ribbon visibly labels locks and scrolls to all eight choices.
- **Verification:** 150/150 tests passed; strict typecheck, production build, and diff checks passed. Browser acceptance covered the complete County delivery and unlock chain, carrot and pumpkin tractor jobs, distinct mature art, exact pumpkin storage 4 to 28 and sale back to 4, Seed Shop economics, 760px horizontal scrolling, mounted save/reload, and zero console warnings/errors.
- **Review:** Independent reviewer provisioning did not start, so the primary performed the bounded acceptance review. Repairs made storage footprints integral, clarified lock badges, corrected carrot's low-capital role, kept County relief on starter wheat, and moved developer maturity controls to the authoritative Farm Empire crop registry.
- **Screenshots:** `docs/screenshots/crop-catalog-locked-1280.png`, `docs/screenshots/crop-catalog-shop-1280.png`, `docs/screenshots/crop-catalog-varied-field-1280.png`
- **Known limitations:** Unlocks use existing finite milestones; there are no repeat contracts, additional land tiers, crop inputs/quality, processing, hauling, workers, or managers yet.
- **Push:** Not yet pushed; external GitHub authorization is still required.
