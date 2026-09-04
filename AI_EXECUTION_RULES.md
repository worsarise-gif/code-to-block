# AI Execution Rules — Follow From Start Until Completion

These rules control how the implementation plan in this file must be executed.

The AI must treat this file as an **ordered engineering execution plan**, not as a suggestion list.

---

## 1. Start Here Every Session

Before changing code:

1. Read this entire file.
2. Inspect the current repository state.
3. Review recent changes, commits, tests, and existing implementation.
4. Determine:
   - What is already complete
   - What is partially complete
   - What is currently broken
   - What task was last completed
   - What task should be executed next
5. Never assume the repository still matches the original audit.
6. Revalidate relevant findings before modifying code.

Always continue from the **latest real project state**.

Do not restart completed work.

---

## 2. Follow Priority Before Phase Number

Execute work in this order:

**P0 / CRITICAL**
→ **P1 / IMMEDIATE**
→ **REQUIRED**
→ **RECOMMENDED**
→ **ADVANCED**
→ **FUTURE**

A later-phase security, data-loss, save, rendering, or corruption issue must immediately move ahead of lower-priority work.

Phase numbering must never override severity.

---

## 3. Missing-First Rule

Before adding new functionality, always ask:

- Is something currently broken?
- Is something incomplete?
- Is an existing feature unreliable?
- Is an existing implementation disconnected?
- Is there a user-safety issue?
- Is there a data-loss risk?
- Is there a security problem?
- Is an existing foundation required first?

Fix those first.

Do not add advanced features while core functionality is unstable.

---

## 4. Do Not Rebuild Working Systems Without Evidence

For every system, first classify it as:

- Exists and works
- Exists but needs minor improvement
- Exists but incomplete
- Exists but unreliable
- Exists but architecturally weak
- Exists but disconnected
- Exists but duplicated
- Broken
- Missing
- Future

If an existing system is structurally sound, improve it instead of replacing it.

Examples of systems that should currently be treated as foundations unless new evidence proves otherwise:

- Element Registry
- Schema v3
- Zustand state
- iframe canvas isolation
- dnd-kit
- tree utilities
- DOMParser importer
- PostCSS handling
- responsive data model
- autosave/revisions
- Navigator
- breadcrumbs
- reusable components

Do not create competing implementations.

---

## 5. Work One Dependency Chain at a Time

Never implement a feature before its required foundation.

Examples:

```text
Tree invariants
→ Tree operations
→ Drag-and-drop
→ Navigator reordering
→ Reusable structures
```

```text
Element Registry
→ Control Schema
→ Typed Controls
→ Per-Element Controls
→ Responsive Controls
→ Global Presets
```

```text
Parser normalization
→ Asset extraction
→ DOM/CSS analysis
→ Block mapping
→ Preservation fallback
→ Rendering
```

```text
Stable serialization
→ Save
→ Autosave
→ Recovery
→ Revisions
```

Finish and verify the dependency before moving forward.

---

## 6. Execute Tasks in Exact Order

Within each phase, follow the numbered task order:

```text
1.1
1.2
1.3
...
2.1
2.2
...
```

Do not skip tasks unless repository inspection proves the task is already complete.

If a task is already complete:

1. Verify it.
2. Record that it passed.
3. Continue to the next task.

Do not reimplement it unnecessarily.

---

## 7. Evidence Before Modification

Before modifying a system:

1. Locate the actual implementation.
2. Identify all related files.
3. Identify callers and dependencies.
4. Identify current tests.
5. Determine current behavior.
6. Reproduce the issue when possible.
7. Determine the root cause.

Do not patch based only on filenames, assumptions, comments, or old audit findings.

---

## 8. Fix Root Causes, Not Examples

Never solve architectural issues through one-off fixes such as:

- Hardcoded selectors
- Special handling for one imported page
- Element-specific hacks
- Repeated `if button`, `if heading`, `if image`
- Arbitrary timeouts
- Global DOM patches
- Duplicate responsive logic
- Duplicate state
- Duplicate serializers
- Silent fallbacks

If the same class of problem can happen elsewhere, fix the underlying abstraction.

---

## 9. Do Not Over-Engineer

Use the simplest reliable solution.

Do not introduce new systems such as:

- New state libraries
- Workers
- Virtualization
- Shadow DOM
- Complex event buses
- Large dependency packages
- New AST frameworks
- Additional iframe layers

unless measured evidence proves they are necessary.

Prefer extending the existing architecture.

---

## 10. Preserve Backward Compatibility

