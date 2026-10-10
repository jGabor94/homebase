import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { createEmptyInvoice, summarizeInvoices } from "../utils";
import { createSummaryExportFile, createSummaryExportSnapshot, createSummaryText } from "../utils/summary-export";
import { sendSummaryEmailSchema } from "../zod/summary-export";
import type { AdditionalItemInput } from "../types";

test("export preserves all sidebar rows and the displayed rounding rather than just invoices", () => {
  const invoices = [
    { ...createEmptyInvoice("2026-10"), providerName: "ALFÖLDVÍZ", category: "water" as const, amountMinor: 10_933_700, currency: "HUF", invoiceNumber: "134425LH26", dueDate: "2026-10-22", billingPeriod: "2026.09.01. – 2026.09.30." },
    { ...createEmptyInvoice("2026-10"), providerName: "", amountMinor: null },
  ];
  const additionalItems: AdditionalItemInput[] = [
    { id: crypto.randomUUID(), name: "Hitel", amountMinor: 8_100_000, isDefault: true },
    { id: crypto.randomUUID(), name: "Őrlő javítása", amountMinor: 0, isDefault: false },
    { id: crypto.randomUUID(), name: "Hiányzó összeg", amountMinor: null, isDefault: false },
  ];
  const snapshot = createSummaryExportSnapshot("2026-10", invoices, additionalItems, "190 337 Ft", "95 169 Ft");
  const text = createSummaryText(snapshot);
  assert.equal(snapshot.invoiceLines.length, 2);
  assert.equal(snapshot.additionalLines.length, 3);
  assert.match(text, /ALFÖLDVÍZ/);
  assert.match(text, /Számlaszám: 134425LH26/);
  assert.match(text, /Fizetési határidő: 2026\.10\.22\./);
  assert.match(text, /Fogyasztási időszak: 2026\.09\.01\. – 2026\.09\.30\./);
  assert.match(text, /Számlaszám: Nincs megadva/);
  assert.match(text, /Ismeretlen szolgáltató.*Összeg hiányos/);
  assert.match(text, /Hitel.*81\s000 Ft/);
  assert.match(text, /Őrlő javítása.*0 Ft/);
  assert.match(text, /Hiányzó összeg.*Összeg hiányos/);
  assert.match(text, /Összesen: 190 337 Ft/);
  assert.match(text, /Fele: 95 169 Ft/);
  invoices[0].providerName = "Utólag módosítva";
  additionalItems[0].name = "Utólag módosítva";
  assert.doesNotMatch(createSummaryText(snapshot), /Utólag módosítva/);
});

test("export does not total excluded corrections or foreign currencies itself", () => {
  const invoices = [
    { ...createEmptyInvoice("2026-10"), providerName: "Jóváírás", amountMinor: -100_000, currency: "HUF", documentType: "credit" as const },
    { ...createEmptyInvoice("2026-10"), providerName: "Külföldi", amountMinor: 200_000, currency: "EUR" },
  ];
  const summary = summarizeInvoices(invoices, 0);
  const snapshot = createSummaryExportSnapshot("2026-10", invoices, [], summary.formattedTotal, "0 Ft", true);
  assert.equal(snapshot.total, summary.formattedTotal);
  assert.match(snapshot.invoiceLines[1], /Összeg hiányos/);
  assert.match(createSummaryText(snapshot), /biztonságos számolási korlátot/);
});

test("text export keeps 200 rows and accepts a partial summary", () => {
  const invoices = Array.from({ length: 100 }, (_, index) => ({ ...createEmptyInvoice("2026-10"), providerName: `Szolgáltató-${index}` }));
  const items = Array.from({ length: 100 }, (_, index) => ({ id: crypto.randomUUID(), name: `Tétel-${index}`, amountMinor: null, isDefault: false }));
  const text = createSummaryText(createSummaryExportSnapshot("2026-10", invoices, items, "0 Ft", "0 Ft"));
  assert.match(text, /Szolgáltató-99/);
  assert.match(text, /Tétel-99/);
  assert.match(text, /2026\. október/);
});

test("send input rejects header injection, invalid formats and oversized payloads", () => {
  const payload = { reportMonth: "2026-10", format: "txt", total: "0 Ft", half: "0 Ft", attachmentBase64: Buffer.from("Havi közös költségkimutatás").toString("base64") };
  assert.equal(sendSummaryEmailSchema.safeParse(payload).success, true);
  for (const patch of [{ total: "0 Ft\r\nBcc: attacker@example.com" }, { reportMonth: "2026-13" }, { format: "html" }, { attachmentBase64: "!not-base64!" }, { attachmentBase64: "a".repeat(4_000_000) }]) {
    assert.equal(sendSummaryEmailSchema.safeParse({ ...payload, ...patch }).success, false);
  }
});

test("TXT download is a named UTF-8 file containing the same snapshot", async () => {
  const snapshot = createSummaryExportSnapshot("2026-10", [], [], "109 337 Ft", "54 669 Ft");
  const file = await createSummaryExportFile(snapshot, "txt");
  assert.equal(file.name, "havi-kimutatas-2026-10.txt");
  assert.equal(file.type, "text/plain;charset=utf-8");
  assert.equal(await file.text(), createSummaryText(snapshot));
});

