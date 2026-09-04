# Cross-AI Project Protocol

You are one of several coding agents working on this project. Continue work accurately across Codex, OpenCode, Antigravity, or other agents without repeating completed work or trusting stale assumptions.

## Before Coding

1. Read `AI_EXECUTION_RULES.md`.
2. Read only the relevant section of `IMPLEMENTATION_PLAN.md`.
3. Read the latest **MemPalace** handoff and, if available, Obsidian `CURRENT.md`.
4. Inspect the actual repository, recent changes, and relevant tests.
5. Determine what is complete, what remains, and the exact next task.

### Source of Truth

When sources conflict:

```text
Repository + verified runtime/tests
→ AI_EXECUTION_RULES.md
→ IMPLEMENTATION_PLAN.md
→ MemPalace / CURRENT.md
→ old audits/notes
```

The implementation plan is a roadmap, **not proof of current state**.

Before implementing any task, verify it still exists and is not already fixed. If code differs from the plan but correctly solves the problem, preserve it.

Never invent files, APIs, behavior, test results, or completed work. If something cannot be verified, mark it unverified rather than guessing.

## Working Rules

Follow the highest-priority unfinished **verified** task whose dependencies are complete.

For each task:

```text
Inspect → Verify problem → Find root cause → Implement smallest correct fix → Test → Continue
```

Do not:

- Redo completed work.
- Rebuild working systems without evidence.
- Apply speculative fixes.
- Use one-off hacks for architectural problems.
- Add advanced features while higher-priority core work remains.
- Treat code existence as proof that a feature works.
- Silently discard user data or unsupported safe content.

Current code and verified behavior override stale roadmap assumptions.

## Handoff Rule

Create a handoff **ONLY** when:

1. The user's entire active task is complete, or
2. A token/context/rate/runtime/session limit is approaching.

Otherwise, **KEEP WORKING**.

Completing a file, subtask, phase, or milestone does not require a handoff while the larger task remains active.

If a limit approaches, stabilize current work and leave the repository in a coherent state before handing off.

## Handoff Format

```text
### HANDOFF

Goal:
Completed:
Current State:
Files Changed:
Pending:
Problems/Risks:
Next Step:
Important Decisions:
Verification:

### END HANDOFF
```

Keep it concise: **what changed → current state → remaining work → exact next action**.

Save required handoffs to **MemPalace**. If available, overwrite Obsidian `CURRENT.md` with the same current state; do not append history.

## Taking Over

Read the handoff, then verify it against the repository before continuing.

If the handoff, roadmap, or old audit conflicts with the repository or reproducible test/runtime evidence, **verified current state wins**.

Continue from the stated next step only if it is still valid. Otherwise choose the highest-priority verified unfinished task.

## Core Rule

```text
Read rules/plan/handoff
→ Inspect repository
→ Verify reality
→ Execute highest-priority valid task
→ Test
→ Continue while work remains
→ Handoff only when finished or near a limit
```