Before changing:

- Schema
- Serialization
- Element definitions
- Saved values
- Responsive data
- Components
- Imported data
- REST payloads

determine whether existing pages depend on the current format.

When data structure changes are necessary:

1. Add migration logic.
2. Keep old documents readable.
3. Add migration tests.
4. Verify save → reopen.
5. Never silently discard unknown data.

Existing user pages must remain usable.

---

## 11. Protect User Content

Never follow:

```text
Unsupported → Delete
```

Use:

```text
Supported
→ Native
```

```text
Partially supported
→ Hybrid
```

```text
Unsupported but safe
→ Preserved
```

```text
Unsafe
→ Restricted
```

User content must be preserved whenever technically and safely possible.

---

## 12. Security Is Always Active

Security is not a final phase.

Every implementation must consider:

- XSS
- unsafe HTML
- unsafe URLs
- SVG
- iframe content
- imported JavaScript
- PHP
- REST endpoints
- capabilities
- permissions
- file uploads
- external resources
- sanitization
- escaping

Imported JavaScript must never gain unintended control over the builder UI.

Arbitrary imported PHP must never execute inside the browser/editor.

Any confirmed serious security issue immediately becomes P0/P1.

---

## 13. Maintain Canvas Isolation

Imported and rendered page content must stay inside the intended editor canvas.

Do not allow imported content to affect:

- WordPress admin
- builder sidebar
- toolbar
- dialogs
- navigation
- editor overlays

Preserve the current isolated iframe architecture unless clear evidence proves it cannot satisfy a requirement.

Test dangerous CSS such as:

```css
html {}
body {}
* {}
:root {}
position: fixed;
position: sticky;
z-index: 2147483647;
width: 100vw;
height: 100vh;
```

---

## 14. Centralize Structural Mutations

All operations that change the element tree must eventually use the same authoritative tree-operation layer.

This includes:

- Drag
- Drop
- Move
- Duplicate
- Delete
- Paste
- Navigator reorder
- Component insertion
- Widget insertion
- Import insertion
- Wrap
- Unwrap

Never allow separate features to implement different structural rules.

Every completed tree mutation must preserve:

- Unique IDs
- Valid parent/child relationships
- Valid root
- No cycles
- No self-parenting
- No ancestor-to-descendant move
- Valid component boundaries
- Valid form structure

---

## 15. Per-Element Controls Must Come From Definitions

Do not build element controls using scattered UI conditions.

Use:

```text
Element Registry
→ Element Definition
→ Capabilities
→ Control Schema
→ Conditional Rules
→ Control Renderer
```

Every element must expose only controls relevant to that element.

For example:

- Spacer should not expose typography.
- Image should expose media-specific controls.
- Button should expose text/link/icon/button controls.
- Flex children should expose flex-item controls.
- Grid children should expose grid-item controls.

Keep control implementations centralized.

---

## 16. Test After Every Meaningful Task

After each completed task:

1. Run targeted tests for the changed system.
2. Run related regression tests.
3. Run lint where relevant.
4. Run build where relevant.
5. Verify no new console/runtime errors.
6. Confirm existing behavior was not broken.

Do not accumulate many untested changes.

---

## 17. Do Not Mark Work Complete Because Code Exists

A feature is complete only when:

- Implementation exists
- It is connected to the real UI/runtime
- The intended user flow works
- Error states work
- Data persists correctly
- Relevant tests pass
- Existing features still pass regression

Code presence alone is not completion.

---

## 18. Use Measurable Acceptance Criteria

Avoid:

> Drag and drop works.

Require:

> Dragging an element between two siblings shows the insertion indicator at the actual resulting index. Dropping performs one tree mutation, one history transaction, keeps the moved element selected, preserves valid parent/child relationships, and produces no console errors.

Every important task must have similarly testable acceptance criteria.

---

## 19. Preserve the Complete User Journey

The following journey is the primary release test:

1. Open builder.
2. Add container.
3. Add nested elements.
4. Edit content.
5. Style elements.
6. Apply responsive overrides.
7. Drag elements.
8. Reorder elements.
9. Duplicate.
10. Delete.
11. Undo.
12. Redo.
13. Import HTML/CSS/JS.
14. Edit supported imported content.
15. Save.
16. Refresh.
17. Reopen.
18. Confirm document is identical.
19. Preview.
20. Publish.
21. Inspect frontend.
22. Return to editor.
23. Continue editing.

A change must not break this workflow.

---

## 20. Refactor Behind Tests

