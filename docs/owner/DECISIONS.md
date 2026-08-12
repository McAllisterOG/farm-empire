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
