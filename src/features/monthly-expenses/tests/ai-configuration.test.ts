import assert from "node:assert/strict";
import { test } from "node:test";
import { extractInvoicesWithAi } from "../lib/ai";
import { InvoiceProcessingError } from "../lib/errors";

test("missing Gateway configuration fails explicitly before sending any document", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const document = { documentHash: "a".repeat(64), totalPages: 1, pages: [{ page: 1, text: "invoice document" }], text: "invoice document", readable: true };
  try {
    delete process.env.AI_GATEWAY_API_KEY;
    await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "ai-not-configured");
    process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
    delete process.env.AI_GATEWAY_MODEL;
    await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "ai-model-not-configured");
  } finally {
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("Gateway rate limits become safe actionable errors without automatic retries", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  let requests = 0;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ error: { message: "private-document-content", type: "rate_limit_exceeded" } }, { status: 429 });
  };
  try {
    await assert.rejects(extractInvoicesWithAi({
      documentHash: "a".repeat(64), totalPages: 1,
      pages: [{ page: 1, text: "a synthetic invoice document only" }],
      text: "a synthetic invoice document only", readable: true,
    }, new Uint8Array()), (error: unknown) => error instanceof InvoiceProcessingError
      && error.code === "ai-rate-limit" && !error.message.includes("private-document-content"));
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("Gateway timeouts do not expose provider messages or claim successful extraction", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  globalThis.fetch = async () => { throw new DOMException("private-document-content", "TimeoutError"); };
  try {
    await assert.rejects(extractInvoicesWithAi({
      documentHash: "a".repeat(64), totalPages: 1,
      pages: [{ page: 1, text: "a synthetic invoice document only" }],
      text: "a synthetic invoice document only", readable: true,
    }, new Uint8Array()), (error: unknown) => error instanceof InvoiceProcessingError
      && error.code === "ai-timeout" && !error.message.includes("private-document-content"));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("SDK-wrapped Gateway authentication failures retain actionable guidance without exposing secrets", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  let status = 401;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ error: { message: "private-document-content test-key-never-sent", type: status === 401 ? "authentication_error" : "forbidden" } }, { status });
  };
  const document = { documentHash: "a".repeat(64), totalPages: 1,
    pages: [{ page: 1, text: "a synthetic invoice document only" }],
    text: "a synthetic invoice document only", readable: true };
  try {
    await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "ai-access-denied"
        && error.message.includes("AI_GATEWAY_API_KEY") && !/private-document|test-key-never-sent/u.test(error.message));
    status = 403;
    await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code === "ai-access-denied"
        && error.message.includes("nem jogosult") && !/private-document|test-key-never-sent/u.test(error.message));
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("structured Gateway output is accepted and malformed output never becomes invoice data", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  let generatedText = '{"invoices":[]}';
  globalThis.fetch = async () => Response.json({
    content: [{ type: "text", text: generatedText }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } },
    warnings: [],
  });
  const document = { documentHash: "a".repeat(64), totalPages: 1,
    pages: [{ page: 1, text: "a synthetic non-invoice document" }],
    text: "a synthetic non-invoice document", readable: true };
  try {
    const result = await extractInvoicesWithAi(document, new Uint8Array());
    assert.deepEqual(result.invoices, []);
    generatedText = '{"invoices":[{"amount":"guessed"}]}';
    await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
      (error: unknown) => error instanceof InvoiceProcessingError && error.code.startsWith("ai-"));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("generation omits Gemini complexity limits while local validation still rejects out-of-bounds data", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  const emptyField = { value: null, evidence: null };
  const invoice = Object.fromEntries([
    "providerName", "category", "invoiceNumber", "amount", "currency", "dueDate",
    "billingPeriod", "issuedAt", "documentType", "relatedInvoiceNumber",
  ].map((name) => [name, emptyField]));
  let output: unknown = { invoices: [invoice] };
  globalThis.fetch = async (_input, init) => {
    const request = String(init?.body);
    assert.doesNotMatch(request, /"(?:minLength|maxLength|minimum|maximum|minItems|maxItems)"\s*:/u);
    assert.match(request, /"enum"\s*:/u);
    assert.match(request, /"required"\s*:/u);
    return Response.json({
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } }, warnings: [],
    });
  };
  const document = { documentHash: "a".repeat(64), totalPages: 1,
    pages: [{ page: 1, text: "synthetic document only" }], text: "synthetic document only", readable: true };
  try {
    assert.equal((await extractInvoicesWithAi(document, new Uint8Array())).invoices.length, 1);
    for (const invalidOutput of [
      { invoices: Array.from({ length: 11 }, () => invoice) },
      { invoices: [{ ...invoice, providerName: { value: "x".repeat(501), evidence: null } }] },
      { invoices: [{ ...invoice, amount: { value: "12 Ft", evidence: { page: 31, quote: "12 Ft" } } }] },
      { invoices: [{ ...invoice, amount: { value: "12 Ft", evidence: { page: 0, quote: "12 Ft" } } }] },
      { invoices: [{ ...invoice, amount: { value: "12 Ft", evidence: { page: 1, quote: "" } } }] },
      { invoices: [{ ...invoice, amount: { value: "12 Ft", evidence: { page: 1, quote: "x".repeat(501) } } }] },
      { invoices: [{ ...invoice, category: { value: "invented-category", evidence: null } }] },
    ]) {
      output = invalidOutput;
      await assert.rejects(extractInvoicesWithAi(document, new Uint8Array()),
        (error: unknown) => error instanceof InvoiceProcessingError && error.code === "ai-invalid-output");
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});
