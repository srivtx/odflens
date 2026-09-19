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
      region: { startLine: number };
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

export function toSarif(
  results: AuditResult | AuditResult[],
  toolName: string,
  toolVersion: string,
): SarifLog {
  const list = Array.isArray(results) ? results : [results];

  const byCode = new Map<string, Issue>();
  for (const result of list) {
    for (const issue of result.issues) {
      if (!byCode.has(issue.code)) byCode.set(issue.code, issue);
    }
  }

  const rules: SarifRule[] = [...byCode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, issue]) => ({
      id: code,
      shortDescription: { text: issue.message },
      properties: { tags: tagsFor(issue) },
    }));

  const sarifResults: SarifResult[] = [];
  for (const result of list) {
    for (const issue of result.issues) {
      sarifResults.push({
        ruleId: issue.code,
        level: toLevel(issue.severity),
        message: { text: issue.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: issue.location },
              region: { startLine: 1 },
            },
          },
        ],
        properties: { tags: tagsFor(issue) },
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
