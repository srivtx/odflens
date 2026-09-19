export type Severity = "error" | "warning" | "info";

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  location: string;
  wcag?: string;
}

export interface AuditResult {
  file: string;
  kind: "odt" | "ods" | "odp" | "odf";
  issues: Issue[];
  counts: Record<Severity, number>;
}

export interface OdfPackage {
  files: Record<string, Uint8Array>;
  text(path: string): string | undefined;
}