const mockLocalFonts = () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const name = String(input).split("/").at(-1);
    assert.ok(name === "LiberationSans-Regular.ttf" || name === "LiberationSans-Bold.ttf");
    return new Response(new Uint8Array(await readFile(`public/fonts/${name}`)));
  };
  return () => { globalThis.fetch = previousFetch; };
};

test("vector PDF retains selectable Hungarian text and paginates 200 rows without images", async () => {
  const restoreFetch = mockLocalFonts();
  try {
    const invoices = Array.from({ length: 100 }, (_, index) => ({
      ...createEmptyInvoice("2026-10"), providerName: `Őrző-védő áramszolgáltató-${index}`, amountMinor: 123_450, currency: "HUF",
    }));
    const items = Array.from({ length: 100 }, (_, index) => ({ id: crypto.randomUUID(), name: `Fűtés-${index}`, amountMinor: 81_000, isDefault: false }));
    const snapshot = createSummaryExportSnapshot("2026-10", invoices, items, "204 450 Ft", "102 225 Ft");
    const file = await createSummaryExportFile(snapshot, "pdf");
    const bytes = Buffer.from(await file.arrayBuffer());
    assert.equal(file.name, "havi-kimutatas-2026-10.pdf");
    assert.equal(file.type, "application/pdf");
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert.doesNotMatch(bytes.toString("latin1"), /\/Subtype\s*\/Image/);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      assert.ok((await parser.getInfo()).total > 1);
      const result = await parser.getText();
      assert.match(result.text, /Őrző-védő\s+áramszolgáltató-99/);
      assert.match(result.text, /Fűtés-99/);
      assert.match(result.text, /204\s450 Ft/);
      assert.match(result.text, /102\s225 Ft/);
    } finally { await parser.destroy(); }
  } finally { restoreFetch(); }
});

test("a monthly report keeps five rows, total and half together on one PDF page", async () => {
  const restoreFetch = mockLocalFonts();
  try {
    const invoices = [360_200, 555_500, 505_600].map((amountMinor) => ({ ...createEmptyInvoice("2026-10"), providerName: "MVM / ALFÖLDVÍZ", amountMinor, currency: "HUF", invoiceNumber: "847203473922", dueDate: "2026-10-14", billingPeriod: "2026.08.24. – 2026.09.24." }));
    const items = [
      { id: crypto.randomUUID(), name: "Hitel", amountMinor: 8_100_000, isDefault: true },
      { id: crypto.randomUUID(), name: "Gáz", amountMinor: 1_412_400, isDefault: true },
    ];
    const file = await createSummaryExportFile(createSummaryExportSnapshot("2026-10", invoices, items, "109 337 Ft", "54 669 Ft"), "pdf");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      assert.equal((await parser.getInfo()).total, 1);
      const result = await parser.getText();
      assert.match(result.text, /Összesen/);
      assert.match(result.text, /847203473922/);
      assert.match(result.text, /2026\.10\.14\./);
      assert.match(result.text, /109\s337 Ft/);
      assert.match(result.text, /54\s669 Ft/);
      assert.match(result.text, /1\s*\/\s*1/);
    } finally { await parser.destroy(); }
  } finally { restoreFetch(); }
});

test("styled PNG renders a real high-resolution file with every row", async () => {
  const previousDocument = globalThis.document;
  const previousFontFace = globalThis.FontFace;
  GlobalFonts.registerFromPath("public/fonts/LiberationSans-Regular.ttf", "LiberationSans");
  GlobalFonts.registerFromPath("public/fonts/LiberationSans-Bold.ttf", "LiberationSans");
  globalThis.FontFace = class { async load() { return this; } } as unknown as typeof FontFace;
  globalThis.document = { fonts: { add: () => {} }, createElement: () => {
    const canvas = createCanvas(1, 1);
    Object.assign(canvas, { toBlob: (callback: BlobCallback) => callback(new Blob([new Uint8Array(canvas.toBuffer("image/png"))], { type: "image/png" })) });
    return canvas;
  } } as unknown as Document;
  try {
    const invoices = [{ ...createEmptyInvoice("2026-10"), providerName: "ALFÖLDVÍZ", category: "water" as const, amountMinor: 505_600, currency: "HUF" }];
    const items = [{ id: crypto.randomUUID(), name: "Hitel", amountMinor: 8_100_000, isDefault: true }];
    const file = await createSummaryExportFile(createSummaryExportSnapshot("2026-10", invoices, items, "86 056 Ft", "43 028 Ft"), "png");
    const bytes = Buffer.from(await file.arrayBuffer());
    assert.equal(file.type, "image/png");
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.readUInt32BE(16) >= 1200);
    assert.ok(bytes.readUInt32BE(20) > 400);
    assert.ok(bytes.length > 10_000);
  } finally {
    if (previousDocument) globalThis.document = previousDocument;
    else Reflect.deleteProperty(globalThis, "document");
    if (previousFontFace) globalThis.FontFace = previousFontFace;
    else Reflect.deleteProperty(globalThis, "FontFace");
  }
});
