# Farm Empire Decisions

Only approved decisions with durable product, architecture, or workflow impact belong here. Brainstorming and ordinary conversation do not.

## 2026-08-09 - Adopt Owner Console project control

**Status:** Approved by the owner

- Owner Console is the durable planning, coordination, authorization, and reporting layer.
- Ordinary discussion is non-mutating. The exact `brainstorm` / `end brainstorm` protocol is binding and brainstorming is never implementation authorization.
- Authorized work is converted into a finite package and normally delegated to one primary implementation writer.
- Substantial milestones normally receive one independent read-only Red Team review and at most one routine repair/re-review cycle.
- `STATUS.md`, `PLAN.md`, this file, and `WORK_LOG.md` are the recoverable project-control record.
- No Milestone 2 work is authorized by establishing this workflow.

## 2026-08-09 - Preserve the Farming Business V1 checkpoint

**Status:** Approved existing direction

- Farming Business V1 is the current known-good product checkpoint on `codex/farming-business-v1`.
- Future work should extend the deterministic core, data-driven definitions, isometric renderer, focused DOM UI, and versioned save architecture rather than rewrite working systems without cause.
- The clean `farm-empire:*` save namespace remains separate from preserved legacy `paradise-isle:*` browser data.
- Money remains integer cents and business simulation remains deterministic and testable.

## 2026-08-10 - Make machinery physical through operated field work

**Status:** Approved by the owner

- The old tractor is now directly operated through a simple enter/exit and click-to-drive workflow rather than existing only as a passive efficiency stat.
- Tractor planting and harvesting jobs work one owned 3×3 parcel at a time in a deterministic serpentine route and reuse the existing per-plot transactional actions.
- Partial jobs must preserve seeds, storage, and unprocessed crops while clearly reporting completed, skipped, and untouched work.
- Active operation and job queues are transient. Completed work and tractor position persist, and mounted saves reload the player at a safe deterministic dismount position.
- Implements, fuel, condition, dealerships, trailers, combines, hauling, collision physics, and advanced pathfinding remain deferred rather than being implied by this slice.

## 2026-08-10 - Make farm scale physical without migrating saves

**Status:** Approved by the owner

- One saved logical plot is presented as one large field section, and an owned parcel reads as a 3x3 block of those sections.
- Farm Empire uses one authoritative logical-to-presentation projection while keeping plot IDs, coordinates, yields, ownership, actor and tractor state, and save schema v4 unchanged.
- The active farm is a flat rectangular mainland with continuous soil sections, rural lanes, and tree-line framing; the legacy island renderer remains preserved and isolated.
- Player-facing language uses `field section` for one workable unit and `parcel` for a 3x3 owned group.
- Visual scale and identity should continue through bounded farm-only presentation slices before broad legacy character, pet, quest, or building systems are reconsidered.

## 2026-08-10 - Keep the first farm companion transient and presentation-only

**Status:** Approved by the owner

- Scout is one fixed farm dog whose follow, home, sit, and scratches behavior adds warmth without creating a pet economy or progression system.
- Companion coordinates, facing, approach state, and reaction timing are runtime-only; existing saves gain Scout automatically and serialize no companion fields.
- The generic legacy pet, quest, character, and building systems remain isolated rather than being reactivated wholesale.
- Farm-only character and landmark painters may establish a higher visual bar without changing the business simulation or saved logical coordinates.

## 2026-08-10 - Keep farm atmosphere decorative and tied to game time

**Status:** Approved by the owner

- Barnyard props, fences, gates, crop/tree motion, tractor exhaust, lamps, and fireflies are presentation-only and add no collision, inventory, action, economy effect, or save field.
- All decor anchors are deterministic and must remain clear of workable plots, landmark interactions, Scout's home, tractor/dismount space, and the main gravel lane.
- Farm Empire daylight and night effects follow the saved accelerated farm clock shown in the HUD; the preserved legacy island retains its existing real-time lighting behavior.
- Ambient animation stays bounded and must not create unbounded sprite-cache keys or obscure gameplay feedback.

## 2026-08-10 - Improve machinery feel without changing saved machinery state

**Status:** Approved by the owner

- Operated tractor travel uses deterministic runtime acceleration, braking, bounded angular turning, wheel roll, steering cues, and direction-aware effects while retaining exact logical target arrival and existing transactional field actions.
- Heading, velocity, steering, and wheel phase are presentation state only; save schema v4 continues to persist tractor position and business state without active motion.
- A flat side-view machinery painter must stay visually upright, mirror for leftward travel, and use the isometric farm basis rather than rotate freely like a top-down icon.
- Collision physics, road planning, implements, fuel, condition, hauling, and equipment economy remain separate future packages rather than being implied by motion polish.

## 2026-08-10 - Make the first town a separate physical service destination

**Status:** Approved by the owner

- The farm contains a visible signed road gateway, while the County Service Center renders as a separate walkable Canvas scene with its own transient actor, camera, gestures, and input surface.
- Every visible town building is backed by a real Farm Empire service. The first center contains only Feed & Seed, the Grain Exchange, and Farm Services rather than decorative or unavailable storefronts.
- Seed, market, land, and equipment interactions reuse the authoritative integer-cents farm business state; the town Equipment Desk can inspect equipment but cannot operate it.
- Town location and movement are not saved. Saves made in town serialize ordinary farm/business state and reload at a deterministic safe farm-gateway anchor.
- Legacy island neighbors, social systems, inventories, quests, currencies, and shops remain isolated rather than being revived to populate the town.

## 2026-08-10 - Give the town one finite farm-business story loop

**Status:** Approved by the owner

