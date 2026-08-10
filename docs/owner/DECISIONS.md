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
