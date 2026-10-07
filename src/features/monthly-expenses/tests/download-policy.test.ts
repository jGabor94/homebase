import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAllowedInvoiceLinks, isConfiguredInvoiceDownloadUrl } from "../lib/invoice-download";

test("invoice links require an exact configured HTTPS host and cannot invoke payment routes", () => {
  const previous = process.env.MONTHLY_EXPENSES_INVOICE_HOSTS;
  process.env.MONTHLY_EXPENSES_INVOICE_HOSTS = "billing.example.com";
  try {
    assert.equal(isConfiguredInvoiceDownloadUrl("https://billing.example.com/invoices/123.pdf"), true);
    for (const url of [
      "http://billing.example.com/invoices/123.pdf",
      "https://billing.example.com.attacker.example/invoices/123.pdf",
      "https://user:password@billing.example.com/invoices/123.pdf",
      "https://billing.example.com:8443/invoices/123.pdf",
      "https://127.0.0.1/invoices/123.pdf",
      "https://billing.example.com/payment/123",
      "https://billing.example.com/invoice?payment=123",
    ]) assert.equal(isConfiguredInvoiceDownloadUrl(url), false, url);
    assert.deepEqual(extractAllowedInvoiceLinks([
      '<a href="https://billing.example.com/invoices/123.pdf?first=1&amp;second=2">Számla letöltése</a>',
      '<a href="https://billing.example.com/payment/123">Fizetés</a>',
    ]), ["https://billing.example.com/invoices/123.pdf?first=1&second=2"]);
  } finally {
    if (previous === undefined) delete process.env.MONTHLY_EXPENSES_INVOICE_HOSTS;
    else process.env.MONTHLY_EXPENSES_INVOICE_HOSTS = previous;
  }
});

test("an unconfigured host is never downloaded", () => {
  const previous = process.env.MONTHLY_EXPENSES_INVOICE_HOSTS;
  delete process.env.MONTHLY_EXPENSES_INVOICE_HOSTS;
  try {
    assert.equal(isConfiguredInvoiceDownloadUrl("https://billing.example.com/invoice.pdf"), false);
  } finally {
    if (previous !== undefined) process.env.MONTHLY_EXPENSES_INVOICE_HOSTS = previous;
  }
});