- Mae Carter introduces one persistent County Pantry corn order requiring 12 units of real stored corn; its progress is derived from authoritative barn storage rather than a parallel quest counter.
- Only Eli Morgan's Grain Exchange can fulfill the order. Farm HUD and barn market panels remain ordinary selling surfaces and fail closed for County delivery.
- Fulfillment atomically removes exactly 12 corn, awards exactly 8,500 integer cents once, synchronizes the cash mirror, and completes before another payout can occur.
- Save schema v5 persists only the minimal contact status and defensively normalizes old, missing, or corrupt data; transient town position and actor state remain unsaved.
- Deadlines, RNG, reputation, repeat contracts, hauling scenes, generic quests, and legacy social/currency systems remain deferred.

## 2026-08-10 - Default Farm Empire tasks to Luna Medium

**Status:** Approved by the owner

- New Farm Empire research, implementation, and review tasks default to `gpt-5.6-luna` with Medium reasoning.
- Sol models, Fast mode/service-tier overrides, and reasoning above Medium require explicit owner approval for a named finite task.
- Task count should be minimized: normally one bounded writer, with one independent reviewer only when the checkpoint is substantial.
- Completed or redundant tasks should not be continued merely to consume an available parallel slot.

## 2026-08-10 - Make the first tractor upgrade physical and operated

**Status:** Approved by the owner

- The County Row-Crop Field Kit is one visible, town-purchased upgrade unlocked after the first County order, with its provisional price isolated as 125,000 integer cents.
- Planting speed and harvest bonuses apply only during physically operated tractor parcel jobs; manual work and a tractor without the kit retain base economics.
- Existing v5 farms are grandfathered through save v6 while fresh farms begin without the kit. Toolbar pose remains transient and unsaved.
- Implements, trailers, hauling, fuel, condition, and broader machinery tiers remain separate future packages.

## 2026-08-10 - Protect playability with recovery and one storage step

**Status:** Approved by the owner

- Farm crops have one authoritative deterministic stage model and a 15-minute post-maturity harvest window. Withered sections can be cleared without crop, seed, or cash refund.
- County relief is a lifetime one-seed safety net for a true zero-asset farm, issued only through Mae/Farm Services and persisted so deliberate loss cannot recycle it.
- The Barn Loft Expansion is a one-time 180,000-cent investment unlocked by owning the neighboring parcel; it raises storage from 150 to 200 and has a restrained visible barn change.
- Save v7 fails closed for malformed relief/loft data and requires the parcel prerequisite during normalization as well as purchase.
- These safeguards do not authorize a crop rebalance, repeat subsidy, broader land tier, worker system, or logistics rewrite.

## 2026-08-10 - Expand crop choice through existing farm milestones

**Status:** Approved by the owner

- Carrots and tomatoes unlock after the County Pantry order, cabbage unlocks with the neighboring parcel, and pumpkins unlock with the Barn Loft Expansion; these licenses are derived from existing saved achievements rather than new persistent flags.
- New crops start with zero seeds on fresh and older saves. Selection, seed purchase, manual planting, and tractor planting all fail closed while a crop is locked.
- Crop roles remain data-driven and use whole barn units: carrots minimize capital and time, tomatoes emphasize throughput, cabbage emphasizes value per barn unit, and pumpkins trade three storage units per item for the highest base gross and margin.
- County emergency relief always selects the cheapest starter-eligible crop, so later catalog pricing cannot issue an unusable locked seed.
- Additional crop tiers, fertilizer, irrigation, quality, processing, recipes, and crop-specific machinery remain separate future packages.

## 2026-08-11 - Ship a secure local Windows desktop build

**Status:** Approved by the owner

- Farm Empire's supported local player surface is a sandboxed Electron shell that loads the bundled Vite build, keeps Node integration disabled, denies unexpected navigation, and allows only the existing HTTPS attribution link to open externally.
- The stable app identity `com.farmempire.desktop` and `%APPDATA%\Farm Empire` profile preserve desktop localStorage across launches and rebuilds. Desktop saves remain intentionally separate from browser saves; no automatic scraping, import, or cloud synchronization is introduced.
- The supported branded shortcut targets the unpacked x64 application and uses the deployed Farm Empire ICO explicitly. Portable and NSIS artifacts are also produced, but the local build remains unsigned with no auto-updater or publisher-certificate claim.
- Desktop packaging does not authorize gameplay, economy, or save-schema changes. Future signed distribution, auto-update, cross-platform builds, and browser-save import require separate design and authorization.

## 2026-08-11 - Make County commerce a physical pickup route

**Status:** Approved by the owner

- Every farm owns one old pickup from the start. Its persistent mixed cargo bed holds 72 units; crops use their existing storage footprint and each seed bag uses one unit.
- Harvest still enters the barn. Farm panels move produce and seed bags reversibly between authoritative farm inventory and pickup cargo; ordinary seed buying and crop selling occur only at the County Service Center with the pickup present.
- The County Pantry order now derives progress from pickup corn and consumes exactly 12 hauled units at Eli's Grain Exchange. This supersedes the earlier barn-source decision without adding a parallel quest counter or repeat payout.
- On-foot town visits remain valid for dialogue, records, and inspection, but seed purchase, crop sale, and delivery actions fail closed without the pickup.
- Save schema v8 persists pickup cargo and safe farm coordinates. Town vehicle presence, velocity, heading, and operating state remain transient; town saves reload safely at the farm gateway with cargo intact.
- Trailers, hitching, fuel, damage, routed roads, combines, workers, managers, repeat contracts, and economy rebalance remain separate future packages.

