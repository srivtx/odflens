import type { Severity } from "./types";

export interface RuleDefinition {
  code: string;
  severity: Severity;
  message: string;
  wcag?: string;
}

/**
 * The complete set of rules odflens can emit. The SARIF reporter always
 * advertises this catalog (not just the rules that happened to fire) so
 * downstream tools can show every available check.
 */
export const RULE_CATALOG: RuleDefinition[] = [
  {
    code: "ODF-000",
    severity: "error",
    message: "Package could not be opened or parsed (not a readable ODF file).",
  },
  {
    code: "ODF-LANG-001",
    severity: "error",
    message: "Document does not declare a language (dc:language or xml:lang / fo:language).",
    wcag: "3.1.1",
  },
  {
    code: "ODF-TITLE-002",
    severity: "error",
    message: "Document metadata has no non-empty dc:title.",
  },
  {
    code: "ODF-ALT-003",
    severity: "error",
    message: "Image or embedded object has no alternative text (svg:title or svg:desc).",
    wcag: "1.1.1",
  },
  {
    code: "ODF-HEAD-004",
    severity: "warning",
    message: "Heading outline levels skip a level (e.g. h1 followed by h3).",
    wcag: "1.3.1",
  },
  {
    code: "ODF-HEAD-005",
    severity: "warning",
    message: "Content contains paragraphs but no headings.",
    wcag: "1.3.1",
  },
  {
    code: "ODF-TBL-006",
    severity: "error",
    message: "Table has rows but no header rows (table:table-header-rows).",
    wcag: "1.3.1",
  },
  {
    code: "ODF-LINK-007",
    severity: "warning",
    message: "Link text is a raw URL; use descriptive link text instead.",
    wcag: "2.4.4",
  },
  {
    code: "ODF-IMG-008",
    severity: "info",
    message: "Image references a remote resource over http(s) (privacy/offline concern).",
    wcag: "1.1.1",
  },
];

const BY_CODE = new Map(RULE_CATALOG.map((rule) => [rule.code, rule]));

export function ruleDefinition(code: string): RuleDefinition | undefined {
  return BY_CODE.get(code);
}
