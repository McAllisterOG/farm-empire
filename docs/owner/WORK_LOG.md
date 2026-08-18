# Farm Empire Work Log

Record major completed packages and stable checkpoints here. Keep day-to-day chat and minor edits out.

## Runtime Farm Readability + First-Loop Contract V1 - complete

- **Date:** 2026-08-18
- **Branch:** `codex/first-town-contact`
- **Commit:** local `feat: improve farm runtime readability` (see Git history for hash)
- **Result:** Replaced only Farm crop rows with immutable-data-driven Canvas silhouettes for all eight catalog crops; legacy Paradise Isle painting remains intact. Ready crops display crop-specific produce, while withered crops are smaller, desaturated/drooping, and produce-free. Farm ground now has 16 deterministic cached variants; large sections add edge depth, stable clods, straw, and furrows. A short crop-colored Canvas burst follows only a successful player basket harvest.
- **Contract:** A joined DOM-free fresh-state regression prepares, plants, waters, grows, basket-harvests, unloads to pickup, fulfills the County Pantry order exactly once, and runs a repeat crop cycle with non-negative inventory and valid barn/pickup capacity assertions.
- **Boundaries:** No save/schema, economy, capacity, layout, hitbox, control, camera, town, narrative, or dependency change.
- **Verification:** 5 focused tests and 304 tests across 42 files passed; strict typecheck, Vite production build, and `git diff --check` passed. Independent Red Team findings on withered visuals, feedback authority, and catalog completeness were repaired.
- **Desktop acceptance:** `release/runtime-readability-v1/win-unpacked/Farm Empire.exe` and its relative-asset `resources/app.asar` were generated locally. Native CDP confirmed the packaged title and expected bundled `file://` URL; the literal `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` launched four responsive processes from this build and left zero residue after cleanup.
- **Known limitation:** The attempted child `%APPDATA%` override did not isolate Electron's stable `%APPDATA%\Farm Empire` profile. The real McAllister Farm slot was therefore not entered, deleted, or saved; crop/soil/harvest-burst visual judgment remains for the owner's next live play session.

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

## Windows Desktop Release - complete

- **Date:** 2026-08-11
- **Branch:** `codex/first-town-contact`
- **Commits:** `98344cd`, `01eae44`, `1a7069b`, `7314689`
- **Scope:** Secure Windows desktop shell, packaging, original icon resources, exact branded Desktop shortcut, current release/test toolchain, and native acceptance; no gameplay, economy, or save-schema changes.
- **Result:** Farm Empire now launches from the real Windows Desktop as a centered native game window without a terminal, browser tab, development server, or internet. It has stable desktop saves, single-instance focus, F11 fullscreen, bundled local loading, denied unexpected navigation, unpacked/portable/NSIS x64 artifacts, and a verified Farm Empire shortcut/icon.
- **Verification:** 155/155 tests passed; strict typecheck, production build, full npm audit with zero findings, and all three Windows package targets passed. Native acceptance covered shortcut target/icon read-back, 150% DPI presentation, fullscreen/restoration, second-launch focus, normal shutdown with zero residual processes, and packaged hostile-environment behavior. Browser acceptance covered farm creation, save/reload/re-entry, responsive minimum layout, cleanup, and zero console warnings/errors.
- **Review:** Independent Red Team rejected the first development launcher because Windows shell descendants could survive and fool readiness. Bounded repairs moved to direct child processes, fail-closed port/content validation, packaged-local-only loading, no preload bridge, and bounded process-tree cleanup; the final primary inspection and real process checks closed the finding.
- **Artifacts:** `release/win-unpacked/Farm Empire.exe`, `release/Farm Empire Portable 1.0.0 x64.exe`, and `release/Farm Empire Setup 1.0.0 x64.exe` (generated and ignored). The real shortcut is `Farm Empire.lnk` on the Windows-resolved Desktop.
- **Known limitations:** Unsigned x64 Windows build; SmartScreen may warn. Executable file metadata remains Electron because resource post-editing is disabled in this account; the supported shortcut and game window use the verified external Farm Empire icon. Desktop and browser saves are separate; no signing, auto-update, cloud sync, or cross-platform package yet.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Old Pickup & County Haul Loop - complete