## 2026-08-12 - Make first-play navigation and hauling physically legible

**Status:** Approved by the owner

- Farm and town cameras fit and clamp to their active scene, refit on resize, and expose explicit recentering so the playable map cannot be lost in blank space.
- A persistent hamburger menu provides Save, How to Play, and Save & Return to Farms without requiring the player to quit the desktop application; input listeners must be cleaned up before returning to the slot screen.
- Farm cargo transfers require the pickup at a visible barn cargo pad. The pad, gateway, parcels, and interaction landmarks must not overlap; legacy saves parked exactly at the conflicting gate position normalize to the pad with cargo preserved.
- Vehicle panels are context-specific: tractor interaction cannot expose pickup actions, and the pickup owns its Operate and Manage Cargo surface.
- The hand pump remains decorative until irrigation is deliberately designed; player guidance must say that crops currently grow automatically.
- The humble farmhouse, road, town-edge houses, and distant field cues are presentation-only. The town keeps exactly three functional services and remains a separate scene.
- Starting cash remains $5,000. Larger acreage, farmhouse upgrades, farmer knowledge levels, economy research, and starter-equipment timing are recorded future packages rather than being silently folded into this repair.

## 2026-08-12 - Establish commercial-scale working acreage

**Status:** Approved by the owner

- The starter acreage is now 6x6, or 36 workable field sections. The neighboring acreage is 8x12, or 96 sections, making it 2.67 times the starter's working area. This supersedes the earlier 3x3 parcel geometry while retaining `field section` as the individual workable unit.
- Parcel rectangles and labels are data-defined and shared by plot creation, ownership lookup, purchase, rendering, input, tractor planning, and tests; new acreage must not be recreated through scattered coordinate constants.
- Save schema v9 adds missing sections for every owned acreage without replacing existing plot UIDs, crops, cargo, or business state. Legacy gate/player relocation is a one-time v8-to-v9 migration concern rather than a rule applied to every later load.
- Tractor acreage plans remain deterministic and serpentine, but stop at the selected crop's actual seed count or the barn's actual remaining capacity. The vehicle must not traverse dozens of impossible actions merely to report skips.
- The whole property has bounded camera and terrain limits, while the default recenter uses a separate homestead-focused fit. Larger acreage should feel physical without turning the farm back into a tiny island in empty space.
- Pickup gate travel uses one authoritative logical County-road route that is also rendered on screen. The cargo pad, road, fields, barn, gate, Scout, and farmyard decor must remain mutually legible and non-conflicting.
- Starting cash remains $5,000 and the first land price remains $6,500. Crop prices, yields, barn capacity, and machinery progression were deliberately not rebalanced inside the geometry package; those relationships require the separate evidence-based economy study.
- Further land tiers, irrigation, farmer knowledge levels, workers/managers, farmhouse upgrades, and tractor availability changes remain separate packages.

## 2026-08-12 - Make the world itself the primary farm interface

**Status:** Approved by the owner

- Visible focal objects own their context action. One explicit hit-priority map resolves overlaps so pickup, tractor, Scout, farmhouse, pump, barn, doghouse, gateway, acreage, and field clicks cannot silently open unrelated controls.
- A compact Farmbook consolidates progression guidance, farm records, cargo, land, road, save, and recenter routes. It replaces redundant farm-footer buttons rather than adding another persistent control cluster.
- Farmer Knowledge V1 is derived from authoritative business stats and milestones, uses short evidence-sourced notes, and remains presentation-only. It adds no hidden economic modifier, parallel inventory, or save-schema field.
- Farm and town pickup authority remains physical: transfers happen at the barn pad, County commerce requires the pickup in town, and the dedicated County parking bay stays separate from the return sign.
- Deeper tutorial branches, skill effects, irrigation, workers, economy rebalance, new acreage, town interiors, and broader social systems remain separate future packages.

## 2026-08-12 - Establish manual fieldwork before deeper mechanization

**Status:** Approved by the owner

- An owned section moves through explicit rough, tilled, planted, established, harvest-ready, and stubble conditions. Manual planting requires prepared soil, and harvested or cleared sections require reworking before another manual crop.
- Manual crops require one establishment watering before growth time begins. Waiting before that watering does not consume the crop's growth or wither window; the watering action is deterministic and cannot be repeated for a bonus.
- The current operated tractor remains a deliberate integrated preparation, planting, and establishment pass so existing batch jobs and business transactions stay playable. Separate plows, planters, water equipment, and implement ownership remain future progression.
- Save schema v10 persists only section soil conditions and the optional per-crop waiting flag. Existing crops migrate as established and retain their original timestamps; missing or malformed data fails open to playable growth rather than trapping a crop.
- Rough, tilled, wet, needs-water, and stubble presentation must agree with hover labels, action menus, the Farmbook, the hand pump, and How to Play. Recurring moisture, weather, irrigation infrastructure, fertilizer, soil health, crop quality, workers, and economy rebalance remain separate packages.
- This decision supersedes the earlier first-play guidance that all crops grow automatically; the hand pump itself remains a guidance landmark rather than a water inventory or irrigation system.

## 2026-08-12 - Make the inherited tractor the first mechanization milestone

**Status:** Approved by the owner

