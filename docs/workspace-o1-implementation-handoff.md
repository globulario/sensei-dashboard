# Workspace O1 implementation handoff

**State:** IMPLEMENTATION REQUIRED  
**Architect contract:** `docs/architecture-workspace-v1.md`  
**Accepted architecture-contract source head:** `2a019dc517f12a0984a1d2699408ce97f529a267`  
**Implementation brief:** `docs/claude-workspace-o1-brief.md`  
**Accepted brief source head:** `968fdc02b4f13f3b83ffbdd99ec1186d8466cf09`  
**Target branch:** `feat/workspace-o1-governing-contracts`

Implement only Phase O1 governing contracts. Preserve the authority split: Sensei core owns workspace identity and admission; this repository owns local orchestration records and pure interfaces.

The implementation must follow every stop condition, non-goal, verification requirement, and exact-SHA handoff rule in the accepted brief. No O2 runner, provider process, authentication, worktree, IPC, MCP lifecycle, GitHub mutation, Tauri, or workspace UI work is authorized.

When a required Sensei-owned field or contract is absent or semantically ambiguous, post `ARCHITECT QUESTION` and stop that portion rather than creating a Dashboard-local substitute.

This file is only the implementation relay anchor. Remove it before final architectural acceptance unless it remains useful as durable documentation.