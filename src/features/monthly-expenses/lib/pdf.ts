import "server-only";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import {
  MAX_DOCUMENT_TEXT_LENGTH,
  MAX_PDF_PAGES,
  MAX_UPLOAD_BYTES,
  PDF_TIMEOUT_MS,
} from "../config";
import { InvoiceProcessingError } from "./errors";

export interface PdfPageText {
  page: number;
  text: string;
}

export interface ParsedPdfDocument {
  documentHash: string;
  totalPages: number;
  pages: PdfPageText[];
  text: string;
  readable: boolean;
}

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new InvoiceProcessingError("pdf-timeout", "A PDF feldolgozása túl sokáig tartott.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const hasPdfHeader = (bytes: Uint8Array) => {
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  return /%PDF-\d\.\d/u.test(header);
};

export const hashDocument = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export const parsePdfDocument = async (input: Uint8Array): Promise<ParsedPdfDocument> => {
  const bytes = new Uint8Array(input);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new InvoiceProcessingError("file-too-large", "A PDF legfeljebb 3 MiB lehet.");
  }
  if (bytes.byteLength < 12 || !hasPdfHeader(bytes)) {
    throw new InvoiceProcessingError("not-a-pdf", "A kiválasztott fájl nem érvényes PDF.");
  }

  const documentHash = hashDocument(bytes);
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await withTimeout(parser.getInfo(), PDF_TIMEOUT_MS);
    if (info.total < 1) throw new InvoiceProcessingError("empty-pdf", "A PDF nem tartalmaz olvasható oldalakat.");
    if (info.total > MAX_PDF_PAGES) {
      throw new InvoiceProcessingError("too-many-pages", "Egy PDF legfeljebb 30 oldalas lehet.");
    }

    const result = await withTimeout(parser.getText({ first: MAX_PDF_PAGES, pageJoiner: "\n" }), PDF_TIMEOUT_MS);
    const pages = result.pages.map(({ num, text }) => ({ page: num, text: text.trim() }));
    const text = pages.map(({ page, text: pageText }) => `--- ${page} ---\n${pageText}`).join("\n");
    if (text.length > MAX_DOCUMENT_TEXT_LENGTH) {
      throw new InvoiceProcessingError("text-too-long", "A PDF szövege túl hosszú a biztonságos feldolgozáshoz.");
    }

    return {
      documentHash,
      totalPages: info.total,
      pages,
      text,
      readable: pages.some(({ text: pageText }) => pageText.replace(/\s/gu, "").length >= 20),
    };
  } catch (error) {
    if (error instanceof InvoiceProcessingError) throw error;
    const description = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : "";
    if (description.includes("password") || description.includes("encrypted")) {
      throw new InvoiceProcessingError("password-protected", "A PDF jelszóval védett; oldd fel és töltsd fel újra.");
    }
    throw new InvoiceProcessingError("pdf-unreadable", "A PDF sérült vagy nem olvasható.");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};