- Fresh farms begin with the Old Red Tractor visibly awaiting restoration, while valid pre-v11 farms retain the operational tractor they already owned.
- Manual section, row, and three-row work remains the complete path to the first County Pantry delivery. Completing that delivery unlocks a one-time 195,000-cent restoration at the County Equipment Desk.
- Powered parcel planning and operated planting/harvest fail closed until restoration. The County Row-Crop Field Kit remains a separate 125,000-cent upgrade and cannot be installed before the base tractor is operational.
- Save v11 persists the existing tractor status, treats missing or malformed current status as maintenance, and performs no automatic reward, crop, land, or economy changes. Starting cash remains $5,000.
- Fuel, breakdown RNG, recurring condition, a dealership catalog, implements, combines, trailers, later machinery tiers, and an economy-wide rebalance remain separate packages.

## 2026-08-12 - Let owned acreage visibly grow the farmhouse

**Status:** Approved by the owner

- The humble starter farmhouse remains the fresh-farm presentation. Owning the existing neighboring acreage deterministically derives one expanded two-story home tier from the authoritative parcel flag.
- The larger painter, interaction radius and label, farmhouse-office title, operation snapshot, land-record copy, and purchase feedback must change together so the visible reward and usable target agree.
- Homestead Growth V1 adds no separate purchase, cash effect, save-schema field, migration, production bonus, capacity, room system, or hidden Farmer Knowledge modifier.
- Further farmhouse tiers, renovations, interiors, household systems, and functional property bonuses remain deferred until a deliberate upgrade and economy model is approved.

## 2026-08-12 - Give the proven farm one repeatable County haul

**Status:** Approved by the owner

- Completing the one-time County Pantry introduction unlocks one deterministic Freight Board offer per saved farm day at Eli's Grain Exchange; offers select only crops already unlocked by authoritative farm milestones.
- Acceptance snapshots crop, exact quantity, issued day, and a fixed 25% premium over that day's posted market quote. Accepted terms persist without a deadline and do not change when the market or day advances.
- Fulfillment requires the physical pickup at the County Service Center, consumes the exact saved crop quantity, records the current day as completed, credits integer cents atomically once, and cannot post another route until a later farm day.
- Save v12 persists only the active contract snapshot and last completion day. Old/missing state receives no payout or completion; malformed terms fail closed within known crop, template, cargo, day, and payout bounds.
- Multiple offers, negotiation, deadlines, penalties, reputation, contract chains, special cargo, and a generic quest system remain deferred.

## 2026-08-12 - Make the first County haul unlock physical logistics growth

**Status:** Approved by the owner

- Completing any first paid Freight Board haul unlocks one County Utility Trailer at the Equipment Desk. Its provisional one-time price is 240,000 integer cents ($2,400).
- Ownership doubles the pickup's authoritative mixed-cargo capacity from 72 to 144 units. Transaction enforcement, save normalization, HUD, cargo panels, Farmbook, help copy, browser text state, and Canvas presentation must derive from the same ownership state.
- The trailer is visibly and automatically attached to the pickup at the farm, while driving, and in County parking. Manual hitching is deliberately omitted from V1 so the purchase improves the existing hauling loop without adding a second vehicle-state workflow.
- Save v13 persists only literal trailer ownership. V12 and malformed ownership default closed; malformed Freight Board completion history cannot unlock the purchase or grant equipment.
- Fuel, damage, upkeep, detachable implements, further trailer tiers, combines, workers, a dealership catalog, and economy-wide rebalancing remain separate packages.

## 2026-08-12 - Make the first farmhand an acreage-scale progression tool

**Status:** Approved by the owner

- Completing the County introduction and owning the neighboring acreage unlocks one named County farmhand, Mara Bell, at Farm Services. Her provisional one-time hire price is 180,000 integer cents ($1,800).
- The first eligible assignment started each saved farm day charges one 12,000-cent ($120) shift; later same-day assignments are covered. Empty plans and insufficient funds cannot mutate cash or paid-day state.
- Mara handles one whole owned acreage at a time: prepare, rework, plant the selected crop, water, harvest, or clear. Planning is deterministic and resource-aware, while completion reuses the existing authoritative manual field transactions instead of creating a parallel farming engine.
- The assigned acreage is reserved from owner/tractor field clicks while the job runs. The owner may work the other acreage, handle logistics, or visit town; completed sections persist, the current unfinished action does not commit on cancellation, and the paid shift remains paid.
- Save v14 persists only literal hire ownership and the last paid farm day. Actor position, facing, movement, action, target, and active job remain runtime-only; old/missing/corrupt workforce data fails closed and reloads idle at the farmhand home anchor.
- Multiple workers, managers, schedules, housing, needs, skill trees, autonomous crop strategy, payroll simulation, passive-income bonuses, and economy-wide rebalancing remain separate future packages.

## 2026-08-12 - Make County weather deterministic and useful

**Status:** Approved by the owner

- Each farm day has one clear, cloudy, or steady-rain condition derived from the existing saved farm seed and day. The current condition and three-day forecast therefore replay exactly after reload without a weather save field or save-version bump.
- Rain reuses the authoritative one-time establishment-watering transaction for manual crops still waiting for first water. Repeated weather updates are idempotent; already-established crops, harvest timing, prices, yields, storage, and equipment rules remain unchanged.
- Farm and County town receive the same condition. Cloud/rain casts and precipitation remain transient Canvas presentation, and the procedural soundscape adapts its existing wind filter instead of adding downloaded audio assets.
- Seasons, temperature, storms, drought, crop damage, recurring moisture, irrigation, soil health, crop quality, and weather-based yield or price modifiers remain separate future packages.

## 2026-08-12 - Add a lower-value local market at the farm gate

**Status:** Approved by the owner