- **Date:** 2026-08-11
- **Branch:** `codex/first-town-contact`
- **Commits:** `93313c7`, `a16fffe`, `e9e9573`, `0ae284c`
- **Scope:** One owned drivable pickup, persistent 72-unit mixed cargo, reversible farm transfers, pickup-gated town seed/sale/County transactions, save v8, UI/feedback, and refreshed Windows artifacts; no trailers, fuel, damage, implements, workers, repeat contracts, land, or economy rebalance.
- **Result:** The farm now has a tangible barn-to-truck-to-town loop. Produce is loaded from the barn, seed bags are bought into the truck and unloaded at home, ordinary sales consume truck cargo, and the finite County Pantry order consumes exactly 12 hauled corn. On-foot services remain available but cargo actions fail closed.
- **Verification:** 161/161 tests passed; strict typecheck, production build, diff checks, full npm audit with zero findings, and unpacked/portable/NSIS x64 packaging passed. Browser acceptance completed the real crop-to-barn-to-pickup route, on-foot lockouts, drive/cancel/gate transition, freight parking, exact $10 seed purchase, $12.28 sale, $85 delivery, return/unload, town and mounted reload safety, mutual exclusion, cleanup, and zero console warnings/errors. The real Desktop shortcut launched one responsive packaged window and closed to zero processes; target/icon read-back matched the release.
- **Review:** Independent Red Team found three MEDIUM transaction/UI defects; one bounded repair added crop unloading, pickup-only County readiness/fulfillment, and explicit farm/town authority. Re-review found one valid cardinal-pose gap, fixed with the existing farm upright-pose mapping. The primary browser pass corrected one residual barn-wording mismatch.
- **Artifacts:** `release/win-unpacked/Farm Empire.exe` (225,441,792 bytes), `release/Farm Empire Portable 1.0.0 x64.exe` (89,809,797 bytes), and `release/Farm Empire Setup 1.0.0 x64.exe` (90,018,109 bytes), all generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the unpacked executable and exact external icon.
- **Known limitations:** Direct collision-free vehicle travel; one pickup with no trailers, fuel, condition, dealership, or hauling jobs beyond the finite Pantry order. Desktop artifacts remain local unsigned x64 builds with separate desktop/browser saves.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## First-Play Usability & World Framing Repair - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commits:** `0566635`, `0f71fd8`, `00171cb`, `df8948b`, `f3a687c`
- **Scope:** Repair the owner's first desktop playtest blockers: excessive blank-space framing, losable cameras, missing in-game menu/title return, overlapping pickup/gateway interactions, unclear cargo authority, cross-wired vehicle actions, misleading pump affordance, weak world-edge presentation, and compact-screen recovery controls. No field-geometry, economy, save-version, irrigation, XP, or service-count expansion.
- **Result:** Added scene-aware camera fitting/clamping and recentering, a lifecycle-safe hamburger menu and slot return, a dedicated safe barn cargo pad with fail-closed transfers, context-correct pickup/tractor panels, safe legacy gate-position normalization with cargo preservation, an unobstructed road, explicit automatic-growth guidance, and render-only farmhouse/town-edge context.
- **Verification:** 170/170 tests passed; strict typecheck, Vite production build, diff checks, and full npm audit with zero findings passed. Browser acceptance covered 2048x1152, 1280x720, and 760x640 farm/town layouts, pan stress and recovery, menu/title return/re-entry, exact transfers, away-from-pad rejection, pickup drive/gate/return, responsive footer/menu behavior, pump feedback, and zero console warnings/errors. Unpacked, portable, and NSIS x64 artifacts were rebuilt; the exact OneDrive Desktop shortcut opened a responsive packaged window and closed to zero residual game processes with its target, working directory, icon, executable, and app bundle confirmed.
- **Review:** Independent Luna Medium review found two active-scene camera/resize MEDIUMs; both were repaired. Primary acceptance then closed pickup-save, lifecycle, architecture-boundary, pad/parcel, road-routing, and legacy gate-conflict issues before final validation.
- **Owner direction preserved:** Future acreage should be substantially larger; the farmhouse may grow with the property; an optional authentic farming-knowledge progression is desired; town/county context should expand; tractor timing is unresolved; and a proportional evidence-based economy study should retain the $5,000 start until approved as its own package.
- **Known limitations:** Current field geometry, economy, watering, farmer levels, farmhouse upgrades, equipment timing, and broader town simulation are intentionally unchanged pending coordinated design.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Acreage & Field Geometry V2 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `1e18b3c`
- **Scope:** Replace the 3x3 field geometry with a 6x6 starter acreage and an 8x12 neighboring commercial tract; add safe save-v9 expansion, data-defined parcel ownership, seed/storage-aware tractor work, a routed County road, property-aware camera framing, and refreshed Windows artifacts. No economy rebalance, irrigation, farmer XP, workers, additional land tier, or farmhouse progression.
- **Result:** Fresh farms now contain 36 starter sections and can purchase 96 neighboring sections. Existing owned plots and crops survive migration while missing acreage is added idempotently. Tractor menus identify the actual acreage and plan only work the farm can complete. The larger mainland stays bounded, recentering emphasizes the homestead, the pickup parks visibly beside the barn, and the gate route clears both fields.
- **Verification:** 177/177 tests passed; strict typecheck, Vite production build, diff checks, and full npm audit with zero findings passed. Browser acceptance covered fresh and expanded farms at 2048x1152, 1280x720, and 760x640; exact purchase and save/reload; 6x6 and 8x12 tractor menus; seed-limited planning; one completed commercial-field planting job; pickup cargo controls; and camera/menu recovery. Unpacked, portable, and NSIS x64 builds completed. The exact OneDrive Desktop shortcut targeted the rebuilt unpacked executable, launched one responsive native `Farm Empire` window, and only the new acceptance processes were closed.
- **Review:** A bounded adversarial review found and repaired over-broad pickup/player normalization, corrupt UID allocation, a logical/presentation road-clearance mismatch, and whole-property overfitting. Migration-only relocation now occurs exactly once, ordinary v9 positions persist, acreage allocation fails safely, and home focus is independent from hard property bounds.
- **Artifacts:** `release/win-unpacked/Farm Empire.exe` (225,441,792 bytes), `release/Farm Empire Portable 1.0.0 x64.exe` (89,818,358 bytes), and `release/Farm Empire Setup 1.0.0 x64.exe` (90,026,673 bytes), all generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the unpacked executable and deployed icon.
- **Known limitations:** The geometry is intentionally ahead of the current economy and storage curve. Partial acreage work is supported, but capital, yield, barn capacity, land value, and equipment timing need the planned evidence-based economy study before another land tier. Arbitrary vehicle movement remains collision-free and direct.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Player Experience & Homestead Expansion V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `679a9aa`
- **Scope:** Make the visible farm the primary interface, consolidate guidance in one Farmbook, add action-derived Farmer Knowledge, correct pickup/town interaction authority, densify the homestead and County presentation, and refresh Windows artifacts. No save-version, economy, irrigation, worker, acreage, or service-count expansion.
- **Result:** Pickup, tractor, Scout, farmhouse, pump, barn, doghouse, gateway, land, and field clicks now resolve through one authoritative priority map and open the correct compact surface. The Farmbook shows the real six-step loop, next action, business snapshot, and core routes. Five knowledge ranks and evidence-sourced notes respond to actual work without gameplay bonuses. The farmhouse, pond, garden, hover labels, destination cues, County homes, town pickup scale, road travel, and parking make both scenes clearer and more occupied.
- **Verification:** 185/185 tests passed; strict typecheck, Vite production build, and diff checks passed. Browser acceptance covered all focal object routes, exact seed/crop loading and unloading, field actions, Farmbook navigation, on-foot and pickup County travel/return, town NPC and pickup interactions, Save & Return, and zero console warnings/errors. Unpacked, portable, and NSIS x64 builds completed under `release/final`; the exact OneDrive Desktop shortcut launched the current executable successfully and only acceptance processes were closed.
- **Review:** A deep bounded adversarial pass caught a farm-only camera action exposed in town and an on-foot route that cut across fields. Both were repaired, and transaction success accounting, corrupt stats, overlap priority, save neutrality, return normalization, and cancellation boundaries were reviewed with no remaining high- or medium-severity finding.
- **Artifacts:** `release/final/win-unpacked/Farm Empire.exe` (225,442,304 bytes), `release/final/Farm Empire Portable 1.0.0 x64.exe` (89,912,754 bytes), and `release/final/Farm Empire Setup 1.0.0 x64.exe` (90,121,061 bytes), all generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the final unpacked executable.
- **Known limitations:** Arbitrary vehicle travel remains collision-free; Farmer Knowledge has no skill choices or economic modifiers; watering, town interiors, traffic, broader contracts, workers/managers, and an economy rebalance remain deferred.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Manual Farming & Field Lifecycle V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `400a2d5`
- **Scope:** Add one save-safe manual field rhythm across existing acreage: prepare rough soil, plant, give one establishment watering, grow, harvest into the barn, leave stubble, and rework. Preserve crops, economy, land, hauling, tractor jobs, town, and every prior save system; no weather, recurring irrigation, fertilizer, implements, workers, or rebalance.
- **Result:** Every section now has a visible rough, tilled, or stubble condition. Manual crops do not age before their first watering, while operated-tractor planting remains a truthful integrated prepare-and-establish shortcut. Field hover/action copy, wet soil, seedling droplet feedback, post-harvest stubble, How to Play, the hand pump, and the Farmbook all describe the same eight-step loop. Save v10 reconstructs safe conditions and grandfathers existing crops as established.
- **Verification:** 192/192 tests passed; strict typecheck, production build, and diff checks passed. Browser acceptance completed the entire lifecycle, exact seed/storage changes, Farmbook progress, save/reload of prepared soil, and zero warnings/errors. The provided Playwright client emitted screenshot/text-state evidence. Unpacked, portable, and NSIS x64 builds completed under `release/manual-fields-v1`; the OneDrive Desktop shortcut targets the new unpacked build, four packaged processes responded in the native smoke test, and zero remained afterward.
- **Review:** The primary completed a bounded adversarial pass because no additional task was necessary for this finite package. Old/corrupt save semantics, malformed watering flags, transaction immutability, tractor/manual separation, guide evidence, field visuals, help-copy consistency, deterministic hooks, and native packaging were checked. The pass repaired malformed watering data and obsolete automatic-growth guidance; no high- or medium-severity issue remains.
- **Artifacts:** `release/manual-fields-v1/win-unpacked/Farm Empire.exe` (225,442,304 bytes), `release/manual-fields-v1/Farm Empire Portable 1.0.0 x64.exe` (89,916,701 bytes), and `release/manual-fields-v1/Farm Empire Setup 1.0.0 x64.exe` (90,125,015 bytes), all generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the unpacked executable and deployed icon.
- **Known limitations:** Watering is one establishment action only. Recurring moisture, weather, irrigation equipment, fertilizer, soil health, quality, manual action animations, and an implement progression remain deferred; economy values are unchanged.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Manual Fieldwork Feel - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `f7fcd4e`
- **Scope:** Make the existing manual lifecycle feel physical and understandable through short runtime actions for prepare, rework, plant, water, harvest, and clearing. Preserve save v10, economy, land, hauling, tractor jobs, town, and all existing transaction rules; no stamina, tool durability, weather, recurring irrigation, skills, audio, or rebalance.
- **Result:** Each manual action now presents a field-level tool/effect and progress label plus concise HUD status. Existing deterministic core actions apply only when the short action completes; Escape cancels before mutation, and conflicting world/panel input explains the active work instead of opening another surface.
- **Verification:** 195/195 tests passed; strict typecheck, Vite production build, and diff checks passed. Browser acceptance covered prepare, mutation-safe cancellation, plant, water, mature, exact harvest, stubble, rework, save/title/reload, visual inspection, and zero console/page errors. The provided Playwright client emitted valid screenshot/text-state evidence. Unpacked, portable, and NSIS x64 artifacts were rebuilt under `release/manual-fieldwork-feel`; the Desktop shortcut targets that build, four native processes responded, and none remained after smoke cleanup.
- **Artifacts:** `release/manual-fieldwork-feel/win-unpacked/Farm Empire.exe` (225,442,304 bytes), `release/manual-fieldwork-feel/Farm Empire Portable 1.0.0 x64.exe` (89,921,247 bytes), and `release/manual-fieldwork-feel/Farm Empire Setup 1.0.0 x64.exe` (90,129,564 bytes), all generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the unpacked executable.
- **Known limitations:** Actions are deliberately brief and save-neutral. There is no sound, stamina, tool durability, implement ownership, recurring moisture, weather, or character-skill modifier.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Farm Soundscape & Tactile Feedback V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `ed05264`
- **Scope:** Add a restrained original procedural sound layer and compact persistent audio controls across the existing farm loop. Preserve save v10, economy, progression, crops, acreage, hauling, tractor jobs, and town services; no downloaded audio assets, soundtrack, voice, or schema change.
- **Result:** Filtered rural wind and clock-aware wildlife give the world a quiet ambient bed. Manual fieldwork, sales, expansion, errors, Scout, and operated tractor/pickup motion now have concise feedback. The game menu provides global mute plus separate ambience/effects sliders stored under an isolated local preference key.
- **Verification:** 198/198 tests passed; strict typecheck, Vite production build, and diff checks passed. Browser acceptance covered preference persistence across title return/re-entry, manual-action and tractor paths, a 760x640 menu, and zero warning/error logs. The provided Playwright client emitted a valid screenshot and deterministic audio state. The first unpacked artifact exposed a blank window because it was packaged after the browser build and retained absolute `/assets/...` references. It was rebuilt through `desktop:build`; archive inspection confirmed relative assets, native CDP captures visibly confirmed both title and playable farm, and the exact OneDrive Desktop shortcut launched four responsive processes with zero remaining after cleanup.
- **Review:** The primary checked blocked/unsupported audio, malformed or unavailable preference storage, shared SFX mixing, lifecycle cleanup, action/vehicle routing, save neutrality, compact presentation, and native cleanup. Audio startup was hardened to fail safely without blocking game construction.
- **Artifacts:** `release/farm-soundscape-v1/win-unpacked/Farm Empire.exe` (225,442,304 bytes) and its corrected bundled `resources/app.asar` (1,186,886 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets the unpacked executable and deployed icon.
- **Known limitations:** This is a restrained zero-asset procedural V1 rather than a recorded soundtrack. It does not add voice, music composition, spatial occlusion, weather audio, or gameplay-affecting sound mechanics.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Efficient Row Fieldwork & Homestead Scale - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `a0ee2d9`
- **Scope:** Remove repetitive field clicking and correct the visible home/barn hierarchy while responding to the owner's sound complaint. Preserve save v10, economy, crop rules, acreage, hauling, tractor jobs, town services, and audio preferences; no workers, stamina, pathfinding, machinery tier, or rebalance.
- **Before / after:** Manual work previously required reopening a menu for every field section; it now offers one section, one full row, or a three-row block for prepare, rework, plant, water, harvest, and clearing. A visible acreage-bounded selection and live HUD progress replace hidden repetition; deterministic serpentine travel prevents side-to-side resets; Escape keeps only already committed sections; planting stops at real seed supply. The farmhouse was visually subordinate to the barn; it is now enlarged while the barn is restrained, with a matching farmhouse hit radius. Repeating high-pitched day/night wildlife notes were removed, retaining quiet wind and intentional action, transaction, Scout, and vehicle cues.
- **Verification:** 201/201 tests passed; strict typecheck, Vite production build, and diff checks passed. Browser acceptance on a fresh farm verified exact 6/18 eligible counts, complete row preparation, one-section partial cancellation, exactly two seed-limited corn plantings, visible selection/progress, and zero console/page errors. `desktop:build` produced relative bundled assets under `release/field-efficiency-v1`; archive inspection, packaged CDP screenshot, and literal OneDrive Desktop shortcut launch all passed with four responsive processes and zero residue after cleanup.
- **Review:** The primary completed one bounded audit covering deterministic order, parcel edges, cross-acreage isolation, resource exhaustion, transaction/cancellation boundaries, input blocking, visual hit agreement, sound fallback, package paths, and native cleanup. No high- or medium-severity issue remains.
- **Known limitations:** Multi-section work uses the current direct walking model and short repeated actions. It does not add obstacle pathfinding, hired labor, stamina/tools, irrigation, or a new equipment/economy tier. Environmental audio is intentionally sparse pending a later recorded ambience/music direction.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Old Tractor Restoration V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `68b15c1`
- **Scope:** Turn the inherited tractor into the first manual-to-mechanized milestone. Fresh farms must complete the existing County Pantry hauling route before buying one fixed restoration; preserve all pre-v11 farms, manual fieldwork, crop rules, economy, land, storage, pickup, and town architecture. No fuel, breakdowns, implements, dealership, later machinery tier, or rebalance.
- **Before / after:** Fresh farms previously received powered acreage work immediately, flattening the new manual row loop and making the tractor feel disconnected from progression. They now see a grey open-hood repair project, explicit HUD/Farmbook/office guidance, a disabled Operate control, a County-delivery prerequisite, and one $1,950 Equipment Desk transaction. Restoration immediately re-enables the existing deterministic tractor; the Row-Crop Field Kit remains the next distinct upgrade.
- **Verification:** 206/206 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance verified the fresh locked presentation, manual compatibility, County desk unlock, exact charge, operation, save-v11 reload, and zero console/page errors. `release/tractor-restoration-v1` contains relative bundled assets; packaged CDP rendered both title and farm, and the literal OneDrive Desktop shortcut launched four responsive processes with zero residue after cleanup.
- **Review:** The primary completed one bounded audit of restoration prerequisites, insufficient-funds and duplicate-call immutability, manual/powered separation, field-kit ordering, pre-v11 grandfathering, malformed-current failure behavior, player guidance, Canvas repair-state readability, native packaging, and shortcut cleanup. No high- or medium-severity issue remains.
- **Known limitations:** Restoration is one finite milestone rather than a condition simulation. Ongoing wear, repair parts, fuel, implements, later tractor/combine tiers, workers, managers, and a broad machinery economy remain deferred.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Homestead Growth V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `66c031f`
- **Scope:** Make the existing neighboring-acreage purchase visibly improve the homestead. Derive one expanded farmhouse tier from saved parcel ownership and update art, hit truth, office identity, and purchase copy together. No new price, save field, bonus, room, interior, or economy change.
- **Before / after:** The larger starter farmhouse stayed visually unchanged after a major $6,500 land purchase. It now transforms from a modest single-story home into a wider two-story house with a second gable, four windows, and a full porch. The hover/click target widens with the art; the title becomes Expanded Farmhouse Office; Land Records and the business snapshot acknowledge the property reward.
- **Verification:** 208/208 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance captured the starter/expanded comparison, purchased exactly 96 additional sections from $6,500 to $0, verified the expanded interaction and office, reloaded 132 sections from the existing save flag, and found zero console/page errors. `release/homestead-growth-v1` contains relative bundled assets; packaged CDP rendered title and farm, and the literal OneDrive Desktop shortcut launched four responsive processes with zero residue after cleanup.
- **Review:** The primary audited derived-state authority, no-schema behavior, transaction preservation, visual/hit agreement, nearby overlap priority, UI truth, package paths, and native cleanup. No high- or medium-severity issue remains.
- **Known limitations:** The tier is a visible land-ownership reward, not a separate renovation system. There are no interiors, rooms, household mechanics, additional home tiers, or functional bonuses.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Freight Board V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `44c8408`
- **Scope:** Add one repeatable town job that makes the established grow, store, load, drive, and deliver loop worth revisiting after the first Pantry story order. Preserve starting cash, crop/market values, acreage, storage, machinery, field lifecycle, farmhouse progression, and all existing transactions; no reputation, deadlines, penalties, multiple-job board, or generic quest system.
- **Result:** Eli's Grain Exchange now posts one deterministic unlocked-crop haul per saved farm day. Acceptance locks the exact crop, quantity, and a 25% premium over the current quote; active work survives market/day changes and save/reload, requires exact pickup cargo, pays atomically once, closes the route for the completion day, and refreshes on a later day. Mae, How to Play, the Farmbook snapshot, and deterministic browser text state expose concise status. Save v12 adds only the active snapshot and last completion day with defensive migration and normalization.
- **Verification:** 217/217 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance used the physical pickup/County road and covered visible offer, acceptance, loaded readiness, exact cargo removal and payout, same-day closure, town save and safe farm reload, next-day refresh, normal and 760x640 layouts, and zero console/page errors. Screenshots and text state were inspected. The unpacked bundle uses relative assets and contains both the Board and stale-offer guard; native CDP rendered the packaged title without errors, and the literal OneDrive Desktop shortcut launched four responsive processes from the new release with zero residue after cleanup.
- **Review:** The primary audited deterministic selection, unlock monotonicity, price snapshots, stale visible cards, active-contract day rollover, pickup-only authority, insufficient and duplicate immutability, save migration/defaults, corrupt bounds, context-safe UI, compact layout, packaged asset paths, and native cleanup. No high- or medium-severity finding remains.
- **Artifacts:** `release/county-freight-v1/win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,250,857 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this unpacked build and its Farm Empire icon.
- **Known limitations:** The Board intentionally offers one route at a time. It has no offer choice, deadline, penalty, negotiation, reputation, contract chain, special cargo, traffic, or hauling scene.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Utility Trailer V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `06da492`
- **Scope:** Convert the first completed daily freight haul into one physical logistics milestone: a fixed County Equipment Desk purchase that materially expands pickup cargo. Preserve starting cash, all crop/market values, acreage, storage, field lifecycle, tractor rules, Freight Board terms, and the existing pickup route; no fuel, damage, manual hitching, additional tier, worker, or economy-wide rebalance.
- **Before / after:** The Freight Board previously paid cash but did not open a new equipment step, and the pickup remained permanently capped at 72 units. The first haul now explicitly unlocks a $2,400 utility trailer. One atomic purchase raises every real cargo transaction and readout to 144 units, adds the trailer to the direction-aware farm pickup and County parking painter, and persists ownership through save v13.
- **Verification:** 221/221 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance verified locked and unlocked Equipment Desk states, the exact $5,000-to-$2,600 purchase, 72-to-144 HUD/panel propagation, farm and town visuals, County-road driving, save/reload persistence, and zero console warnings/errors. The temporary QA farm was deleted afterward. Native CDP confirmed the packaged `Farm Empire` title from the relative bundled file URL.
- **Review:** The primary audited prerequisite and duplicate-call immutability, cash mirror, bulky mixed-cargo enforcement, old/current/corrupt save behavior, UI authority, painter direction, Farmbook/help/text-state truth, package assets, shortcut routing, and native cleanup. The audit changed corrupt out-of-range Freight Board completion days to normalize to zero so malformed saves cannot unlock the trailer. No high- or medium-severity finding remains.
- **Artifacts:** `release/utility-trailer-v1/win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,263,388 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this smoke-tested unpacked executable and its deployed icon.
- **Known limitations:** The trailer is automatically attached and shares the pickup's direct movement pose. There is no hitching, jackknifing, independent collision, fuel, condition, maintenance, implement storage, additional trailer tier, or worker assignment.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## First Farmhand V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `43f7daa`
- **Scope:** Add one named, visible farmhand as the first workforce/progression step after County trust and neighboring-acreage ownership. Preserve starting cash, crop/equipment/land prices, field lifecycle, pickup/trailer, tractor, Freight Board, farmhouse, and town architecture; no managers, multiple workers, housing, schedules, skills, passive-income bonus, or economy-wide rebalance.
- **Before / after:** Large acreages previously scaled only through owner row actions and the restored tractor. Farm Services now hires Mara Bell once for $1,800; one $120 daily shift covers whole-acreage prepare, rework, selected-crop planting, watering, harvesting, and clearing. Mara visibly walks the deterministic route, the HUD and green acreage reservation show her work, the owner remains free to use other systems, and Escape safely keeps only completed sections.
- **Verification:** 230/230 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance verified exact hire/wage deductions, the complete 36-section route, a free second same-day assignment, real seed consumption, live art/progress, save-v14 reload, partial cancellation, and zero console warnings/errors. The relative-asset `release/farmhand-v1` archive contains the workforce code; native CDP opened the packaged title/file URL and closed with zero residual processes. The OneDrive Desktop shortcut targets the new executable.
- **Review:** The primary audited prerequisite/duplicate/insufficient-funds immutability, deterministic routing, normal and bulky storage reservations, seed exhaustion, same-day/new-day wages, save migration/defaults, corrupt prerequisite handling, transaction reuse, acreage conflicts, cancellation, town-time work, UI truth, package contents, shortcut routing, and native cleanup. The audit made corrupt hires depend on real prerequisites and removed overlapping farmhand name/action labels. No high- or medium-severity finding remains.
- **Artifacts:** `release/farmhand-v1/win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,314,497 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this smoke-tested unpacked executable and its deployed icon.
- **Known limitations:** Mara is one generalist with one concurrent acreage assignment. Her active job is intentionally runtime-only; after reload she is idle and can be reassigned without another same-day wage. There is no obstacle pathfinding, schedule, skill, need, housing, multi-worker coordination, manager layer, or passive-income system.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Farm Weather V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `4362b90`
- **Scope:** Add one deterministic daily County weather layer that is visible and mechanically useful while preserving save v14, economy, yields, equipment, acreage, workers, hauling, town services, and existing field transactions. No seasons, damage, recurring moisture, irrigation, forecast economy, or schema change.
- **Before / after:** The farm clock previously changed lighting but every day otherwise looked and played the same. Clear, cloudy, and steady-rain days now share a readable HUD card, three-day Farmbook forecast, farm/town Canvas weather, and restrained procedural mix. Rain automatically establishes only manual crops waiting for their first water by calling the same transaction used by the owner and farmhand; dry weather preserves manual watering.
- **Verification:** 236/236 tests passed; strict typecheck, Vite production build, desktop-specific build, and diff checks passed. Browser acceptance covered all three visual states, exact rainy planting establishment, ready-crop save/reload, the forecast at 1280x720 and 760x640, synchronized rainy County town, a town save returning safely to the farm, and zero console warnings/errors. Native CDP loaded the relative bundled file URL with four responsive processes and zero residue; the literal OneDrive Desktop shortcut launched the same smoke-tested executable.
- **Review:** The architecture-strategist boundary kept deterministic rules in core, presentation-only particles in render, forecast copy in UI, and mix changes in audio. The primary audited deterministic distribution/replay, forecast bounds, dry-day immutability, idempotence, stable plot order, existing stat updates, no save field, farm/town continuity, compact layout, package contents, shortcut routing, and native cleanup. No high- or medium-severity finding remains.
- **Artifacts:** `release/weather-v1-player/win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,333,812 bytes), generated and ignored. Electron Builder's framework staging rename was blocked by a reproducible local Windows `EPERM`; the accepted `farmhand-v1` shell was therefore copied and its app archive was rebuilt from the current relative-asset desktop bundle before native CDP and shortcut smoke tests. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this verified build.
- **Known limitations:** This first weather layer has no seasons, temperature, severe storms, damage, drought, recurring moisture, irrigation infrastructure, crop-quality effect, market modifier, or recorded rain asset. Rain is intentionally limited to replacing the existing one-time establishment watering.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Roadside Produce Stand V1 - complete

