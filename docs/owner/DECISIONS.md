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
