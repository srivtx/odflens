import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { OdfPackage } from "./types";

export function openOdf(data: Uint8Array): OdfPackage {
  const files = unzipSync(data);
  return {
    files,
    text(path: string): string | undefined {
      const raw = files[path];
      if (raw === undefined) return undefined;
      return strFromU8(raw);
    },
  };
}

export function detectKind(pkg: OdfPackage, file?: string): "odt" | "ods" | "odp" | "odf" {
  const mimetype = (pkg.text("mimetype") ?? "").trim();
  if (mimetype.includes("application/vnd.oasis.opendocument.text")) return "odt";
  if (mimetype.includes("application/vnd.oasis.opendocument.spreadsheet")) return "ods";
  if (mimetype.includes("application/vnd.oasis.opendocument.presentation")) return "odp";

  const content = pkg.text("content.xml");
  if (content) {
    if (/<office:text[\s>/]/.test(content)) return "odt";
    if (/<office:spreadsheet[\s>/]/.test(content)) return "ods";
    if (/<office:presentation[\s>/]/.test(content)) return "odp";
  }

  const ext = (file ?? "").toLowerCase();
  if (ext.endsWith(".odt")) return "odt";
  if (ext.endsWith(".ods")) return "ods";
  if (ext.endsWith(".odp")) return "odp";
  return "odf";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: false,
});

export function parseXml(text: string): any {
  return parser.parse(text);
}

function keyMatches(key: string, names: string[]): boolean {
  for (const name of names) {
    if (key === name) return true;
    const colon = key.indexOf(":");
    if (colon >= 0 && key.slice(colon + 1) === name) return true;
  }
  return false;
}

export function findAll(node: any, names: string[]): any[] {
  const out: any[] = [];
  const walk = (n: any): void => {
    if (n === null || n === undefined) return;
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (typeof n !== "object") return;
    for (const key of Object.keys(n)) {
      const value = n[key];
      if (keyMatches(key, names)) {
        if (Array.isArray(value)) out.push(...value);
        else out.push(value);
      }
      walk(value);
    }
  };
  walk(node);
  return out;
}

export function nodeText(node: any): string {
  const parts: string[] = [];
  const walk = (n: any): void => {
    if (n === null || n === undefined) return;
    if (typeof n === "string") {
      parts.push(n);
      return;
    }
    if (typeof n === "number" || typeof n === "boolean") {
      parts.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (typeof n === "object") {
      for (const key of Object.keys(n)) {
        if (key.startsWith("@_")) continue;
        walk(n[key]);
      }
    }
  };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