- **Date:** 2026-08-12
- **Branch:** `codex/first-town-contact`
- **Commit:** `f7c2081`
- **Scope:** Add one visible, purchased farm-gate market after County trust and one small daily local order without replacing pickup commerce, Freight Board hauling, or the planned economy study. No passive income, customers, managers, reputation, multiple offers, or broad rebalance.
- **Before / after:** Proven farms previously had no direct local outlet or physical farm improvement between crop production and County hauling. Farm Services now builds the McAllister Farm Stand for $650. One deterministic 6–12-unit unlocked-crop request per farm day can be filled from real barn stock at 90% of the current County quote; it pays once, visibly sells out, and refreshes the next day while higher-value logistics remain intact.
- **Verification:** 244/244 tests passed; strict typecheck, Vite production build, desktop-relative build, and diff checks passed. Browser acceptance covered exact purchase, world interaction, shortage/readiness, barn consumption, payout, duplicate prevention, next-day refresh, save/reload, normal/compact layouts, clear/rain art, and zero console warnings/errors. Four packaged processes launched responsive and closed with zero residue; the OneDrive Desktop shortcut targets `release/roadside-stand-v1/win-unpacked/Farm Empire.exe`.
- **Review:** The architecture-strategist boundary kept deterministic and atomic rules in core, values in data, Canvas/DOM presentation isolated, and save v15 minimal. The primary audited prerequisite/cash failures, crop eligibility, deterministic replay, stale and duplicate guards, payout ordering, corrupt saves, landmark safety/hit priority, package integrity, and shortcut cleanup. A covered stand sign was repaired before release; no high- or medium-severity finding remains.
- **Known limitations:** The stand has one request and one visual tier. There are no customer actors, pricing decisions, upgrades, passive earnings, spoilage, reputation, multiple local orders, or worker/manager integration.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Progression Interaction Reliability Pass - complete

