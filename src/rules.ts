import { findAll, nodeText, parseXml } from "./odf";
import type { Issue, OdfPackage, Severity } from "./types";

function collectAttributes(node: any, name: string): string[] {
  const out: string[] = [];
  const walk = (n: any): void => {
    if (n === null || n === undefined) return;
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (typeof n !== "object") return;
    for (const key of Object.keys(n)) {
      if (key === name) {
        const value = n[key];
        if (Array.isArray(value)) out.push(...value.map(String));
        else if (value !== null && value !== undefined) out.push(String(value));
      } else {
        walk(n[key]);
      }
    }
  };
  walk(node);
  return out;
}

function parsePart(pkg: OdfPackage, path: string): any {
  const raw = pkg.text(path);
  if (raw === undefined) return undefined;
  return parseXml(raw);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runRules(
  pkg: OdfPackage,
  kind: "odt" | "ods" | "odp" | "odf" | string,
  location: string,
): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, severity: Severity, message: string, wcag?: string): void => {
    const issue: Issue = { code, severity, message, location };
    if (wcag !== undefined) issue.wcag = wcag;
    issues.push(issue);
  };

  let content: any;
  let styles: any;
  let meta: any;
  let settings: any;
  try {
    content = parsePart(pkg, "content.xml");
    styles = parsePart(pkg, "styles.xml");
    meta = parsePart(pkg, "meta.xml");
    settings = parsePart(pkg, "settings.xml");
  } catch (error) {
    // A documented part is present but malformed. Surface it as a fatal parse
    // failure instead of silently degrading into misleading language/title
    // findings against an empty DOM.
    push("ODF-000", "error", `Could not parse document XML: ${errorMessage(error)}`);
    return issues.sort((a, b) => a.code.localeCompare(b.code));
  }

  // Any unexpected rule failure is surfaced as an ODF-000 error rather than
  // being swallowed.
  const rule = (name: string, fn: () => void): void => {
    try {
      fn();
    } catch (error) {
      push("ODF-000", "error", `Rule ${name} failed: ${errorMessage(error)}`);
    }
  };

  const isText = kind === "odt";

  rule("ODF-LANG-001", () => {
    // Standard ODF language signals: xml:lang (anywhere), fo:language
    // (styles), and dc:language (metadata). `office:language` is not a
    // standard attribute and is intentionally ignored.
    const values = [
      ...collectAttributes(content, "@_xml:lang"),
      ...collectAttributes(styles, "@_xml:lang"),
      ...collectAttributes(settings, "@_xml:lang"),
      ...collectAttributes(content, "@_fo:language"),
      ...collectAttributes(styles, "@_fo:language"),
      ...collectAttributes(settings, "@_fo:language"),
      ...findAll(meta, ["dc:language"]).map(nodeText),
      ...findAll(content, ["dc:language"]).map(nodeText),
      ...findAll(styles, ["dc:language"]).map(nodeText),
      ...findAll(settings, ["dc:language"]).map(nodeText),
    ];
    if (!values.some((value) => value.trim() !== "")) {
      push(
        "ODF-LANG-001",
        "error",
        "Document does not declare a language (dc:language or xml:lang / fo:language).",
        "3.1.1",
      );
    }
  });

  rule("ODF-TITLE-002", () => {
    const titles = meta ? findAll(meta, ["dc:title"]) : [];
    if (!titles.some((title) => nodeText(title).length > 0)) {
      push("ODF-TITLE-002", "error", "Document metadata has no non-empty dc:title.");
    }
  });

  rule("ODF-ALT-003", () => {
    const frames = content ? findAll(content, ["draw:frame"]) : [];
    const framedImages = new Set<any>();
    for (const frame of frames) {
      // Only frames that actually embed an image/object/plugin need alt text.
      // A frame wrapping a plain text box (e.g. a slide title) is not an image
      // and must not be reported as one.
      const embedded = findAll(frame, ["draw:image", "draw:object", "draw:plugin"]);
      for (const image of findAll(frame, ["draw:image"])) framedImages.add(image);
      if (embedded.length === 0) continue;
      const alt = findAll(frame, ["title", "desc"]);
      if (!alt.some((node) => nodeText(node).length > 0)) {
        push(
          "ODF-ALT-003",
          "error",
          "Image frame has no alternative text (svg:title or svg:desc).",
          "1.1.1",
        );
      }
    }
    const images = content ? findAll(content, ["draw:image"]) : [];
    for (const image of images) {
      if (framedImages.has(image)) continue;
      const alt = findAll(image, ["title", "desc"]);
      if (!alt.some((node) => nodeText(node).length > 0)) {
        push(
          "ODF-ALT-003",
          "error",
          "Image has no alternative text (svg:title or svg:desc).",
          "1.1.1",
        );
      }
    }
  });

  // Heading outline and paragraph rules only make sense for text documents.
  // Spreadsheets and presentations have no heading outline to skip.
  if (isText) {
    rule("ODF-HEAD-004", () => {
      const headings = content ? findAll(content, ["text:h"]) : [];
      const levels: number[] = [];
      for (const heading of headings) {
        const raw = heading?.["@_text:outline-level"];
        const level = Number(raw);
        if (Number.isFinite(level) && level > 0) levels.push(level);
      }
      let skipped = false;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i]! - levels[i - 1]! > 1) {
          skipped = true;
          break;
        }
      }
      if (skipped) {
        push(
          "ODF-HEAD-004",
          "warning",
          "Heading outline levels skip a level (e.g. h1 followed by h3).",
          "1.3.1",
        );
      }
    });

    rule("ODF-HEAD-005", () => {
      const headings = content ? findAll(content, ["text:h"]) : [];
      const paragraphs = content ? findAll(content, ["text:p"]) : [];
      const hasParagraphText = paragraphs.some((p) => nodeText(p).length > 0);
      if (hasParagraphText && headings.length === 0) {
        push(
          "ODF-HEAD-005",
          "warning",
          "Content contains paragraphs but no headings.",
          "1.3.1",
        );
      }
    });
  }

  // table:table-header-rows is the ODF text-document mechanism for a table
  // header. Spreadsheet rows are frequently unmarked, so requiring the marker
  // in ODS/ODP produces false positives; those formats are not checked here.
  if (isText) {
    rule("ODF-TBL-006", () => {
      const tables = content ? findAll(content, ["table:table"]) : [];
      for (const table of tables) {
        const rows = findAll(table, ["table:table-row"]);
        const headerRows = findAll(table, ["table:table-header-rows"]);
        if (rows.length > 0 && headerRows.length === 0) {
          push(
            "ODF-TBL-006",
            "error",
            "Table has rows but no header rows (table:table-header-rows).",
            "1.3.1",
          );
        }
      }
    });
  }

  rule("ODF-LINK-007", () => {
    const links = content ? findAll(content, ["text:a"]) : [];
    const rawLinks = links.filter((link) => /^https?:\/\//.test(nodeText(link)));
    if (rawLinks.length > 0) {
      push(
        "ODF-LINK-007",
        "warning",
        "Link text is a raw URL; use descriptive link text instead.",
        "2.4.4",
      );
    }
  });

  rule("ODF-IMG-008", () => {
    const images = content ? findAll(content, ["draw:image"]) : [];
    const external = images.filter((image) => {
      const href = image?.["@_xlink:href"];
      return typeof href === "string" && /^https?:\/\//.test(href);
    });
    if (external.length > 0) {
      push(
        "ODF-IMG-008",
        "info",
        "Image references a remote resource over http(s) (privacy/offline concern).",
        "1.1.1",
      );
    }
  });

  return issues.sort((a, b) => a.code.localeCompare(b.code));
}
