import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PDFParse } from "pdf-parse";
import { parsePdfDocument } from "../lib/pdf";
import { MAX_UPLOAD_BYTES } from "../config";
import { InvoiceProcessingError } from "../lib/errors";

const makePdf = (text: string) => {
  const content = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) result += `${String(offset).padStart(10, "0")} 00000 n \n`;
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(result));
};

test("the pinned PDF parser extracts real page text on the installed Node runtime", async () => {
  const parser = new PDFParse({ data: makePdf("MVM invoice TEST-001 - Gross amount 12400 HUF") });
  try {
    const info = await parser.getInfo();
    assert.equal(info.total, 1);
    const text = await parser.getText();
    assert.equal(text.pages.length, 1);
    assert.match(text.pages[0].text, /TEST-001/);
    assert.match(text.pages[0].text, /12400 HUF/);
  } finally {
    await parser.destroy();
  }
});

test("the shared import parser preserves page text and hashes identical bytes consistently", async () => {
  const bytes = makePdf("MVM invoice TEST-001 - Gross amount 12400 HUF");
  const originalBytes = new Uint8Array(bytes);
  const first = await parsePdfDocument(bytes);
  const second = await parsePdfDocument(bytes);
  const differentBytes = makePdf("MVM invoice TEST-002 - Gross amount 15600 HUF");
  const different = await parsePdfDocument(differentBytes);
  assert.equal(first.totalPages, 1);
  assert.equal(first.pages[0].page, 1);
  assert.match(first.pages[0].text, /TEST-001/);
  assert.equal(first.documentHash, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(first.documentHash, second.documentHash);
  assert.equal(different.documentHash, createHash("sha256").update(differentBytes).digest("hex"));
  assert.notEqual(first.documentHash, different.documentHash);
  assert.deepEqual(bytes, originalBytes);
  assert.equal(first.readable, true);
});

test("invalid and oversized files are rejected before invoice extraction", async () => {
  await assert.rejects(parsePdfDocument(new TextEncoder().encode("not a PDF document")),
    (error: unknown) => error instanceof InvoiceProcessingError && error.code === "not-a-pdf");
  await assert.rejects(parsePdfDocument(new Uint8Array(MAX_UPLOAD_BYTES + 1)),
    (error: unknown) => error instanceof InvoiceProcessingError && error.code === "file-too-large");
  await assert.rejects(parsePdfDocument(new TextEncoder().encode("%PDF-1.4\ninvalid document bytes")),
    (error: unknown) => error instanceof InvoiceProcessingError && error.code === "pdf-unreadable");
});
