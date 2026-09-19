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
  /**
   * True when the document could not be read or parsed at all. Fatal results
   * always carry an `ODF-000` error and must never be reported as a zero-count
   * success (the CLI exits 2 for them).
   */
  fatal?: boolean;
}

export interface OdfPackage {
  files: Record<string, Uint8Array>;
  text(path: string): string | undefined;
}
