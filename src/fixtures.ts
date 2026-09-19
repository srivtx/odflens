import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

const MIME_ODT = "application/vnd.oasis.opendocument.text";
const MIME_ODS = "application/vnd.oasis.opendocument.spreadsheet";

const CONTENT_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink"';

const STYLES_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

const META_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/"';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';

type Part = string | Uint8Array;

function zip(parts: Record<string, Part>, storedFirst?: string): Uint8Array {
  const out: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  for (const [path, data] of Object.entries(parts)) {
    const bytes = typeof data === "string" ? strToU8(data) : data;
    out[path] = path === storedFirst ? [bytes, { level: 0 }] : bytes;
  }
  return zipSync(out);
}

function manifest(mediaType: string): string {
  return (
    XML_HEADER +
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
    `<manifest:file-entry manifest:full-path="/" manifest:media-type="${mediaType}"/>` +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
    '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' +
    "</manifest:manifest>"
  );
}

function meta(title?: string): string {
  const dcTitle = title ? `<dc:title>${title}</dc:title>` : "";
  return (
    XML_HEADER +
    `<office:document-meta ${META_NS} office:version="1.2">` +
    `<office:meta><meta:generator>odflens fixtures</meta:generator>${dcTitle}</office:meta>` +
    "</office:document-meta>"
  );
}

function styles(language?: string): string {
  const lang = language ? ` office:language="${language}"` : "";
  return (
    XML_HEADER +
    `<office:document-styles ${STYLES_NS}${lang} office:version="1.2">` +
    "<office:styles/>" +
    "<office:automatic-styles/>" +
    "<office:master-styles/>" +
    "</office:document-styles>"
  );
}

function image(frameChildren: string): string {
  return (
    '<text:p><draw:frame draw:name="Image1" svg:width="4cm" svg:height="3cm">' +
    frameChildren +
    '<draw:image xlink:href="Pictures/chart.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>' +
    "</draw:frame></text:p>"
  );
}

function table(withHeader: boolean): string {
  const cell = (value: string) =>
    `<table:table-cell><text:p>${value}</text:p></table:table-cell>`;
  const headerRow = `<table:table-row>${cell("Name")}${cell("Value")}</table:table-row>`;
  const dataRow = `<table:table-row>${cell("Alpha")}${cell("One")}</table:table-row>`;
  const body = withHeader
    ? `<table:table-header-rows>${headerRow}</table:table-header-rows>${dataRow}`
    : `${headerRow}${dataRow}`;
  return `<table:table table:name="Data">${body}</table:table>`;
}

function link(text: string): string {
  return (
    '<text:p><text:a xlink:href="https://example.com/page" xlink:type="simple">' +
    `${text}</text:a></text:p>`
  );
}

function badOdtContent(): string {
  return (
    XML_HEADER +
    `<office:document-content ${CONTENT_NS} office:version="1.2">` +
    "<office:body><office:text>" +
    '<text:h text:outline-level="1">Introduction</text:h>' +
    "<text:p>Some introductory body text.</text:p>" +
    '<text:h text:outline-level="3">Details</text:h>' +
    image("") +
    link("https://example.com/page") +
    table(false) +
    "</office:text></office:body>" +
    "</office:document-content>"
  );
}

function goodOdtContent(): string {
  return (
    XML_HEADER +
    `<office:document-content ${CONTENT_NS} office:language="en" office:version="1.2">` +
    "<office:body><office:text>" +
    '<text:h text:outline-level="1">Introduction</text:h>' +
    "<text:p>Some introductory body text.</text:p>" +
    '<text:h text:outline-level="2">Details</text:h>' +
    image("<svg:title>A chart</svg:title><svg:desc>A bar chart of sales.</svg:desc>") +
    link("Example") +
    table(true) +
    "</office:text></office:body>" +
    "</office:document-content>"
  );
}

function badOdsContent(): string {
  const cell = (value: string) =>
    '<table:table-cell office:value-type="string"><text:p>' +
    `${value}</text:p></table:table-cell>`;
  return (
    XML_HEADER +
    `<office:document-content ${CONTENT_NS} office:version="1.2">` +
    "<office:body><office:spreadsheet>" +
    '<table:table table:name="Sheet1">' +
    `<table:table-row>${cell("Name")}${cell("Value")}</table:table-row>` +
    `<table:table-row>${cell("Alpha")}${cell("One")}</table:table-row>` +
    "</table:table>" +
    "</office:spreadsheet></office:body>" +
    "</office:document-content>"
  );
}

export function makeBadOdt(): Uint8Array {
  return zip(
    {
      mimetype: MIME_ODT,
      "META-INF/manifest.xml": manifest(MIME_ODT),
      "content.xml": badOdtContent(),
      "styles.xml": styles(),
      "meta.xml": meta(),
    },
    "mimetype",
  );
}

export function makeGoodOdt(): Uint8Array {
  return zip(
    {
      mimetype: MIME_ODT,
      "META-INF/manifest.xml": manifest(MIME_ODT),
      "content.xml": goodOdtContent(),
      "styles.xml": styles("en"),
      "meta.xml": meta("Accessible"),
    },
    "mimetype",
  );
}

export function makeBadOds(): Uint8Array {
  return zip(
    {
      mimetype: MIME_ODS,
      "META-INF/manifest.xml": manifest(MIME_ODS),
      "content.xml": badOdsContent(),
      "styles.xml": styles(),
      "meta.xml": meta(),
    },
    "mimetype",
  );
}

export function writeFixturesTo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "bad.odt"), makeBadOdt());
  writeFileSync(join(dir, "good.odt"), makeGoodOdt());
  writeFileSync(join(dir, "bad.ods"), makeBadOds());
}

if (import.meta.main) {
  writeFixturesTo("fixtures");
  console.log("Wrote fixtures/bad.odt, fixtures/good.odt, fixtures/bad.ods");
}
