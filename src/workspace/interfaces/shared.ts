// Shared pure types for the Workspace O1 interface layer
// (docs/claude-workspace-o1-brief.md §7). This layer defines no
// orchestration behavior (Law B): no process spawning, PTY lifecycle, shell
// command construction, provider detection, authentication flows, token/
// credential storage, local IPC, worktree creation, MCP process management,
// GitHub API execution, agent invocation, or retry/lease/queue/recovery
// engines. It is a pure contract boundary a future O2+ runner implements
// against -- no implementation classes live in this directory.

/**
 * Represents cancellation without implementing any cancellation lifecycle.
 * Deliberately shaped like (but not importing) the ambient AbortSignal
 * type, so this interface layer makes no assumption about which runtime
 * (browser Tauri webview, Node sensei-runner process, or a test double)
 * eventually supplies it.
 */
export interface CancellationSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
}

/**
 * A typed refusal -- never a bare thrown Error, and never a raw
 * provider-native error object leaking through this boundary. Mirrors the
 * {code, detail} shape already used across the workspace JSON Schema family
 * (e.g. docs/workspace-agent-run-v1.schema.json's local "reason" $def),
 * itself modeled on Sensei's real admission.Reason{Code,Detail}.
 */
export interface TypedRefusal {
  readonly code: string;
  readonly detail: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: TypedRefusal };
