# Handoff

## Current Task
Plan the complete Code to Block builder-controls overhaul: Divi 5-informed research, repository audit, target architecture, complete element contracts, migration, implementation sequencing, tests, and acceptance criteria. Do not implement the overhaul yet.

## Last Agent
Codex

## Status
Engineering specification complete and structurally verified; overhaul implementation has not started.

## Completed
- Audited the current inspector, style-control catalog, schema, renderer, primitive factory, dormant panels/widgets, responsive/state storage, global systems, REST persistence, and validation paths.
- Researched current official Divi 5 interface, module-attribute, composable-settings, responsive, preset, and custom-attribute documentation.
- Compared official Elementor, Bricks, Breakdance, WordPress, and Webflow control architecture documentation.
- Defined strict Content / Style / Advanced responsibilities and removed the global Simple/Advanced style-mode concept from the target design.
- Defined declarative element definitions, configured capability grants, registered style targets, sparse responsive/state contexts, preset/global precedence, schema v3, stable selectors, dual JS/PHP compilers, and explicit v1/v2 migration.
- Covered 58 first-class elements in the matrix, detailed element contracts, exclusions, and implementation checklists.
- Added explicit routing for every wider native-HTML import family so allowed tags do not receive a universal generic inspector.
- Wrote phased, file-level implementation tasks with purpose, steps, dependencies, migration notes, tests, and acceptance criteria.
- Stress-tested the proposal and incorporated the resulting revisions into the final architecture.

## Current State
The complete deliverable is `upgrade/builder-controls-overhaul-specification.md`. It contains all 31 requested sections and is the controlling plan for the overhaul. This work changes documentation only; no runtime builder code or schema was changed.

The earlier drag-and-drop implementation remains code-complete but lacks the authenticated live WordPress verification matrix because the available browser was logged out.

## Files Changed
- `upgrade/builder-controls-overhaul-specification.md`: new complete architecture and implementation specification.
- `.ai/HANDOFF.md`: replaced the previous handoff with this latest project state while retaining the unresolved drag-and-drop verification risk.

## Pending
- Product/engineering review and approval of the specification's architecture contracts.
- When implementation is authorized, execute Task A1 (baseline fixtures and current-behavior inventory) before refactoring.
- Separately, authenticate local WordPress and run the previously required drag matrix on post 39 before claiming live drag-and-drop verification.

## Problems / Risks
- The worktree already contains substantial unrelated user/agent changes and generated cache files; preserve them.
- Legacy schema v1/v2, traversal-index CSS selectors, universal style fields, duplicated Style/Advanced panels, and blanket `!important` output remain unchanged until implementation.
- The specification intentionally recommends a registry/schema/compiler foundation before broad UI work; implementing element panels first would recreate hardcoded branching.
- The native HTML allowlist is broader than the 58 first-class library. The specification routes those tags through first-class or limited compatibility definitions rather than pretending each is a polished palette element.
- Live drag-and-drop behavior is still unverified due to the WordPress authentication blocker documented in the prior handoff.
- The MemPalace checkpoint was attempted three times but its server was read-only because peer writer PID 12732 held the palace lock; retry this local handoff when that lock clears.

## Next Step
Review and approve `upgrade/builder-controls-overhaul-specification.md`. Once implementation is explicitly authorized, begin section 23 Task A1 by capturing golden v1/v2 documents, inspector snapshots, CSS/frontend parity fixtures, and the exact current supported-element inventory without changing behavior.

## Important Decisions
- Preserve strict Content / Style / Advanced ownership; Advanced must never render another style catalog.
- Element definitions grant configured control groups to registered targets; inheritance never implies every control.
- Keep `type` as a renderer family and `tag` as output semantics, while schema v3 adds a stable `element` identity and independent definition version.
- Store local values sparsely by target and context, including breakpoint-state intersections.
- Use stable hashed element selectors and target markers for v3; do not add `!important` automatically. Keep the legacy compiler during the support window.
- Migration is dual-read/canonical-write and explicit, atomic, previewable, reversible through WordPress revisions, and never silently triggered by opening an old page.
- PHP remains authoritative for validation/sanitization; JS and PHP CSS compilers share fixtures and must produce semantically identical output.
- Reuse the good existing history, token, guided-role, import, validation, revision/autosave, permissions, and parity systems through adapters rather than deleting them.

## Verification
- Document structure: PASS — 31 numbered deliverable sections.
- Element coverage: PASS — 58 matrix rows, 58 detailed contracts, and 58 checklist rows.
- Native HTML compatibility: PASS — every current allowed tag family has an explicit first-class or limited compatibility route.
- Completeness scan: PASS — no TODO/TBD, continuation promises, or abbreviation placeholders.
- Markdown structure: PASS — balanced fenced code blocks.
- `git diff --check -- upgrade/builder-controls-overhaul-specification.md`: no reported whitespace errors; the new file is untracked pending the user's normal Git workflow.
- Runtime tests/build: not run because this task intentionally changed documentation only.
