import { RULE_CATALOG, ruleDefinition } from "./catalog";
import type { AuditResult, Issue, Severity } from "./types";

export type SarifLevel = "error" | "warning" | "note";

export interface SarifRule {
  id: string;
  shortDescription: { text: string };
  properties: { tags: string[] };
}

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
    };
  }>;
  properties: { tags: string[] };
}

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }>;
}

export const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
export const SARIF_INFORMATION_URI = "https://github.com/srivtx/odflens";

function toLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
  }
}

function tagsFor(issue: Issue): string[] {
  const tags = ["accessibility"];
  if (issue.wcag !== undefined && issue.wcag !== "") {
    tags.push(`wcag-${issue.wcag}`);
  }
  return tags;
}

/**
 * The text has no line/column information (ODF rules operate on the document
 * model, not on source lines), so results point at the artifact only. A fake
 * `startLine: 1` region is intentionally omitted.
 */
function artifactLocation(uri: string): SarifResult["locations"] {
  return [
    {
      physicalLocation: {
        artifactLocation: { uri: encodeURI(uri) },
      },
    },
  ];
}

export function toSarif(
  results: AuditResult | AuditResult[],
  toolName: string,
  toolVersion: string,
): SarifLog {
  const list = Array.isArray(results) ? results : [results];

  const observed = new Map<string, Issue>();
  for (const result of list) {
    for (const issue of result.issues) {
      if (!observed.has(issue.code)) observed.set(issue.code, issue);
    }
  }

  const rules: SarifRule[] = [];
  const seen = new Set<string>();
  // Always advertise the full catalog, then append any rule that fired but is
  // not (yet) catalogued so no result points at a missing rule.
  for (const definition of RULE_CATALOG) {
    rules.push({
      id: definition.code,
      shortDescription: { text: definition.message },
      properties: { tags: tagsFor({ ...definition, location: "" }) },
    });
    seen.add(definition.code);
  }
  for (const [code, issue] of observed) {
    if (seen.has(code)) continue;
    rules.push({
      id: code,
      shortDescription: { text: issue.message },
      properties: { tags: tagsFor(issue) },
    });
  }
  rules.sort((a, b) => a.id.localeCompare(b.id));

  const sarifResults: SarifResult[] = [];
  for (const result of list) {
    for (const issue of result.issues) {
      const definition = ruleDefinition(issue.code);
      sarifResults.push({
        ruleId: issue.code,
        level: toLevel(issue.severity),
        message: { text: issue.message },
        locations: artifactLocation(issue.location),
        properties: {
          tags: definition ? tagsFor({ ...definition, location: issue.location }) : tagsFor(issue),
        },
      });
    }
  }

  return {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: toolVersion,
            informationUri: SARIF_INFORMATION_URI,
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };
}

export async function writeSarif(
  path: string,
  results: AuditResult | AuditResult[],
  toolName: string,
  toolVersion: string,
): Promise<void> {
  const sarif = toSarif(results, toolName, toolVersion);
  await Bun.write(path, `${JSON.stringify(sarif, null, 2)}\n`);
}