- **Date:** 2026-08-13
- **Branch:** `codex/first-town-contact`
- **Commit:** `3ad966b`
- **Scope:** Exercise the current farm, town, field-efficiency, workforce, hauling, and roadside-stand progression in the real UI; repair only reproduced reliability and comprehension failures. Preserve all economy values, progression prerequisites, transactions, and save v15; no new feature system or rebalance.
- **Before / after:** Town characters previously responded only near their ground anchors, so clicking a visible torso or face could walk the owner directly onto the NPC without opening service. The County pickup had the same risk. At the farm, a decorative blue trough was easy to mistake for the unlabelled cargo pad, while the pickup panel exposed parked-only cargo actions without a dependable way to reach their required location and even concatenated its guidance text. Visible town silhouettes are now fully clickable at current zoom, the cargo pad is labeled, and one primary pickup action drives there, dismounts safely, and opens enabled produce/seed controls. Farmhand cancellation guidance is now player-facing rather than implementation terminology.
- **Verification:** 245/245 tests passed; strict typecheck, Vite production build, desktop-relative build, and diff checks passed. Browser acceptance covered full-body Eli/Mae clicks, the parked County pickup, grouped row work, farmhand assignment, stand completion, Freight Board acceptance, direct pickup routing, exact crop load/unload, pickup-backed town selling state, town save, safe farm reload, and zero console warnings/errors. The verified relative-asset Windows build and the literal Desktop shortcut each launched four responsive processes and left zero residue.
- **Review:** The architecture-strategist boundary kept screen hit geometry in `src/render/townLayout`, app orchestration in `src/game`, presentation in the renderer, and all business/save authority unchanged. The primary audited zoom and overlap behavior, interaction priority, exact cargo-pad arrival, tractor exclusion, cargo authority, save canonicalization, package contents, shortcut routing, and process cleanup. No high- or medium-severity issue remains.
- **Artifacts:** `release/interaction-reliability-v1/verified-win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,372,198 bytes), generated and ignored. Electron Builder again hit the documented Windows framework-staging `EPERM`; the accepted shell was copied with its directory layout intact and its app archive was rebuilt from the current relative-asset desktop bundle before native and shortcut smoke tests. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this verified build.
- **Known limitations:** Town and farm vehicles remain collision-free, and arbitrary movement remains direct outside the authored County road. The cargo pad routing is a quality-of-life path, not a generalized navigation or parking system.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Life V1 - complete

- **Date:** 2026-08-13
- **Branch:** `codex/first-town-contact`
- **Commit:** `fee808a`
- **Scope:** Make the owned farm stand and compact County Service Center feel occupied without adding a customer economy, relationship system, service, save field, or transaction change. Preserve save v15, the exact three functional town NPCs, hit priority, roadside-order authority, cargo, freight, workforce, weather, and all prices.
- **Before / after:** The farm stand could post and fulfill orders but never attracted a visible person, and the County plaza returned to feeling like three isolated counters. An open daytime stand now draws one basket-carrying visitor along a safe shoulder route; two visually distinct residents walk and pause on separate public-plaza lanes during County hours. All positions are reconstructed from existing clock/seed inputs and disappear outside their hours or when the stand order is closed.
- **Verification:** 251/251 tests passed; strict typecheck, Vite production build, desktop-relative build, and diff checks passed. Focused tests cover deterministic replay, business-hour/open-order gating, smooth there-and-back movement, acreage exclusion, and convex-plaza containment. Browser acceptance visibly verified the stand visitor, both resident lanes, preserved Feed & Seed selection, town save/return, and zero console warnings/errors. The browser pass found and repaired an initial post-sort queue insertion and route pauses hidden by functional scenery.
- **Review:** The architecture-strategist boundary kept route logic in `src/render/countyLife.ts`, character painting in presentation, orchestration limited to existing seed/day/clock inputs, and business/save authority untouched. The primary audited schedules, route and depth safety, functional-NPC isolation, business-hour truth, package contents, shortcut routing, and process cleanup. No high- or medium-severity issue remains.
- **Artifacts:** `release/county-life-v1/verified-win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,401,697 bytes), generated and ignored. Electron Builder hit the documented Windows staging-rename `EPERM`; the accepted verified shell was copied and its app archive rebuilt from the final relative-asset desktop bundle. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this build; it launched four responsive processes and left zero residue after cleanup.
- **Known limitations:** These people are intentionally non-interactive passersby with authored routes. There is no resident dialogue, relationship memory, schedule simulation, traffic, demand model, passive stand income, customer variety system, or new town service.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Grain Silo V1 - complete

