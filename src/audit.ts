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

function fatal(file: string, kind: AuditResult["kind"], message: string): AuditResult {
  const issue: Issue = { code: "ODF-000", severity: "error", message, location: file };
  return { file, kind, issues: [issue], counts: countIssues([issue]), fatal: true };
}

export function audit(data: Uint8Array, file = "document.odt"): AuditResult {
  let pkg;
  try {
    pkg = openOdf(data);
  } catch (error) {
    return fatal(file, "odf", `Could not open ODF package: ${errorMessage(error)}`);
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
    return fatal(file, kind, "Package does not contain content.xml.");
  }

  let issues: Issue[] = [];
  try {
    issues = runRules(pkg, kind, file);
  } catch (error) {
    return fatal(file, kind, `Could not evaluate rules: ${errorMessage(error)}`);
  }

  const fatalResult = issues.some((issue) => issue.code === "ODF-000");
  return {
    file,
    kind,
    issues,
    counts: countIssues(issues),
    ...(fatalResult ? { fatal: true } : {}),
  };
}
