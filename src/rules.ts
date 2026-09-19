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

export function runRules(pkg: OdfPackage, kind: string, location: string): Issue[] {
  void kind;
  const issues: Issue[] = [];
  const push = (code: string, severity: Severity, message: string, wcag?: string): void => {
    const issue: Issue = { code, severity, message, location };
    if (wcag !== undefined) issue.wcag = wcag;
    issues.push(issue);
  };

  let content: any;
  let styles: any;
  let meta: any;
  try {
    const raw = pkg.text("content.xml");
    content = raw === undefined ? undefined : parseXml(raw);
  } catch {
    content = undefined;
  }
  try {
    const raw = pkg.text("styles.xml");
    styles = raw === undefined ? undefined : parseXml(raw);
  } catch {
    styles = undefined;
  }
  try {
    const raw = pkg.text("meta.xml");
    meta = raw === undefined ? undefined : parseXml(raw);
  } catch {
    meta = undefined;
  }

  try {
    const languages = [
      ...collectAttributes(content, "@_office:language"),
      ...collectAttributes(content, "@_fo:language"),
      ...collectAttributes(styles, "@_office:language"),
      ...collectAttributes(styles, "@_fo:language"),
    ];
    if (!languages.some((value) => value.trim() !== "")) {
      push(
        "ODF-LANG-001",
        "error",
        "Document does not declare a language (office:language / fo:language).",
        "3.1.1",
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const titles = meta ? findAll(meta, ["dc:title"]) : [];
    if (!titles.some((title) => nodeText(title).length > 0)) {
      push("ODF-TITLE-002", "error", "Document metadata has no non-empty dc:title.");
    }
  } catch {
    /* ignore */
  }

  try {
    const frames = content ? findAll(content, ["draw:frame"]) : [];
    const framedImages = new Set<any>();
    for (const frame of frames) {
      for (const image of findAll(frame, ["draw:image"])) framedImages.add(image);
      const alt = [...findAll(frame, ["title", "desc"])];
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
      const alt = [...findAll(image, ["title", "desc"])];
      if (!alt.some((node) => nodeText(node).length > 0)) {
        push(
          "ODF-ALT-003",
          "error",
          "Image has no alternative text (svg:title or svg:desc).",
          "1.1.1",
        );
      }
    }
  } catch {
    /* ignore */
  }

  try {
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
  } catch {
    /* ignore */
  }

  try {
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
  } catch {
    /* ignore */
  }

  try {
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
  } catch {
    /* ignore */
  }

  try {
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
  } catch {
    /* ignore */
  }

  return issues.sort((a, b) => a.code.localeCompare(b.code));
}
