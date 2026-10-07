import assert from "node:assert/strict";
import { test } from "node:test";
import { collectGmailDocuments, fetchGmailInvoicePdf } from "../lib/gmail";
import { InvoiceProcessingError } from "../lib/errors";
import { classifyInvoiceEmail } from "../utils/email-purpose";

const message = (id: string, date = "Thu, 01 Oct 2026 12:00:00 +0200", subject = "MVM számla") => ({
  id, internalDate: "1790859600000", labelIds: ["INBOX"], payload: {
    mimeType: "multipart/mixed", headers: [{ name: "Date", value: date }, { name: "Subject", value: subject }],
    parts: [{ mimeType: "text/plain", body: { data: Buffer.from("MVM elektronikus számla").toString("base64url") } },
      { mimeType: "application/pdf", filename: "eredeti-szamla.pdf", body: { attachmentId: `attachment-${id}` } }],
  },
});

test("Gmail search paginates, deduplicates message IDs and uses exact Budapest sending month", async () => {
  const previousFetch = globalThis.fetch;
  const requested: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.pathname.endsWith("/messages")) return Response.json(url.searchParams.has("pageToken")
      ? { messages: [{ id: "first" }, { id: "outside" }, { id: "reminder" }] }
      : { messages: [{ id: "first" }], nextPageToken: "next" });
    const id = url.pathname.split("/").at(-1)!;
    return Response.json(id === "outside" ? message(id, "Sat, 31 Oct 2026 23:30:00 +0000")
      : id === "reminder" ? message(id, undefined, "MVM fizetési emlékeztető")
        : message(id, "Wed, 30 Sep 2026 23:30:00 +0000"));
  };
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.complete, true);
    assert.equal(result.searchedMessages, 3);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].messageId, "first");
    assert.equal(requested.filter((url) => url.pathname.endsWith("/messages")).length, 2);
    const query = requested[0].searchParams.get("q")!;
    assert.match(query, /after:\d+ before:\d+/);
    assert.match(query, /in:anywhere -in:sent -in:drafts/);
    assert.equal(requested[0].searchParams.get("includeSpamTrash"), "true");
  } finally { globalThis.fetch = previousFetch; }
});

test("a failed search page retains successful candidates and marks the collection partial", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) return url.searchParams.has("pageToken")
      ? Response.json({ error: "synthetic failure" }, { status: 503 })
      : Response.json({ messages: [{ id: "first" }], nextPageToken: "next" });
    return Response.json(message("first"));
  };
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.complete, false);
    assert.equal(result.candidates.length, 1);
    assert.ok(result.warnings.length > 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("missing sending dates are flagged and never replaced by Gmail arrival dates", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new URL(String(input)).pathname.endsWith("/messages")
    ? Response.json({ messages: [{ id: "first" }] }) : Response.json(message("first", "2026-10-01"));
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.complete, true);
    assert.equal(result.candidates.length, 0);
    assert.ok(result.warnings.length > 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("document fetching revalidates month and attachment membership instead of trusting the client", async () => {
  const previousFetch = globalThis.fetch;
  const pdfBytes = Buffer.from("%PDF-1.4\nsynthetic fixture");
  let attachmentRequests = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/attachments/")) {
      attachmentRequests += 1;
      return Response.json({ data: pdfBytes.toString("base64url") });
    }
    return Response.json(message("first"));
  };
  const reference = { reportMonth: "2026-10", messageId: "first", attachmentId: "part:0.1", fileName: "client-forged.pdf" };
  try {
    const result = await fetchGmailInvoicePdf("test-token-never-sent", reference);
    assert.equal(result.context.fileName, "eredeti-szamla.pdf");
    assert.deepEqual(result.bytes, new Uint8Array(pdfBytes));
    await assert.rejects(fetchGmailInvoicePdf("test-token-never-sent", { ...reference, attachmentId: "not-in-message" }),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "invalid-source");
    await assert.rejects(fetchGmailInvoicePdf("test-token-never-sent", { ...reference, reportMonth: "2026-09" }),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "invalid-source");
    assert.equal(attachmentRequests, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test("MVM date comments retain the explicit offset and do not discard valid invoices", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new URL(String(input)).pathname.endsWith("/messages")
    ? Response.json({ messages: [{ id: "first" }] })
    : Response.json(message("first", "Sat, 3 Oct 2026 21:56:10 +0200 (CET)", "Új villanyszámlája készült"));
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.complete, true);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].sentAt, "2026-10-03T19:56:10.000Z");
  } finally { globalThis.fetch = previousFetch; }
});

test("rotating Gmail attachment tokens preserve document identity and use the latest download token", async () => {
  const previousFetch = globalThis.fetch;
  const pdfBytes = Buffer.from("%PDF-1.4\nsynthetic fixture");
  let messageReads = 0;
  const downloadedTokens: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "first" }] });
    if (url.pathname.includes("/attachments/")) {
      downloadedTokens.push(url.pathname.split("/").at(-1)!);
      return Response.json({ data: pdfBytes.toString("base64url") });
    }
    const value = message("first");
    const part = value.payload.parts[1];
    Object.assign(part, { partId: "1" });
    part.body.attachmentId = `download-token-${++messageReads}`;
    return Response.json(value);
  };
  try {
    const collection = await collectGmailDocuments("test-token-never-sent", "2026-10");
    const candidate = collection.candidates[0];
    assert.equal(candidate.attachmentId, "part:1");
    const reference = { ...candidate, reportMonth: "2026-10" };
    for (let read = 0; read < 2; read++) {
      const fetched = await fetchGmailInvoicePdf("test-token-never-sent", reference);
      assert.deepEqual(fetched.bytes, new Uint8Array(pdfBytes));
      assert.equal(fetched.context.attachmentId, candidate.attachmentId);
    }
    assert.deepEqual(downloadedTokens, ["download-token-2", "download-token-3"]);
    await assert.rejects(fetchGmailInvoicePdf("test-token-never-sent", { ...reference, attachmentId: "part:not-in-message" }),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "invalid-source");
    assert.equal(downloadedTokens.length, 2);
  } finally { globalThis.fetch = previousFetch; }
});