Large architectural cleanup must happen only after adequate regression coverage exists.

For example, before decomposing `src/index.js`:

1. Establish E2E coverage.
2. Extract one responsibility.
3. Run tests.
4. Compare behavior.
5. Commit the stable result.
6. Continue with the next responsibility.

Do not rewrite the 9,000-line file in one operation.

---

## 21. Keep Changes Scoped

Each implementation step should solve one coherent problem.

Avoid mixing:

- Refactors
- New features
- Styling changes
- Schema migrations
- Security changes

inside the same change unless they are directly dependent.

Small verified changes are preferred over massive rewrites.

---

## 22. No Silent Failures

Errors involving:

- Save
- Autosave
- Import
- Migration
- Loading
- Publish
- Recovery
- REST requests

must never disappear silently.

Errors should be:

- Logged appropriately
- Presented clearly when user action is required
- Recoverable whenever possible

Transient background failures may remain non-modal but must eventually become visible if they persist.

---

## 23. Performance Must Be Measured

Do not optimize based on guesses.

Measure:

```text
50 elements
100 elements
500 elements
1000 elements
```

Measure:

- startup
- selection
- typing
- style updates
- responsive switching
- drag performance
- undo/redo
- save
- import
- memory

Only optimize verified bottlenecks.

---

## 24. Maintain a Task Status

As work progresses, maintain a simple status inside the implementation plan or project handoff:

```text
[ ] Not started
[~] In progress
[x] Complete
[!] Blocked
[-] Not required / already satisfied
```

For completed tasks, record:

- Main files changed
- Tests added/updated
- Verification result
- Important architectural decision
- Any remaining follow-up

Keep this short.

Do not rewrite the whole roadmap after each task.

---

## 25. Before Starting the Next Task

Confirm:

- Current task acceptance criteria pass.
- Tests pass.
- No new P0/P1 issue was introduced.
- No data format changed without migration.
- No duplicated implementation was created.
- No unresolved temporary hack remains.

Then continue.

---

# Session Continuation Rule

When a new AI session begins:

1. Read this rules section.
2. Read the implementation plan.
3. Inspect current Git status and recent commits.
4. Check the latest task status/handoff.
5. Verify the previous completed task if necessary.
6. Identify the highest-priority unfinished task whose dependencies are complete.
7. Continue from there.

Do not begin again from Phase 0 unless the baseline is no longer trustworthy.

---

# Stop and Reprioritize Rule

If implementation reveals a new issue involving:

- data corruption
- save/load failure
- security
- invalid serialization
- editor crash
- frontend crash
- canvas escape
- script escape
- migration failure

stop the lower-priority task.

Classify the newly discovered issue.

If it is P0/P1, fix or contain it before continuing.

---

# Handoff Rule

Create a handoff only when:

- The current session must end,
- Another AI will continue the work,
- No active task remains,
- Or the current AI is approaching its context/rate limit.

The handoff should contain only:

```text
Current phase/task:
Completed:
Files changed:
Tests/results:
Known issues:
Next exact task:
Important decisions/constraints:
```

Keep it concise.

Do not duplicate the entire roadmap.

---

# Final Completion Rule

The entire project plan is complete only when:

1. Every CRITICAL task is complete.
2. Every IMMEDIATE task is complete.
3. Every REQUIRED task needed for production is complete.
4. The full user-journey E2E test passes.
5. Build passes.
6. Lint passes.
7. Unit/integration tests pass.
8. PHP tests pass.
9. Migration tests pass.
10. Security verification passes.
11. Canvas/runtime isolation passes.
12. Save/recovery verification passes.
13. Browser/WordPress compatibility passes.
14. Performance budgets pass.
15. Production package contains only intended files.

RECOMMENDED, ADVANCED, and FUTURE tasks do not need to block the first stable production release unless implementation reveals a dependency.

---

# Core Execution Philosophy

Always follow:

```text
Inspect actual code
→ Verify current state
→ Find highest-priority gap
→ Check dependencies
→ Implement smallest correct solution
→ Test
→ Verify complete workflow
→ Record completion
→ Continue to next task
```

Never follow:

```text
Read roadmap
→ Assume findings are still true
→ Rewrite large systems
→ Add advanced features
→ Test everything at the end
```

The objective is not to implement the largest number of features.

The objective is to steadily transform the current builder into a:

**Reliable**  
**Functional**  
**Predictable**  
**Safe**  
**Maintainable**  
**Extensible**  
**Production-ready** builder

while preserving everything that already works.