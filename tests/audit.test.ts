/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { audit } from "../src/audit";
import { DEFAULT_LIMITS, openOdf } from "../src/odf";

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/"';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const MIME_ODT = "application/vnd.oasis.opendocument.text";

function packageWith(parts: Record<string, string | Uint8Array>): Uint8Array {
  const out: Record<string, Uint8Array> = {
    mimetype: strToU8(MIME_ODT),
  };
  for (const [path, data] of Object.entries(parts)) {
    out[path] = typeof data === "string" ? strToU8(data) : data;
  }
  return zipSync(out);
}

const BODY = "<office:body><office:text><text:p>Body.</text:p></office:text></office:body>";

function content(extra = ""): string {
  return `${XML_HEADER}<office:document-content ${NS} ${extra} office:version="1.2">${BODY}</office:document-content>`;
}

function meta(extra = ""): string {
  return (
    `${XML_HEADER}<office:document-meta ${NS} office:version="1.2">` +
    `<office:meta><dc:title>Title</dc:title>${extra}</office:meta></office:document-meta>`
  );
}

describe("P0-1: unreadable documents are fatal", () => {
  test("a non-zip is a fatal ODF-000 error", () => {
    const result = audit(strToU8("not a zip at all"), "junk.odt");
    expect(result.fatal).toBe(true);
    expect(result.counts.error).toBe(1);
    expect(result.issues[0]!.code).toBe("ODF-000");
    expect(result.issues[0]!.severity).toBe("error");
  });

  test("an empty zip is a fatal ODF-000 error", () => {
    const result = audit(zipSync({}), "empty.odt");
    expect(result.fatal).toBe(true);
    expect(result.counts.error).toBeGreaterThan(0);
    expect(result.issues[0]!.code).toBe("ODF-000");
  });

  test("a zero-byte file is a fatal ODF-000 error", () => {
    const result = audit(new Uint8Array(0), "zero.odt");
    expect(result.fatal).toBe(true);
    expect(result.counts.error).toBe(1);
  });

  test("a package without content.xml is a fatal error", () => {
    const result = audit(packageWith({ "styles.xml": "<x/>" }), "nocontent.odt");
    expect(result.fatal).toBe(true);
    expect(result.issues[0]!.code).toBe("ODF-000");
    expect(result.counts.error).toBe(1);
  });
});

describe("P0-3: language signals", () => {
  test("xml:lang alone satisfies the language rule", () => {
    const result = audit(packageWith({ "content.xml": content('xml:lang="en"') }), "a.odt");
    expect(result.issues.map((i) => i.code)).not.toContain("ODF-LANG-001");
  });

  test("dc:language in meta.xml alone satisfies the language rule", () => {
    const result = audit(
      packageWith({ "content.xml": content(), "meta.xml": meta("<dc:language>en-GB</dc:language>") }),
      "b.odt",
    );
    expect(result.issues.map((i) => i.code)).not.toContain("ODF-LANG-001");
  });

  test("fo:language in styles satisfies the language rule", () => {
    const styles =
      `${XML_HEADER}<office:document-styles ${NS} office:version="1.2">` +
      '<office:styles><style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
      'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" fo:language="fr"/></office:styles>' +
      "</office:document-styles>";
    const result = audit(packageWith({ "content.xml": content(), "styles.xml": styles }), "c.odt");
    expect(result.issues.map((i) => i.code)).not.toContain("ODF-LANG-001");
  });

  test("non-standard office:language is not accepted", () => {
    const result = audit(
      packageWith({ "content.xml": content('office:language="en"') }),
      "d.odt",
    );
    expect(result.issues.map((i) => i.code)).toContain("ODF-LANG-001");
  });
});

describe("P0-7: malformed XML is surfaced", () => {
  test("a malformed content.xml yields a fatal ODF-000 and no language/title noise", () => {
    const malformed =
      `${XML_HEADER}<office:document-content ${NS} office:version="1.2">` +
      "<office:body><office:text><text:p>oops";
    const result = audit(packageWith({ "content.xml": malformed }), "bad-xml.odt");
    expect(result.fatal).toBe(true);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("ODF-000");
    expect(codes).not.toContain("ODF-LANG-001");
    expect(codes).not.toContain("ODF-TITLE-002");
    expect(result.issues.find((i) => i.code === "ODF-000")!.severity).toBe("error");
  });
});

describe("P0-8: decompression limits", () => {
  test("per-entry limit is enforced with a clear message", () => {
    const big = zipSync({ "content.xml": strToU8("x".repeat(5000)) });
    expect(() =>
      openOdf(big, { maxEntryBytes: 1000, maxTotalBytes: 10 * 1024 * 1024, maxMembers: 100 }),
    ).toThrow(/per-entry limit/);
  });

  test("total limit is enforced with a clear message", () => {
    const big = zipSync({
      a: strToU8("a".repeat(600)),
      b: strToU8("b".repeat(600)),
    });
    expect(() =>
      openOdf(big, { maxEntryBytes: 10 * 1024 * 1024, maxTotalBytes: 1000, maxMembers: 100 }),
    ).toThrow(/total limit/);
  });

  test("the default limits are finite", () => {
    expect(DEFAULT_LIMITS.maxEntryBytes).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_LIMITS.maxTotalBytes)).toBe(true);
    expect(DEFAULT_LIMITS.maxMembers).toBeGreaterThan(0);
  });
});

describe("member-count cap", () => {
  test("a package with a huge number of entries is rejected", () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 5000; i++) {
      entries[`part-${i}.xml`] = new Uint8Array(0);
    }
    const bomb = zipSync(entries);
    expect(() =>
      openOdf(bomb, { maxEntryBytes: 1024, maxTotalBytes: 1024 * 1024, maxMembers: 1000 }),
    ).toThrow(/more than 1000 entries/);
  });

  test("a huge number of zero-byte entries does not pass the cap", () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 20000; i++) {
      entries[`e/${i}.xml`] = new Uint8Array(0);
    }
    const bomb = zipSync(entries);
    expect(() =>
      openOdf(bomb, { maxEntryBytes: 1024, maxTotalBytes: 1024, maxMembers: 10000 }),
    ).toThrow(/more than 10000 entries/);
  });
});

describe("path safety", () => {
  test("a parent-directory traversal member is rejected", () => {
    const evil = zipSync({ "../evil.xml": strToU8("x") });
    expect(() => openOdf(evil)).toThrow(/unsafe path segment/);
  });

  test("an absolute member path is rejected", () => {
    const evil = zipSync({ "/tmp/evil.xml": strToU8("x") });
    expect(() => openOdf(evil)).toThrow(/absolute path/);
  });

  test("a nested .. segment is rejected", () => {
    const evil = zipSync({ "Pictures/../../escape.xml": strToU8("x") });
    expect(() => openOdf(evil)).toThrow(/unsafe path segment/);
  });

  test("a backslash member path is rejected", () => {
    const evil = zipSync({ "Pictures\\..\\evil.xml": strToU8("x") });
    expect(() => openOdf(evil)).toThrow(/backslash/);
  });
});