- Completing the first County Pantry delivery unlocks one $650 Roadside Produce Stand improvement at Farm Services. Ownership creates one visible, directly interactive stand beside the County road.
- The stand derives one 6–12-unit request from the saved world seed, farm day, and currently unlocked crop catalog. The request pays 90% of that day's posted County quote so direct barn fulfillment is convenient but never pays as well as ordinary County sale or the 25%-premium Freight Board.
- Fulfillment consumes exact barn units, records the current day before paying integer cents, and cannot pay or post again until a later saved farm day. It does not use pickup cargo or replace the hauling route.
- Save v15 persists only literal stand ownership and the last completed farm day. V14 migration does not grant ownership; missing, malformed, prerequisite-invalid, or future-dated state fails closed.
- Multiple local offers, customer NPCs, unattended passive income, pricing choice, upgrades, reputation, managers, and economy-wide rebalancing remain separate future packages.

## 2026-08-13 - Add ambient County life without creating a second simulation

**Status:** Approved by the owner

- County Life reconstructs one roadside visitor and two plaza residents from the existing saved seed, farm day, clock minute, and explicit frame time. Their identity, position, facing, motion, and schedule are presentation-only and never serialized.
- The roadside visitor appears only while an owned stand has an open order during its 8:00 AM-8:00 PM business window. Two unlabelled ambient residents use separate public-plaza lanes from 7:00 AM-10:00 PM.
- Ambient actors are not service NPCs and do not enter town hit priority, dialogue, orders, prices, cash, inventory, progression, or Farmer Knowledge. The three named service townspeople remain the exact functional roster.
- Save v15, economy values, customer-order authority, and transactions remain unchanged. The earlier deferral of customer NPCs still applies to persistent customers, relationship systems, passive earnings, demand simulation, and repeatable social gameplay; this package adds only bounded visible passersby.

## 2026-08-13 - Let commercial storage unlock large-field operation

**Status:** Approved by the owner

- Owning the neighboring acreage and the existing Barn Loft Expansion unlocks one County Grain Silo at the Farm Services Equipment Desk. Its provisional one-time price is 480,000 integer cents ($4,800).
- Ownership raises authoritative combined farm storage from 200 to 800 units. Harvest capacity checks, cargo transfers, HUD, market panels, Farmbook records, player guidance, and the Canvas homestead must all derive from the same ownership state.
- The purchase visibly constructs a detailed metal silo beside the existing barn. It is a storage expansion, not a separate interactive inventory, grain-type restriction, or hidden production bonus.
- Save v16 persists only literal silo ownership. V15 migration never grants it, stored capacity is never trusted, and ownership without the neighboring acreage plus loft fails closed.
- Crop prices, yields, starting cash, land prices, hauling capacities, wages, spoilage, storage fees, multiple silos, bulk elevators, automated unloading, managers, and passive income remain separate future packages.

## 2026-08-13 - Let proven farms choose among three County freight bids

**Status:** Approved by the owner

- Once the Freight Board is unlocked, Eli's Grain Exchange posts exactly three deterministic daily bids selected from distinct crops the farm has actually unlocked. This supersedes the earlier single-offer presentation while preserving one accepted County contract at a time.
- Every bid snapshots its crop, quantity, buyer, issued day, and fixed 25% premium over that day's posted quote. Selecting one route retires the other two immediately; accepted terms remain locked without a deadline when the market or farm day changes.
- An acceptance request must match one of the current visible bids. Stale, fabricated, duplicate, locked-crop, or post-rollover requests fail closed without mutating cash, cargo, completion history, or the active contract.
- Existing active-contract save data already contains all authoritative terms, so this package does not add a save field or bump save v16. Missing or malformed contract data continues to normalize closed.
- Additional simultaneous contracts, negotiation, penalties, reputation, contract chains, special cargo, traffic, and a generic quest system remain deferred.

## 2026-08-13 - Make drag selection the flexible manual-fieldwork control

**Status:** Approved by the owner

- On-foot players may drag from one owned field section to another to select any rectangular area within one acreage. The visible selection uses a deterministic serpentine route and then offers only work that is eligible somewhere inside that area.
- Custom-area prepare, rework, plant, water, harvest, and clear actions reuse the existing short manual-action runner and authoritative field transactions. Planting snapshots the active crop and limits the planned route to the actual seed count, leaving the remaining selected soil unchanged without fake skips.
- Crop buttons expose both seed count and keyboard slots 1–8. Ground dragging remains camera pan, and WASD/arrow keys add an explicit bounded camera alternative; drag selection does not change saved camera or field state until a normal action completes.
- Barn/pickup transfer controls name their direction and disable impossible zero-source actions. Grain Exchange sale controls similarly disable zero-cargo sales instead of returning a quantity error.
- Harvest still enters authoritative barn storage. A carried basket, selectable harvest destination, wagon inventory, and field-edge logistics would change inventory authority and remain a separate designed package.

## 2026-08-17 - Make manual harvest a persisted hand-basket logistics loop

**Status:** Approved by the owner

- Manual owner harvest commits to one authoritative 24 cargo-unit hand basket rather than directly to barn storage. The basket persists exact known-crop counts and a selected `barn` or `pickup` destination in save v17.
- Harvest never partially fits: a field section changes only when its full yield fits. Basket unload first proves the complete weighted basket fits in the destination, then transfers every crop and clears the basket atomically.
- Large manual selections automatically walk to unload and resume only after success. Escape stops the current unload and unfinished selection while preserving the saved basket. Reload restores basket contents/destination but not transient walking/job state.
- The pickup must be present at the farm for pickup unloads. Tractor and farmhand harvests remain direct-to-barn; mounted entry and basket controls fail closed while carrying or operating a vehicle.
- Save v16 and earlier discard any stray basket field; malformed v17 basket data normalizes deterministically to known crops within capacity and a safe barn destination. Wagons, field caches, worker logistics, further basket tiers, spoilage, and economy rebalance remain deferred.

