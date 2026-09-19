import { strFromU8, unzipSync } from "fflate";
import type { UnzipFileInfo } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { OdfPackage } from "./types";

export interface OdfLimits {
  /** Maximum uncompressed size of a single zip entry, in bytes. */
  maxEntryBytes: number;
  /** Maximum combined uncompressed size of all entries, in bytes. */
  maxTotalBytes: number;
}

export const DEFAULT_LIMITS: OdfLimits = {
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

export function openOdf(data: Uint8Array, limits: OdfLimits = DEFAULT_LIMITS): OdfPackage {
  if (!(data instanceof Uint8Array) || data.length === 0) {
    throw new Error("Package is empty (0 bytes).");
  }

  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter(file: UnzipFileInfo): boolean {
        if (file.originalSize > limits.maxEntryBytes) {
          throw new Error(
            `Zip entry "${file.name}" is ${formatBytes(file.originalSize)}, over the ` +
              `${formatBytes(limits.maxEntryBytes)} per-entry limit.`,
          );
        }
        total += file.originalSize;
        if (total > limits.maxTotalBytes) {
          throw new Error(
            `Uncompressed package is over the ${formatBytes(limits.maxTotalBytes)} total limit.`,
          );
        }
        return true;
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read zip archive: ${message}`);
  }

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
  const validated = XMLValidator.validate(text);
  if (validated !== true) {
    const err = validated.err;
    const detail = err ? `${err.msg} (line ${err.line}, col ${err.col})` : "unknown error";
    throw new Error(`Malformed XML: ${detail}`);
  }
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
