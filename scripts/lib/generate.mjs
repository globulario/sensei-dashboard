// Shared type-generation logic used by both scripts/generate-types.mjs (the
// CLI/CI entry point) and test/generated-types.test.mjs (the drift check).

import { compile } from "json-schema-to-typescript";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./pin.mjs";

export const docsDir = path.join(repoRoot, "docs");
export const outDir = path.join(repoRoot, "contract", "generated");

export const targets = [
  {
    schemaFile: "dashboard-projection-v1.schema.json",
    rootTypeName: "DashboardProjectionV1",
    outFile: "dashboard-projection-v1.ts",
  },
  {
    schemaFile: "agent-handoff-v1.schema.json",
    rootTypeName: "AgentHandoffV1",
    outFile: "agent-handoff-v1.ts",
  },
  // Workspace O1 (docs/claude-workspace-o1-brief.md) — Dashboard/runner-owned
  // contracts, locally authored and versioned, not sourced from
  // globulario/sensei (see contract/workspace/contracts.json's
  // pinning_rule: "local" for each). Generation itself has no dependency on
  // contract/pin.json's external-parity semantics, so these are ordinary
  // additional targets, not a special case.
  {
    schemaFile: "workspace-architect-session-v1.schema.json",
    rootTypeName: "WorkspaceArchitectSessionV1",
    outFile: "workspace-architect-session-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-agent-run-v1.schema.json",
    rootTypeName: "WorkspaceAgentRunV1",
    outFile: "workspace-agent-run-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-execution-receipt-v1.schema.json",
    rootTypeName: "WorkspaceExecutionReceiptV1",
    outFile: "workspace-execution-receipt-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-provider-capabilities-v1.schema.json",
    rootTypeName: "WorkspaceProviderCapabilitiesV1",
    outFile: "workspace-provider-capabilities-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-provider-status-v1.schema.json",
    rootTypeName: "WorkspaceProviderStatusV1",
    outFile: "workspace-provider-status-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-provider-event-v1.schema.json",
    rootTypeName: "WorkspaceProviderEventV1",
    outFile: "workspace-provider-event-v1.ts",
    local: true,
  },
  {
    schemaFile: "workspace-github-action-v1.schema.json",
    rootTypeName: "WorkspaceGithubActionV1",
    outFile: "workspace-github-action-v1.ts",
    local: true,
  },
  // Workspace O1 Sensei pin/parity closure
  // (docs/claude-workspace-o1-sensei-pin-parity-brief.md) — Sensei-core-owned
  // canonical contracts, pinned byte-for-byte from globulario/sensei via
  // contract/workspace/sensei-pin.json (a second, independent producer-
  // consumer manifest from contract/pin.json's — see that file's own
  // $comment for why the two are never merged).
  {
    schemaFile: "workspace-identity-v1.schema.json",
    rootTypeName: "SenseiWorkspaceIdentityV1",
    outFile: "workspace-identity-v1.ts",
    workspacePinned: true,
  },
  {
    schemaFile: "workspace-admission-v1.schema.json",
    rootTypeName: "SenseiWorkspaceAdmissionV1",
    outFile: "workspace-admission-v1.ts",
    workspacePinned: true,
  },
];

export function banner(schemaFile, { local = false, workspacePinned = false } = {}) {
  const provenance = local
    ? `${schemaFile} (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei)`
    : workspacePinned
      ? `the pinned canonical schema
 * ${schemaFile} (see contract/workspace/sensei-pin.json for the exact
 * Sensei source commit and digest)`
      : `the pinned canonical schema
 * ${schemaFile} (see contract/pin.json for the exact Sensei source commit
 * and digest)`;
  return `/* eslint-disable */
/**
 * This file was automatically generated from ${provenance}. Do not edit
 * this file directly — run \`npm run generate:types\` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

`;
}

/** Returns { outFile, contents } for every target, without writing anything. */
export async function generateAll() {
  const results = [];
  for (const target of targets) {
    const schemaPath = path.join(docsDir, target.schemaFile);
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));

    const ts = await compile(schema, target.rootTypeName, {
      cwd: docsDir,
      bannerComment: "",
      declareExternallyReferenced: true,
      enableConstEnums: true,
      style: { singleQuote: false },
      additionalProperties: false,
      unreachableDefinitions: true,
      $refOptions: { resolve: { http: false } },
    });

    results.push({
      outFile: target.outFile,
      contents: banner(target.schemaFile, { local: target.local, workspacePinned: target.workspacePinned }) + ts,
    });
  }
  return results;
}