- **Date:** 2026-08-13
- **Branch:** `codex/first-town-contact`
- **Commit:** `7719497`
- **Scope:** Remove the known 200-unit storage bottleneck after large-acreage expansion with one visible, save-safe commercial storage milestone. Preserve starting cash, crop/market values, land, barn loft, pickup/trailer capacities, workforce, weather, freight, stand orders, and all existing transactions; no price rebalance, spoilage, storage fee, automation, manager, or passive income.
- **Before / after:** The 96-section neighboring acreage could outgrow the loft immediately, forcing mid-harvest sales and making large-field progression feel artificially blocked. After owning that acreage and loft, Farm Services now commissions a $4,800 County Grain Silo. One atomic purchase raises every authoritative farm-storage readout and capacity check from 200 to 800, adds a detailed metal silo beside the barn, and completes a tenth Farmbook progression step.
- **Verification:** 255/255 tests passed; strict typecheck, Vite production build, desktop-relative build, and diff checks passed. Browser acceptance covered prerequisite loft purchase, visible Equipment Desk unlock, exact $10,000-to-$5,200 silo purchase, 200-to-800 propagation, Farmbook 10/10, farm return, visible silo art, save-v16 reload, and zero console warnings/errors. The packaged file URL reported the correct `Farm Empire` title, and the literal Desktop shortcut launched responsive processes from the new build with zero residue after cleanup.
- **Review:** The architecture-strategist boundary kept price/capacity constants in data, atomic purchase and defensive derivation in core, minimal v16 migration in save, DOM guidance in UI, and physical construction in Canvas presentation. The primary audited prerequisite and duplicate immutability, exact accounting, corrupt/legacy save behavior, UI authority, visual scale, package contents, shortcut routing, and process cleanup. No high- or medium-severity issue remains.
- **Artifacts:** `release/grain-silo-v1/verified-win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,412,756 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this smoke-tested build.
- **Known limitations:** The silo is one combined-capacity tier. It does not separate grain from produce, animate loading, add augers or trucks, charge storage costs, automate sales, or solve the pending evidence-based crop/economy calibration.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## County Freight Choice V1 - complete

- **Date:** 2026-08-13
- **Branch:** `codex/first-town-contact`
- **Commit:** `e674cb7`
- **Scope:** Turn the proven farm's existing single daily Freight Board route into a meaningful, deterministic three-bid choice while preserving one accepted contract, physical pickup delivery, all market/economy values, save v16, and existing hauling progression. No deadlines, penalties, negotiation, reputation, simultaneous jobs, special cargo, or broad rebalance.
- **Before / after:** Eli previously posted one take-it-or-leave-it crop route each farm day. The Grain Exchange now presents three unique unlocked-crop bids with exact quantities, buyers, current pickup progress, and locked 25%-premium payouts. Accepting any one immediately retires the alternatives and preserves that exact route across day changes and reloads.
- **Verification:** 255/255 tests passed; strict typecheck, Vite production build, and diff checks passed. Native UI acceptance verified exactly three distinct route cards, current pickup/payout copy, an enabled middle-bid selection, immediate removal of the other bids, the exact Carrot contract becoming active, town save, title reload, and persistence of the complete active snapshot. No save migration was required.
- **Review:** The architecture-strategist boundary retained deterministic selection and stale-request rejection in core, fixed bid-count policy in data, compact cards in the town UI, and the existing active-contract snapshot as sole save authority. The primary audited deterministic uniqueness, locked-crop exclusion, premium math, explicit selection, day rollover, corrupt state, compatibility callers, save persistence, and native interaction. No high- or medium-severity issue remains.
- **Artifacts:** `release/freight-choice-v1/verified-win-unpacked/Farm Empire.exe` and its relative-asset `resources/app.asar`, generated and ignored. The Desktop shortcut targets this smoke-tested build.
- **Known limitations:** The Board still supports one active route at a time. It has no deadline, penalty, negotiation, reputation, contract chain, special cargo, traffic, or hauling scene.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Drag-Select Field Controls V1 - complete

- **Date:** 2026-08-13
- **Branch:** `codex/first-town-contact`
- **Commit:** `abc79a8`
- **Scope:** Replace rigid manual batch sizes with an arbitrary visible field selection while preserving existing manual timing, transactions, acreage ownership, crop rules, storage, workforce reservations, equipment, economy, and save v16. Also address the owner's immediately related seed visibility, camera, cargo-copy, watering-sound, and pickup-volume feedback; no basket inventory, harvest routing, wagon, crop rebalance, field resize, or save migration.
- **Before / after:** A field click previously offered only one section, one full row, or a fixed three-row block. Players can now drag any rectangle within one owned acreage, see every section highlight, and choose eligible work for that exact area. Planting reports both field eligibility and the real seed-limited count, completes only that many sections, and leaves the rest prepared. Crop slots show keys and seed counts; 1–8 selects crops, WASD/arrows pan, transfer buttons read Barn → Pickup / Pickup → Barn, impossible zero-source transfers and sales are disabled, water sounds pour more softly, and the pickup engine is substantially quieter and less harsh.
- **Verification:** 257/257 tests passed; strict typecheck, Vite production build, desktop-relative build, and diff checks passed. Browser acceptance dragged and visibly inspected a 12-section rectangle, prepared all 12, then verified a two-seed Corn plan reported `2 of 12`, planted exactly two, ended at zero seeds, and left ten prepared. It also covered the exhausted-seed menu, key-2 Wheat selection, bounded keyboard camera motion, directional zero-cargo controls, explicit save/title/reload persistence, test-save cleanup, and zero warning/error logs. The packaged file URL reported `Farm Empire`; both the build and literal Desktop shortcut launched four responsive processes and left zero residue.
- **Review:** The architecture-strategist boundary kept rectangle planning pure and DOM-free, transient selection/app orchestration outside saves, rendering limited to existing selection presentation, and every completed field change on the current transaction path. The primary audited acreage crossing, stable route order, resource limiting, farmhand reservation, click-versus-drag and pan conflicts, input cleanup, text-input hotkey isolation, disabled-action semantics, save neutrality, package contents, shortcut routing, and process cleanup. No high- or medium-severity issue remains.
- **Artifacts:** `release/field-controls-v1/verified-win-unpacked/Farm Empire.exe` (225,442,304 bytes) and `resources/app.asar` (1,433,194 bytes), generated and ignored. `C:\Users\Admin\OneDrive\Desktop\Farm Empire.lnk` targets this smoke-tested build.
- **Known limitations:** Drag selection is rectangular and stays inside one acreage. Manual harvest still moves directly into barn storage; there is no carried basket, selectable destination, wagon, field cache, or worker logistics layer yet. Procedural sound changes were technically verified but still require the owner's subjective listening pass.
- **Push:** Not yet pushed; external GitHub authorization is still required.

## Manual Harvest Basket Logistics V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** local-only `feat: add manual harvest basket logistics` (see Git history)
- **Scope:** Add a persistent owner-only manual-harvest basket with barn/pickup destination choice and save v17, preserving existing crop values, barn/pickup authority, tractor/farmhand harvest semantics, workforce, and economy. No wagon, field cache, worker logistics, capacity tier, spoilage, or rebalance.
- **Result:** Manual harvest now commits full yields into a visible 24-unit saved basket. Whole mixed baskets unload only when their weighted capacity fully fits the selected barn or present pickup, then transfer atomically. Multi-section harvests automatically unload and resume; Escape preserves basket contents while stopping the current unload and unfinished work. Mounting while carrying is blocked, and tractor/farmhand harvest remains direct-to-barn.
- **Verification:** 265/265 tests passed, including 8 focused basket tests; strict typecheck, Vite production build, and `git diff --check` passed. Focused coverage proves basket harvest atomicity, mixed destination capacity checks, persistence, v16 migration, corrupt v17 normalization, relief eligibility, and mounted-action guard logic.
- **Review:** Independent Red Team identified mounted basket motion and Escape auto-restart as medium issues; both received one bounded repair and regression coverage. Browser interaction verification was not run because the browser runtime hit a Windows ACL-helper failure, so visual/player-facing acceptance remains outstanding.
- **Known limitations:** Basket capacity is one fixed 24-unit owner inventory. There is no wagon, field cache, worker basket use, automatic hauling, partial unload, crop spoilage, further capacity tier, or economy rebalance.
- **Push:** Not pushed.

## First Farm Morning V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** `feat: add first farm morning guide` (local)
- **Result:** Added a fresh-only runtime welcome, a derived corn logistics guide, Farmbook Today/Later framing, truthful pickup-progress chip, and a single gated field pulse. No save, economy, transaction, or unlock authority changed.
- **Verification:** 268/268 tests, 3 focused guide tests, strict typecheck, Vite production build, and diff check passed. Re-review found no High/Medium issue.
- **Known limitation:** Prescribed browser validation remains blocked by the recorded Windows ACL-helper failure; no fallback was used.

## Economy & Commercial-Scale Calibration V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** local `feat: calibrate farm scale economics` (see Git history for hash)
- **Scope:** Remove the proved early acreage grind and make commercial silo storage truthful without changing starting cash, crop values, timers, other equipment prices, freight requirements, market, basket, progression, or save v17.
- **Result:** The neighboring parcel is $4,250 plus working seed capital. Valid County Grain Silo ownership now derives 1,200 combined storage. A pure crop-capital planner powers compact Farmbook 36/96 plans and selected-crop Land Records guidance; silo and trailer copy now state capacity and freight convenience honestly. Full 96-section operated corn, soy, and cabbage fit; tomatoes and pumpkins require load-out.
- **Evidence:** Exact in-game seed/yield/base-price/storage calculations prove the two starting corn seeds can cover the 12-unit first delivery and its payout still funds tractor restoration from $5,000. This is a legible game abstraction, not a real-world farm-cost claim; a future primary-source calibration study remains separate.
- **Verification:** 275/275 tests passed; focused economics and land tests, strict typecheck, Vite production build, and diff check passed. Coverage pins $4,250, silo derivation, 150/200 non-silo normalization, freight requirements/capacities, crop tradeoffs, operated silo fit, and helper input immutability.
- **Review:** Independent Red Team found no Critical/High issue and one bounded Medium no-mutation test gap; the gap was repaired, and re-review found no High or Medium issue.
- **Known limitation:** Prescribed browser validation remains blocked by the recorded Windows ACL-helper failure; no fallback, package, shortcut, or push was used.

## Commercial Freight Route V2 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** `feat: add commercial bulk freight routes` (local)
- **Result:** Trailer-owned farms receive one deterministic, labeled commercial bulk route plus two standard daily Freight Board routes; base pickup farms retain three standard routes. Bulk uses approved 96/104/112/120 weight-1 or 32/36/40 pumpkin bands, exceeds 72 weighted cargo but fits 144, and locks a 40% premium; standards remain at 25%. Save v18 preserves valid legacy standards and fails closed for invalid bulk or completed-day state.
- **Verification:** 282/282 tests passed; strict typecheck, Vite production build, and `git diff --check` passed. Red Team High/MEDIUM save-integrity findings (same-day double payout, legacy unlocks, attainable payout ceilings) were repaired and re-review accepted with no High/Medium findings.
- **Known limitation:** Prescribed browser validation remains blocked by the recorded Windows ACL-helper failure; no fallback, package, shortcut, or push was used.

## First Farm Manager V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** local checkpoint `feat: add farm manager morning dispatch` (see Git history for hash)
- **Result:** Added Farm Services’ one-time $2,400 manager contract after County trust, north acreage, and Mara hire. A v19 saved standing plan previews exactly one real Mara task and requires an explicit current-day dispatch; Mara’s existing $120 wage is still the only shift charge. The manager has no offline work, cargo/supply handling, sales, clearing, or hidden spend.
- **Verification:** 287/287 tests passed, including five focused manager tests; strict typecheck, Vite production build, and diff check passed. Independent re-review accepted with no High/Medium findings. The repair added an explicit **Update plan** control and north/crop saved-plan regression coverage.
- **Known limitations:** Browser/player-surface and DOM click-flow verification remain blocked by the recorded Windows ACL-helper failure; no fallback was used.

## Direct Controls & Cargo Clarity V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** `feat: add direct vehicle controls` (local; see Git history for hash)
- **Result:** Farm-operated pickups and operational tractors now take bounded screen-relative WASD/arrow steering targets. Idle on-foot input still pans the bounded camera. A separately armed right-click moves only on open ground and never opens services or menus; it cannot disturb primary drag selection/panning. Cargo entry labels now distinguish farm transfers from County buying/selling, without changing any transaction or route.
- **Boundaries:** No save/schema, economy, business transaction, map/camera-policy, vehicle-speed/effect, collision, pathfinding, art, audio, setting, or progression change.
- **Verification:** 293/293 tests passed, including focused mapping, bounds, non-mutation, directional block routing, gesture, move-only-ground, and pickup-help coverage; strict typecheck, Vite production build, and `git diff --check` passed. Independent Red Team re-review accepted with no Critical/High/Medium findings.
- **Known limitation:** Computer Use packaged-app launch approval timed out, and the prior browser ACL-helper issue remains. Event sequencing is pure-test-reviewed but not browser-click-validated; no fallback, package, shortcut, or push was used.

## Playtest Rescue V1 - complete

- **Date:** 2026-08-17
- **Branch:** `codex/first-town-contact`
- **Commit:** local checkpoint `feat: rescue farm playtest flow` (see Git history for hash)
- **Scope:** Repair reproduced Scout click theft, cargo-transfer friction, and the base/loft storage dead end without changing prices, crop yields, pickup 72/144 capacity, save schema, or unrelated systems.
- **Result:** Functional world targets now outrank overlapping Scout with a throttled open-grass prompt; open grass retains scratches and a transient deterministic frisbee fetch. Seed and produce panels retain exact entry plus safe authoritative All actions. Farm capacity derives 480 base, 720 loft, or 1,200 silo; valid v19 150/200-capacity saves normalize forward. The literal stranded 144-corn + 18-basket save unloads successfully to 162 corn.
- **Verification:** 299/299 tests passed; strict typecheck, Vite production build, and `git diff --check` passed. Red Team’s Medium manual/basket-fetch cancellation issue was repaired, and the re-review basket-unload finding received one surgical repair with source readback and focused companion/basket coverage.
- **Known limitation:** Browser/player UI validation was not run. The denser transfer controls and a real existing-save rescue remain pending player-surface checks. No package, shortcut, commit-push, or browser fallback was used before this checkpoint commit.
