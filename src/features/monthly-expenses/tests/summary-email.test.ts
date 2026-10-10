import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSummaryEmailRaw, sendSummaryMessage } from "../lib/summary-email";

const input = {
  mailboxEmail: "sender@example.com",
  recipient: "sz.marcsi85@gmail.com",
  subject: "Havi közös költségkimutatás — 2026. október",
  body: "Szia!\r\n\r\nÖsszesen: 109 337 Ft\r\nFele: 54 669 Ft",
  attachment: { bytes: Buffer.from("Havi közös költségkimutatás\r\nŐrlő és víz"), filename: "havi-kimutatas-2026-10.txt", format: "txt" as const },
};

test("MIME retains UTF-8 subject/body and the exact downloaded attachment bytes", () => {
  const raw = buildSummaryEmailRaw({ ...input, boundary: "synthetic-boundary" });
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /From: sender@example.com\r\nTo: sz\.marcsi85@gmail\.com/);
  const encodedSubject = mime.match(/Subject: ([\s\S]*?)\r\nMIME-Version/)![1];
  const subject = [...encodedSubject.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((match) => Buffer.from(match[1], "base64").toString("utf8")).join("");
  assert.equal(subject, input.subject);
  for (const match of encodedSubject.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)) assert.ok(match[0].length <= 75);
  const parts = mime.split("--synthetic-boundary");
  assert.equal(Buffer.from(parts[1].split("\r\n\r\n")[1].trim(), "base64").toString("utf8"), input.body);
  assert.deepEqual(Buffer.from(parts[2].split("\r\n\r\n")[1].trim(), "base64"), input.attachment.bytes);
  assert.match(parts[2], /Content-Disposition: attachment; filename="havi-kimutatas-2026-10.txt"/);
});

test("all selected formats use their corresponding MIME type", () => {
  for (const [format, mimeType] of [["pdf", "application/pdf"], ["png", "image/png"], ["txt", "text/plain"]] as const) {
    const mime = Buffer.from(buildSummaryEmailRaw({ ...input, attachment: { ...input.attachment, format, filename: `havi-kimutatas-2026-10.${format}` }, boundary: "test" }), "base64url").toString("utf8");
    assert.ok(mime.includes(`Content-Type: ${mimeType};`));
  }
});

test("Gmail send uses one POST with a raw MIME attachment and no automatic retry", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(String(url), "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(options?.method, "POST");
    const mime = Buffer.from(JSON.parse(String(options?.body)).raw, "base64url").toString("utf8");
    assert.match(mime, /To: sz\.marcsi85@gmail\.com/);
    return Response.json({ error: { message: "synthetic private error" } }, { status: 503 });
  };
  try {
    const result = await sendSummaryMessage({ ...input, accessToken: "synthetic-token-never-sent" });
    assert.equal(result.status, 503);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
