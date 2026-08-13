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
