# SHARED AI DEVELOPMENT & CONTINUITY RULES

These instructions are shared between OpenCode and Antigravity.

The same repository/workspace may be modified by either AI agent at different times.

The primary objective is seamless work continuity between agents without requiring the user to explain previous work again.

---

# 1. SOURCE OF TRUTH

The current workspace filesystem is the primary source of truth.

Use sources in this priority order:

1. The user's latest instruction
2. Current files in the workspace
3. Current Git state, diff, and recent commits when Git is available
4. `.ai/HANDOFF.md`
5. Shared Memory Palace / persistent project memory
6. Existing project documentation
7. Previous assumptions

Never assume previous conversational context is still accurate when the files show otherwise.

Never overwrite current work merely because Memory Palace or HANDOFF.md contains older information.

---

# 2. CONTINUATION COMMAND

The user may give a very short instruction such as:

- "continue where Antigravity left"
- "continue where OpenCode left"
- "continue where opencode left"
- "continue where antigravity left"
- "continue"
- "continue the previous work"

Treat these commands as a request to automatically reconstruct the current task and resume implementation.

DO NOT ask the user to repeat:
- the original request
- the previous prompt
- what files were changed
- what the previous agent was doing

unless the required information genuinely cannot be recovered from the workspace, HANDOFF.md, Git, or shared memory.

When a continuation command is received, perform the Resume Protocol below.

---

# 3. RESUME PROTOCOL

Before making changes:

1. Read `.ai/HANDOFF.md`.
2. Inspect the current workspace.
3. If Git is available, inspect:
   - git status
   - git diff
   - staged changes
   - relevant recent commits when useful
4. Inspect the files listed in HANDOFF.md.
5. Confirm that HANDOFF.md still matches the actual filesystem.
6. Query shared Memory Palace only when additional historical context, requirements, decisions, or reasoning are needed.
7. Determine:
   - what has already been completed
   - what is currently partially implemented
   - what remains
   - what should happen next
8. Continue from the next logical unfinished step.

Do not restart the task from the beginning.

Do not repeat completed work.

Do not recreate files that already exist unless they actually require modification.

Do not revert another agent's changes just because you would have implemented them differently.

Preserve working implementations unless there is a concrete reason to change them.

---

# 4. HANDOFF FILE

`.ai/HANDOFF.md` is the shared live continuity record between OpenCode and Antigravity.

Maintain it throughout development.

Do NOT wait until the entire task is finished before updating it.

Update HANDOFF.md after meaningful checkpoints so another agent can continue if the current model hits a usage, token, quota, context, crash, or session limit unexpectedly.

At minimum update it after:

- completing a significant feature
- modifying several related files
- making an important architectural decision
- discovering an important bug or limitation
- finishing a test/debugging stage
- changing the planned implementation
- before performing a large or risky operation
- before ending work
- when you suspect available context or quota may be running low

Keep it concise but sufficient for another competent coding agent to resume immediately.

---

# 5. HANDOFF CONTENT

HANDOFF.md should always describe the CURRENT project state.

Include:

## Current Task
The task currently being implemented.

## Original Goal
Short description of what the user ultimately wants.

## Last Agent
OpenCode or Antigravity when known.

## Status
One of:
- Planning
- In Progress
- Testing
- Blocked
- Completed

## Completed
Specific work already finished.

## In Progress
What was actively being worked on.

## Next Steps
Exact logical next actions in priority order.

## Files Changed
List important files created or modified and what changed.

## Important Decisions
Architectural, UI, API, dependency, implementation, or user decisions that must be preserved.

## Verification
Tests, builds, linting, browser checks, Playwright checks, or manual verification already performed.

## Known Issues
Remaining bugs, incomplete areas, warnings, or technical debt relevant to the current task.

## Do Not Redo
Anything already verified or completed that the next agent should not repeat unnecessarily.

---

# 6. FILE SAFETY

Assume files may contain unsaved or uncommitted work created by another agent or by the user.

Never:

- run destructive resets
- discard uncommitted changes
- restore files wholesale
- delete unfamiliar files
- rewrite major sections unnecessarily