test("email purpose uses provider-independent signals and preserves conflicting or unknown messages", () => {
  const cases = [
    ["Sikeres számlafizetés", "Számla/számlák adatai: MVM", "notification"],
    ["Befizetés visszaigazolása", "ALFÖLDVÍZ számla", "notification"],
    ["Payment received", "MOHU invoice", "notification"],
    ["Fizetési emlékeztető", "MVM számla", "notification"],
    ["Értesítés", "Kedves Ügyfelünk! A bankkártyás fizetése sikeresen megtörtént. MVM számla adatai", "notification"],
    ["Értesítés", "<p>Kedves Ügyfelünk!</p><p>A befizetés sikeresen megtörtént.</p>", "notification"],
    ["Új villanyszámlája készült", "Korábbi fizetése sikeresen megtörtént.", "invoice"],
    ["E-számla értesítés", "Befizetés visszaigazolása", "invoice"],
    ["New invoice available", "Payment confirmation", "invoice"],
    ["Értesítés", "Elkészült legújabb vízdíjszámlája. Befizetés visszaigazolása", "uncertain"],
    ["Új számla – fizetési emlékeztető", "", "uncertain"],
    ["Payment confirmation", "Your new invoice is available.", "uncertain"],
    ["MVM számla", "Számla adatai. Fizetési emlékeztető kérhető az ügyfélszolgálaton.", "uncertain"],
    ["MVM számla", "Számla összege: 100 Ft", "uncertain"],
    ["Értesítés", "MVM számla\n> Payment received", "uncertain"],
    ["Értesítés", "MVM számla<blockquote>Payment received</blockquote>", "uncertain"],
  ] as const;
  for (const [subject, body, expected] of cases) {
    assert.equal(classifyInvoiceEmail(subject, body), expected, subject);
  }
});

test("payment receipts are ignored while unavailable and uncertain invoice documents remain visible", async () => {
  const previousFetch = globalThis.fetch;
  const cases = [
    { subject: "Sikeres számlafizetés", body: "MVM számla adatai", pdf: false, candidates: 0, warnings: 0 },
    { subject: "Befizetés visszaigazolása", body: "ALFÖLDVÍZ számla adatai", pdf: true, candidates: 0, warnings: 0 },
    { subject: "Értesítés", body: "A bankkártyás fizetése sikeresen megtörtént. MOHU számla adatai", pdf: false, candidates: 0, warnings: 0 },
    { subject: "Új villanyszámlája készült", body: "MVM számla", pdf: true, candidates: 1, warnings: 0 },
    { subject: "E-számla értesítés", body: "ALFÖLDVÍZ számla", pdf: false, candidates: 0, warnings: 1 },
    { subject: "MVM számla", body: "MVM számla", pdf: false, candidates: 0, warnings: 1 },
    { subject: "MVM számla", body: "MVM számla", pdf: true, candidates: 1, warnings: 0 },
  ];
  try {
    for (const fixture of cases) {
      globalThis.fetch = async (input) => {
        if (new URL(String(input)).pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "first" }] });
        const value = message("first", undefined, fixture.subject);
        value.payload.parts[0].body.data = Buffer.from(fixture.body).toString("base64url");
        if (!fixture.pdf) value.payload.parts.splice(1);
        return Response.json(value);
      };
      const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
      assert.equal(result.complete, true, fixture.subject);
      assert.equal(result.candidates.length, fixture.candidates, fixture.subject);
      assert.equal(result.warnings.length, fixture.warnings, fixture.subject);
    }
  } finally { globalThis.fetch = previousFetch; }
});

test("one receipt alongside three invoices does not make a complete Gmail collection partial", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: ["one", "two", "three", "receipt"].map((id) => ({ id })) });
    const id = url.pathname.split("/").at(-1)!;
    const value = message(id, undefined, id === "receipt" ? "Sikeres számlafizetés" : "Új számlája készült");
    if (id === "receipt") value.payload.parts.splice(1);
    return Response.json(value);
  };
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.searchedMessages, 4);
    assert.equal(result.candidates.length, 3);
    assert.equal(result.complete, true);
    assert.deepEqual(result.warnings, []);
  } finally { globalThis.fetch = previousFetch; }
});

test("an unreadable Gmail message still marks collection as partial", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new URL(String(input)).pathname.endsWith("/messages")
    ? Response.json({ messages: [{ id: "first" }] }) : Response.json({}, { status: 503 });
  try {
    const result = await collectGmailDocuments("test-token-never-sent", "2026-10");
    assert.equal(result.complete, false);
    assert.equal(result.candidates.length, 0);
    assert.ok(result.warnings.length > 0);
  } finally { globalThis.fetch = previousFetch; }
});
