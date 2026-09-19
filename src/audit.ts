import { detectKind, openOdf } from "./odf";
import { runRules } from "./rules";
import type { AuditResult, Issue, Severity } from "./types";

function countIssues(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity]++;
  return counts;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function audit(data: Uint8Array, file = "document.odt"): AuditResult {
  let pkg;
  try {
    pkg = openOdf(data);
  } catch (error) {
    const issue: Issue = {
      code: "ODF-000",
      severity: "info",
      message: `Could not open ODF package: ${errorMessage(error)}`,
      location: file,
    };
    return { file, kind: "odf", issues: [issue], counts: countIssues([issue]) };
  }

  let kind: AuditResult["kind"] = "odf";
  try {
    kind = detectKind(pkg, file);
  } catch {
    kind = "odf";
  }

  let content: string | undefined;
  try {
    content = pkg.text("content.xml");
  } catch {
    content = undefined;
  }

  if (content === undefined) {
    const issue: Issue = {
      code: "ODF-000",
      severity: "info",
      message: "Package does not contain content.xml.",
      location: file,
    };
    return { file, kind, issues: [issue], counts: countIssues([issue]) };
  }

  let issues: Issue[] = [];
  try {
    issues = runRules(pkg, kind, file);
  } catch (error) {
    const issue: Issue = {
      code: "ODF-000",
      severity: "info",
      message: `Could not evaluate rules: ${errorMessage(error)}`,
      location: file,
    };
    issues = [issue];
  }

  return { file, kind, issues, counts: countIssues(issues) };
}