without determining why those changes exist.

If Git is available, always inspect the diff before making potentially conflicting changes.

Modify the smallest reasonable scope required to complete the task.

---

# 7. SHARED MEMORY PALACE

OpenCode and Antigravity have access to the same persistent Memory Palace.

Use Memory Palace for durable knowledge such as:

- user requirements
- project architecture
- previous technical decisions
- design requirements
- known problems
- conventions
- completed milestones
- reasons behind non-obvious decisions

Do NOT use Memory Palace as a replacement for checking the current workspace.

Filesystem state always wins when memory conflicts with current implementation.

When an important long-term project decision is made, store it in shared memory when appropriate.

Avoid filling memory with temporary debugging details that belong only in HANDOFF.md.

---

# 8. CONTEXT7

Use Context7 when current or exact library/framework/API documentation is required.

Especially use it when:

- implementing unfamiliar APIs
- library behavior may depend on version
- framework syntax may have changed
- debugging dependency-specific behavior
- choosing between deprecated and current approaches

Do not guess library APIs when Context7 can verify them.

---

# 9. PLAYWRIGHT

Use Playwright when browser verification materially improves confidence.

For frontend or website tasks, use Playwright when appropriate to verify:

- responsive layouts
- desktop/tablet/mobile behavior
- navigation
- links
- forms
- modals
- interactions
- JavaScript behavior
- visual regressions
- console errors
- overflow
- broken elements

Do not claim UI work is fully verified when browser verification was required but never performed.

---

# 10. EXISTING PROJECT CONVENTIONS

Before introducing a new pattern, inspect the existing codebase.

Follow existing conventions for:

- architecture
- naming
- formatting
- components
- CSS methodology
- directory organization
- frameworks
- package management
- linting
- testing
- deployment

Prefer consistency with the current project over introducing unnecessary new abstractions.

---

# 11. DO NOT OVER-ENGINEER

When continuing another agent's implementation:

Prefer finishing the existing reasonable approach rather than replacing it with a completely different architecture.

Refactor only when there is a concrete benefit such as:

- fixing a bug
- preventing duplication
- improving maintainability
- satisfying requirements
- improving performance
- correcting an architectural problem

Do not refactor simply because another implementation style is preferred.

---

# 12. TEST BEFORE DECLARING COMPLETION

Before saying a task is complete:

1. Review the relevant diff.
2. Check for obvious regressions.
3. Run applicable tests/build/lint.
4. Perform browser/Playwright verification when relevant.
5. Confirm the user's actual requirement has been satisfied.
6. Update HANDOFF.md.

If something could not be verified, state that clearly.

---

# 13. WHEN THE TASK IS COMPLETED

When everything is finished:

Update HANDOFF.md with:

Status: Completed

Document:

- what was completed
- important files changed
- verification performed
- any optional improvements that remain

Do not leave HANDOFF.md describing obsolete "In Progress" work.

---

# 14. WHEN A NEW TASK REPLACES THE OLD TASK

The user's latest explicit request always takes priority.

If the user starts a completely different task:

1. Do not automatically continue the previous HANDOFF task.
2. Update HANDOFF.md for the new active task.
3. Preserve historically important decisions in Memory Palace where appropriate.

---

# 15. COMMUNICATION

Do not burden the user with internal handoff mechanics.

When the user says:

"continue where Antigravity left"

or

"continue where OpenCode left"

a suitable response is simply a concise acknowledgement such as:

"Continuing from the existing project state."

Then inspect the shared state and resume the work.

Do not ask for information that can be discovered yourself.

When useful, briefly mention what you determined was the next unfinished step, then proceed.

---

# 16. CORE CONTINUITY PRINCIPLE

OpenCode and Antigravity must behave as two interfaces controlling the same ongoing engineering project rather than as two unrelated developers.

Every meaningful change should leave enough evidence in:

- the filesystem
- Git when available
- `.ai/HANDOFF.md`
- Memory Palace when appropriate

for the other agent to safely continue without depending on private conversation history.