## 2026-08-17 - Make first-session guidance a derived, optional morning

**Status:** Approved by the owner

- An untouched unmet farm may show one runtime-only welcome; dismissal never writes a save field or gameplay state.
- A DOM-free presenter derives corn-only first-delivery progress and next action from authoritative fields, basket, barn, pickup, stats, and County contact state. It sends loaded-but-unmet farms to Mae before Eli and never alters transactions.
- The compact pickup chip and one field pulse are presentation-only, suppress around town and competing work, and Farmbook separates today’s delivery from later progression.
- Save v17, crop values, yield, grow time, storage, equipment, NPC services, and unlocks remain unchanged. Browser acceptance remains deferred solely by the recorded Windows ACL-helper failure.

## 2026-08-17 - Calibrate commercial acreage against exact in-game capital and storage math

**Status:** Approved by the owner

- Keep starting cash at $5,000 and every crop price, yield, timer, equipment price, freight requirement, market rule, basket rule, and progression gate unchanged; lower only the first neighboring parcel from $6,500 to **$4,250**.
- Raise the County Grain Silo authoritative combined capacity from 800 to **1,200**. Existing valid silo ownership derives that capacity during v17 normalization; farms without a valid silo continue to derive 150 or 200 from their existing milestones.
- A pure DOM-free crop economics helper exposes seed capital, base gross/net, storage, and optional operated field-kit yield for 36- and 96-section planning. UI guidance stays concise and distinguishes capacity truth from Freight Board requirements.
- Rationale is internal, reproducible game evidence rather than a claim of literal agricultural pricing: two starter corn seeds cover the 12-unit first delivery, its payout still funds tractor restoration from $5,000, and a 96-section operated harvest occupies 864 corn, 960 soy, or 864 cabbage units but exceeds 1,200 for tomatoes and pumpkins. Future real-world calibration remains a separately authorized primary-source study.

## 2026-08-17 - Add trailer-gated commercial bulk freight routes

**Status:** Approved by the owner

- The Freight Board always posts exactly three deterministic, distinct unlocked-crop routes and permits only one active contract. Without a trailer, all routes remain standard, retain their existing quantities, fit 72 weighted pickup cargo, and pay a locked 25% premium.
- Trailer ownership changes one daily route into a visibly labeled commercial bulk load while retaining two standard routes. Weight-1 bulk crops use 96/104/112/120 items; pumpkins use 32/36/40. Bulk cargo must exceed 72 and fit the 144-unit trailer, and pays a locked 40% premium.
- Save v18 persists route kind. Valid legacy V17 standard snapshots retain their original terms; V2 validation fails closed for malformed, locked, trailerless, over-cap, same-day-completed, or unattainable-payout contracts. Delivery remains exact pickup-only and atomic.

## 2026-08-17 - Add an explicit Farm Manager morning review, not automation

**Status:** Approved by the owner

- Farm Services may sell one **$2,400** manager contract only after County contact completion, neighboring acreage ownership, and Mara Bell’s hire. It has no recurring fee, yield, speed, or market bonus.
- The saved v19 manager record is only a standing `enabled` acreage/crop preference and `lastReviewedDay`; v18 migration grants nothing, invalid ownership closes the plan, and all actor/job/progress state remains runtime-only.
- A pure deterministic review chooses one existing Mara plan for the configured owned acreage: fully fitting ready harvest, needs-water, stubble then rough soil preparation, seed-limited planting, then idle. Withered crops stay owner-only.
- Dispatch is explicit from Workforce on the live current day. It reuses Mara’s existing real-job and $120 daily-shift path, marks review only after success, never works offline, buys supplies, moves cargo, sells, clears, or creates hidden spend. **Update plan** persists dropdown choices separately from Pause/Enable.

## 2026-08-17 - Make operated farm movement direct and cargo controls explicit

**Status:** Approved and complete

- On the farm only, an operated old pickup or operational tractor receives short, clamped screen-relative WASD/arrow targets. Idle on-foot directional input remains bounded camera pan; text input, panels, action menus, tractor field jobs, and active owner work consume directional input rather than moving a vehicle or camera.
- A standalone secondary-click gesture moves only to valid open ground. It never invokes farm objects, fields, gates, services, exits, or a parked town pickup; it cannot interfere with a primary drag/selection/pan. Town vehicles remain non-operable.
- Pickup wording must identify farm transfers as Farm/Barn ↔ Pickup and County entry points as Buy Seed Bags / Sell / Deliver Produce, while retaining the existing authoritative transactions and cargo-pad route.
- No save version or state, economy/business rule, map/camera policy, collision/pathfinding, vehicle speed/effects, art, audio, setting, or progression changes are part of this checkpoint.

## 2026-08-17 - Rescue the live farm flow without widening the economy

**Status:** Approved and complete

- Functional farm targets always take hit precedence over Scout. When Scout visibly overlaps one, the functional action proceeds and a throttled truthful prompt directs scratches to open grass; Scout remains pettable only where no other world target is hit.
- Scout’s open-ground menu offers a deterministic runtime-only frisbee fetch: a bounded arc, pickup pause, return carry, and safe cancellation for Escape, vehicle operation, tractor/farmhand/manual/basket work, town travel, and reload. It adds no save field, progression, collision system, or economy effect.
- Farm seed and produce transfers preserve exact quantity entry and add per-direction authoritative All amounts derived from source stock, mixed pickup capacity, crop weights, barn space, and cargo-pad presence.
- Combined storage now derives 480 base barn, 720 Barn Loft, or 1,200 County Grain Silo. V19 saves never trust stored capacity; old valid 150/200 values normalize forward while crops and the hand basket remain untouched. No schema bump is required.
- Prices, yields, pickup 72/144 capacities, freight, manager/workforce, direct controls, map, and the rest of the economy remain unchanged. Browser/player-surface validation remains outstanding.

