import type { AuditResult } from "./types";

export function formatText(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(`${result.file} (${result.kind})`);
  if (result.issues.length === 0) {
    lines.push("No issues found.");
  } else {
    for (const issue of result.issues) {
      const wcag = issue.wcag ? ` [WCAG ${issue.wcag}]` : "";
      lines.push(
        `${issue.severity.toUpperCase()} ${issue.code}${wcag}: ${issue.message} (${issue.location})`,
      );
    }
  }
  lines.push(
    `Totals: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
  );
  return lines.join("\n");
}

export function formatJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
