# Cross-AI Handoff Protocol

You are one of several AI coding agents working on the same project. The user may switch between Codex, OpenCode, Antigravity, or another coding AI at any time.

Your goal is to make switching agents seamless.

## 1. Start of Every Session

Before making changes:

1. Check the latest project handoff in **MemPalace**.
2. If available, also read the project's **Obsidian `CURRENT.md`**.
3. Inspect the current repository/files when necessary.
4. Determine:
   - What was already completed
   - What is currently in progress
   - What remains unfinished
   - The exact next step

Do not restart completed work unless verification shows it is necessary.

MemPalace is the primary handoff/source of truth.

Obsidian `CURRENT.md` is the human-readable current-state summary and may be used as a secondary reference.

## 2. While Working

Keep track of:

- Files changed
- Important decisions
- Bugs discovered
- Fixes completed
- Tests performed
- Remaining problems
- Exact next actions

Do not create unnecessary long documentation during normal work.

## 3. Before Credit, Context, or Session Runs Out

IMPORTANT:

If you are approaching your credit limit, context limit, token limit, session limit, or otherwise may be unable to continue, STOP starting new major work.

Create a handoff before the session ends.

The handoff must be simple but detailed enough for another AI agent to continue immediately.

Use this format:

### HANDOFF

**Goal**
What we are currently trying to accomplish.

**Completed**
What has already been successfully implemented or verified.

**Current State**
Where the work currently stands.

**Files Changed**
List important files modified and briefly explain why.

**Pending**
What is still unfinished.

**Problems / Risks**
Known bugs, uncertainties, failed attempts, or things that must not be repeated.

**Next Step**
Give the exact first action the next AI agent should perform.

**Important Decisions**
Any architectural or implementation decisions the next AI must preserve.

**Verification**
Tests/checks already performed and what still needs testing.

### END HANDOFF

Save this handoff to **MemPalace**.

Then update/overwrite **Obsidian `CURRENT.md`** with the same current-state information if Obsidian access is available.

Do not append endless historical logs to `CURRENT.md`. It should represent only the latest project state.

## 4. When Taking Over From Another AI

When a handoff exists:

- Read it before coding.
- Trust completed work unless repository inspection contradicts it.
- Continue from the stated **Next Step**.
- Do not repeat research, debugging, or implementation already completed.
- Verify assumptions when necessary.
- Preserve important architectural decisions unless there is a strong technical reason to change them.

If the handoff and repository disagree, the actual repository state wins. Record the discrepancy in the next handoff.

## 5. Keep Handoffs Efficient

Handoffs should contain useful state, not conversation history.

Prioritize:

**what changed → where we stopped → what remains → exact next action**

The next AI should be able to read the handoff and continue working without asking the user to explain the project again.