## 2026-08-18 - Keep Farm readability presentation-only and lifecycle-truthful

**Status:** Approved and complete

- Farm crop rows use a Farm-only immutable visual table and direct Canvas painter for every current catalog crop; the inherited Paradise Isle crop painter remains unchanged.
- Ripe produce is reserved for ready crops. Withered plants retain crop silhouette identity but render smaller, desaturated, drooping, and without ripe produce; generic readiness/withered cues remain supplementary.
- Ground/field variation, section depth, and manual-harvest completion feedback are deterministic runtime presentation only. The burst is restricted to successful player basket harvests, never farmhand/direct-to-barn work.
- No save/schema, economy, capacity, layout, hitbox, control, camera, town, narrative, or dependency decision changes with this checkpoint.

## 2026-08-18 - Keep desktop QA isolated and explicitly opt-in

**Status:** Approved and complete

- The normal desktop profile remains exactly `%APPDATA%\Farm Empire`. Test data may use another profile only when `FARM_EMPIRE_QA=1` and `FARM_EMPIRE_QA_USER_DATA` is a non-empty, NUL-free absolute path; incomplete or invalid input fails closed to the normal profile.
- Electron selects the profile before the single-instance lock so a disposable QA launch cannot silently attach to the owner's already-running profile.
- QA farms, screenshots, and process state are disposable artifacts, not game saves, fixtures, progression, or release content. Verification must remove them after acceptance.
- Manual farm actions clear the cached pre-action hover when valid work starts so old lifecycle text cannot coexist with current progress/result feedback.

## 2026-08-18 - Pause Farm Empire outside active desktop sessions

**Status:** Approved and complete

- Farm crop age and the Farm business clock advance only while the farm is actively visible. Loading or returning from a hidden/minimized window shifts crop timestamps by the verified inactive interval and resets the clock's real-time anchor; prices, growth durations, and the active-session ready window are unchanged.
- Save v20 adds no nested field. Any pre-v20 farm receives one migration rescue that restores already-withered Farm crops to ready; later v20 crops that genuinely wither during active play are not repeatedly revived.
- Returning to the farm-selection title must hide the action menu and modal panel after destroying the live app so gameplay controls cannot leak over title slots.
- Canvas backing stores are capped at 1920x1080 pixels on large/high-DPI displays while retaining CSS viewport coordinates. HUD DOM work refreshes at 10 Hz; immediate action-driven HUD updates remain authoritative.

## 2026-08-18 - Make town buying exact and crop identity readable

**Status:** Approved and complete

- County Feed & Seed accepts any positive whole quantity up to an authoritative maximum derived from the selected crop's real price, available cash, unlock state, and remaining mixed pickup capacity. A Max action and live `used / capacity / open` summary replace hardcoded Buy 1 / Buy 5 choices; purchase accounting and cargo authority remain in the existing core transaction path.
- Returning from town with the pickup is a vehicle trip: the pickup and farmer arrive together at the barn cargo pad. On-foot County visits retain the existing walk-to-exit return.
- Farm-only crop art uses fewer, larger procedural plants with distinct crop silhouettes. Mature corn is deliberately taller and carries readable leaves, tassels, husks, and ears; other crops retain crop-specific forms. External asset packs are deferred until a coherent licensed art direction is approved.
- Scout overlap guidance uses plain punctuation-safe text. Save v20, prices, yields, timings, capacity tiers, progression, town geometry, and legacy Paradise Isle presentation do not change.

## 2026-08-18 - Make tractor work begin where the owner points

**Status:** Approved and complete

- A single operated-tractor field click keeps the convenient whole-acreage action, but its deterministic route begins at that clicked section instead of a fixed parcel corner.
- Dragging while parked in the operated tractor selects and works only the exact owned field sections covered by the drag. Seed/storage limits and every per-section transaction remain authoritative.
- An idle farm vehicle click may transfer control directly between the pickup and an operational tractor. Active tractor field work and an unrestored tractor still fail closed rather than being cancelled or bypassed implicitly.
- The operating tractor's white selection halo is removed. Save v20, vehicle position and motion fields, crop/economy rules, acreage ownership, camera, town vehicles, and legacy presentation remain unchanged.

## 2026-08-19 - Express cargo in pounds and bound dense-farm rendering

**Status:** Approved and complete

- Keep save-compatible integer cargo lots and all existing transaction math authoritative, but present one lot as 10 lb throughout Farm cargo, storage, seed, market, freight, basket, and equipment surfaces. The base pickup therefore reads 720 lb, its utility-trailer configuration 1,440 lb, and the base barn 4,800 lb without a save migration or capacity grant.
- Ready crops remain harvestable for one active hour. Save v20 still pauses crop age outside active visible sessions, so the wider window protects active play without creating offline spoilage or repeated crop recovery.
- Cache a finite six-variant set of procedural crop silhouettes per crop/stage and pace Farm Canvas presentation at a stable 30 FPS. Keep gameplay updates, timers, input, transactions, audio, and immediate HUD feedback independent of the presentation gate.
- Operated tractor field jobs may show a runtime-only planter or harvest wagon derived from the active job kind. The attachment adds no inventory, hitching transaction, capacity, bonus, persistence, or separate control.

