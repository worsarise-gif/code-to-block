# Design Decisions Log

Keep this updated as real decisions get made. The point isn't
completeness — it's making sure a decision made once, deliberately,
doesn't quietly get re-decided differently later without anyone
noticing.

---

## Hero section: layered backgrounds vs. composite block
**Phase**: 1
**Decision**: Keep the hero's background image + overlay as a single
`background-image` CSS value (gradient layer + image layer) on the
container, rather than splitting them into separate composite sub-blocks.
**Why**: Verified against real JSON — the two layers aren't separate
nodes in `children`, so they physically cannot be dragged apart,
reordered independently, or have another block inserted between them
in Phase 3's drag system. They move and paint together by construction.
**Reference**: `block-schema.md:57-60`, hero entry in
`block-examples.json:208`

## Hero content: full drag freedom vs. locked
**Phase**: 1 (flagged during hero review), decision made before Phase 2
**Decision**: `hero-content` and its child text blocks (eyebrow, heading,
intro) can be freely dragged out of the hero, reordered, or moved
elsewhere in Phase 3 — no lock or container-level movement constraint.
**Why**: Full editability was chosen deliberately over restricting
movement. This matches how Elementor and Divi both handle nested
content generally, and keeps the "everything is a real draggable
element" premise honest rather than special-casing the hero.
**Trade-off accepted**: a user can accidentally break a hero's intended
composition by dragging its heading out. This is treated as user
responsibility, not a bug to prevent.
**If this needs revisiting**: if dogfooding (Phase 6) surfaces this as
a real, repeated frustration rather than a theoretical risk, reopen this
decision then — don't add a lock preemptively without that evidence.

## Content slots: additive single-value props
**Phase**: Upgrade File 4
**Decision**: Content slots remain metadata on existing text/image/link blocks.
Text and rich-text saves replace the marked block's children with one value;
rich text is constrained inline HTML rather than a nested block subtree.
Linked reusable components keep canonical structure in the component document
and store per-instance values in the page's `slot_values` map.
**Why**: This preserves the explicit single-value scope, avoids adding nesting,
prevents Content Mode from changing structure, and lets linked instances accept
independent props without forking the reusable component.

## Editor UI Tabs vs Toggle
**Phase**: Upgrade File 17
**Decision**: The three-tab (Content/Style/Advanced) structure supersedes File 10's binary toggle. This is a deliberate revision, not two systems coexisting.

## Element-level Permissions
**Phase**: Upgrade File 17
**Decision**: The Permissions panel extends (not replaces) File 4's page-level content-mode concept. These are two different granularities (page-level vs. per-element) serving different real use cases, both worth keeping.
