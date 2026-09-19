/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { audit } from "../src/audit";

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

const MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
  '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>' +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' +
  "</manifest:manifest>";

function makePackage(content: string, styles: string, meta: string): Uint8Array {
  return zipSync({
    mimetype: strToU8("application/vnd.oasis.opendocument.text"),
    "META-INF/manifest.xml": strToU8(MANIFEST),
    "content.xml": strToU8(content),
    "styles.xml": strToU8(styles),
    "meta.xml": strToU8(meta),
  });
}

const BAD_CONTENT =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  `<office:document-content ${NS} office:version="1.2">` +
  "<office:body><office:text>" +
  '<text:h text:outline-level="1">Heading One</text:h>' +
  '<text:h text:outline-level="3">Heading Three</text:h>' +
  "<text:p>Some paragraph text.</text:p>" +
  '<draw:frame><draw:image xlink:href="Pictures/bad.png"/></draw:frame>' +
  "<table:table><table:table-row><table:table-cell><text:p>Cell</text:p></table:table-cell></table:table-row></table:table>" +
  '<text:p><text:a xlink:href="https://example.com" xlink:type="simple">https://example.com</text:a></text:p>' +
  "</office:text></office:body></office:document-content>";

const BAD_STYLES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  `<office:document-styles ${NS} office:version="1.2"><office:styles/></office:document-styles>`;

const BAD_META =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">' +
  "<office:meta><dc:creator>Nobody</dc:creator></office:meta></office:document-meta>";

const GOOD_CONTENT =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  `<office:document-content ${NS} office:version="1.2" office:language="en">` +
  "<office:body><office:text>" +
  '<text:h text:outline-level="1">Heading</text:h>' +
  '<text:h text:outline-level="2">Subheading</text:h>' +
  "<text:p>Body text.</text:p>" +
  '<draw:frame><svg:title>Alt text</svg:title><draw:image xlink:href="Pictures/good.png"/></draw:frame>' +
  "<table:table>" +
  "<table:table-header-rows><table:table-row><table:table-cell><text:p>H</text:p></table:table-cell></table:table-row></table:table-header-rows>" +
  "<table:table-row><table:table-cell><text:p>D</text:p></table:table-cell></table:table-row>" +
  "</table:table>" +
  '<text:p><text:a xlink:href="https://example.com" xlink:type="simple">Example</text:a></text:p>' +
  "</office:text></office:body></office:document-content>";

const GOOD_STYLES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  `<office:document-styles ${NS} office:version="1.2"><office:styles/></office:document-styles>`;

const GOOD_META =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">' +
  "<office:meta><dc:title>Good Document</dc:title></office:meta></office:document-meta>";

describe("runRules via audit", () => {
  test("bad document reports the expected issues", () => {
    const result = audit(makePackage(BAD_CONTENT, BAD_STYLES, BAD_META), "bad.odt");
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("ODF-LANG-001");
    expect(codes).toContain("ODF-TITLE-002");
    expect(codes).toContain("ODF-ALT-003");
    expect(codes).toContain("ODF-HEAD-004");
    expect(codes).toContain("ODF-TBL-006");
    expect(codes).toContain("ODF-LINK-007");
    expect(result.kind).toBe("odt");
    expect(result.issues.every((issue) => issue.location === "bad.odt")).toBe(true);
  });

  test("good document has no errors", () => {
    const result = audit(makePackage(GOOD_CONTENT, GOOD_STYLES, GOOD_META), "good.odt");
    expect(result.kind).toBe("odt");
    expect(result.counts.error).toBe(0);
  });
});