## 2026-08-19 - Make Economy & Physical Scale V2 authoritative

**Status:** Approved and complete

- Farm economy capacity is integer **10-lb handling lots**: basket 24, pickup 72, trailer 144, barn 480, loft 720, silo 1,200 (240/720/1,440/4,800/7,200/12,000 lb). This is a game abstraction, not real acreage or farm pricing. Starting cash remains $5,000; assets, unlocks, freight premiums/templates, and Paradise Isle remain unchanged.
- The approved V2 crop table is authoritative for seed cost, grow time, yield, weight, and base sale price: corn 1400/70000/10/1/410; wheat 1000/55000/8/1/340; soy 1700/85000/9/1/500; potatoes 1900/75000/11/1/400; carrots 900/40000/8/1/380; tomatoes 2400/100000/16/1/470; cabbage 2600/140000/10/1/720; pumpkins 3200/180000/8/3/1350.
- Save v21 pins output at planting with a yield plus explicit balance provenance. v20 migration marks extant crops V1 and assigns their canonical V1 yield; fresh plants are V2. Only provenance-matched V1/V2 snapshots are accepted. Missing, forged, mismatched, or malformed snapshots normalize to current V2. Migration preserves inventory/seeds/cargo/basket/ownership, resets market quotes to V2 base, and clears active events.

## 2026-08-19 - Make tractor harvest logistics persistent and physical

**Status:** Approved and complete

- Restoring the Old Red Tractor includes its cultivator, basic row planter, and persistent 240-lot (2,400 lb) basic harvest wagon. Existing operational tractors receive only that empty basic wagon through save v22; maintenance tractors receive it on restoration.
- Operated tractor harvest preflights and atomically moves each whole pinned-yield section plus Implement Set bonus into the wagon, never the barn. A full wagon pauses the job without split, skip, or loss; Escape/reload preserve completed field work and wagon cargo while active jobs remain runtime-only.
- The tractor must physically drive its attached wagon to the barn receiving bay. Unload transfers the complete mixed load only when all weighted cargo fits the barn; failed capacity checks leave both inventories unchanged. Pickup cargo, trailer authority, idle vehicle handoff, farmhand, and manager logistics remain unchanged; workers still harvest direct to barn.
- The internal County Row-Crop Field Kit ID/ownership/cost/gates remain stable but player-facing copy is County Row-Crop Implement Set: +20% faster establishment and +1 operated harvest item. Its north-acreage/first-freight/restored-tractor gate unlocks one $2,400 County wagon tier at 480 lots (4,800 lb).
- Wagon attachment is automatic for operated harvest and visible while loaded; no manual hitching, combine, auger, header, tender, pickup redesign, worker logistics, or machinery/economy rebalance is authorized.

## 2026-08-19 - Add one finite County Kitchen delivery without a quest system

- County Market Street expands only the existing separate town scene: a larger convex public surface, four noninteractive homes/field cues, and County Pantry & Kitchen with Rosa Alvarez; no continuous map, interiors, schedules, or social simulation.
- After the completed Pantry order, Rosa offers one persistent Garden Table Delivery: exactly 8 corn, 6 carrots, and 4 tomatoes from the present pickup for $115 once. It is atomic, pickup-only, and completes before payout.
- Save v23 stores only Kitchen status. V22 migration deletes stray Kitchen data; malformed states fail closed, preserve all existing logistics/Freight data, and grant nothing.
- This is not a generic contracts system: no repeatability, dates, deadlines, penalties, reputation, currency, crop/equipment additions, or Freight changes.

## 2026-08-19 - Make Workforce & Manager V2 an explicit reviewed dispatch system

**Status:** Approved and complete

- Mara remains exactly a $1,800 Field Generalist with a $120 wage only when her first real assignment begins that farm day. Eliot Reyes is a manager- and north-acreage-gated $2,100 Field Crew Hand with a $100 first-real-assignment wage; he may prepare, rework, plant, water, and harvest only.
- The $2,400 manager remains one-time and wage-free. It owns two saved reviewed slots (Mara then Eliot) and one cost-free daily approval. Viable slots start in deterministic order only during visible Farm-mode updates; no load, hidden/offline, County, or approval action starts work.
- Worker jobs, movement, and claims are runtime-only. A shared deterministic ledger reserves plots, planting seed, and direct-barn harvest space, releases only unconsumed claims, and prevents player/tractor conflicts. Worker harvest bypasses wagon/pickup cargo authority; tractor harvest remains wagon-only and pickup remains commerce-only.
- Save v24 persists only defensive roster/slot/approval/dispatched-day state. V23 migration grants no Eliot, approval, claim, wage, or job; malformed values fail closed. Per-worker consumed-day tokens prevent same-day chaining across cancel, finish, reload, and manual/manager entry points.

## 2026-08-19 - Add Farmstead Office & Crew Quarters as an Eliot housing gate

**Status:** Approved and complete

- Farm Services sells one immutable $1,600 Farmstead Office & Crew Quarters property after completed County Pantry contact, north acreage, Mara's hire, and the manager contract. The exact one-time transaction persists only literal ownership and fails without mutation when gated, short of cash, or repeated.
- Eliot requires owned quarters in addition to his existing prerequisites. Save v25 normalizes ownership and Eliot fail-closed; v24 grants quarters only when the source has a valid existing Eliot hire.
- The property adds a `crew-quarters` farmhouse presentation tier with an attached office/quarters wing and retains one authoritative farmhouse interaction. It preserves the existing two-worker crew, worker anchors, hit order, all output/wage/dispatch/capacity/cargo/automation rules, and adds no third worker or buffs.
