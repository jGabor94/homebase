import { randomUUID } from "node:crypto";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import { getSafeInvoiceErrorMessage } from "@/features/monthly-expenses/lib/errors";
import { extractInvoiceRowsFromPdf } from "@/features/monthly-expenses/lib/extract-invoice";
import { parsePdfDocument } from "@/features/monthly-expenses/lib/pdf";
import { MAX_UPLOAD_BYTES } from "@/features/monthly-expenses/config";
import { invoiceMonthKeySchema } from "@/features/monthly-expenses/zod/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 128 * 1024;

const jsonError = (message: string, type: string, status: number) => Response.json(
  { success: false, error: { message, type } },
  { status, headers: { "Cache-Control": "no-store, private" } },
);

const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.origin === requestUrl.origin;
  } catch { return false; }
};

const readBoundedBody = async (request: Request) => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
};

export async function POST(request: Request) {
  let session;
  try { session = await auth(); }
  catch { return jsonError("A számlafeltöltéshez jelentkezz be újra.", "unauthenticated", 401); }
  if (!session) return jsonError("A számlafeltöltéshez jelentkezz be.", "unauthenticated", 401);
  if (!hasPermission(session.user, "monthlyExpenses", "import")) {
    return jsonError("Ehhez a funkcióhoz nincs hozzáférésed.", "unauthorized", 403);
  }
  if (!isSameOrigin(request)) return jsonError("A feltöltési kérés eredete nem ellenőrizhető.", "invalid-origin", 403);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;") || !contentType.includes("boundary=")) {
    return jsonError("Válassz egy PDF-számlát a feltöltéshez.", "invalid-form", 400);
  }

  try {
    const bytes = await readBoundedBody(request);
    if (!bytes) return jsonError("A feltöltés nagyobb a megengedett korlátnál.", "request-too-large", 413);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type")! },
      body: bytes,
    }).formData();
    const files = form.getAll("file");
    const months = form.getAll("reportMonth");
    if (files.length !== 1 || !(files[0] instanceof File) || months.length !== 1 || typeof months[0] !== "string") {
      return jsonError("Válassz ki egy PDF-fájlt és egy kimutatási hónapot.", "invalid-form", 400);
    }

    const file = files[0];
    const reportMonth = invoiceMonthKeySchema.safeParse(months[0]);
    const year = Number(months[0].slice(0, 4));
    if (!reportMonth.success || year < 2000 || year > 2100) {
      return jsonError("Érvénytelen kimutatási hónap.", "invalid-month", 400);
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && !["application/pdf", "application/octet-stream"].includes(file.type.toLowerCase()))) {
      return jsonError("Csak PDF-fájlt tölthetsz fel.", "invalid-file-type", 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("A PDF legfeljebb 3 MiB lehet.", "file-too-large", 413);
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const document = await parsePdfDocument(pdfBytes);
    const safeName = file.name.replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 200) || "szamla.pdf";
    const data = await extractInvoiceRowsFromPdf(document, pdfBytes, {
      kind: "upload", documentId: randomUUID(), fileName: safeName, reportMonth: months[0],
    });
    return Response.json({ success: true, data }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const message = getSafeInvoiceErrorMessage(error, "A PDF feldolgozása nem sikerült. Ellenőrizd a fájlt, vagy vidd fel kézzel.");
    const type = error && typeof error === "object" && "code" in error ? String(error.code) : "invoice-import-error";
    const status = type === "file-too-large" ? 413 : 400;
    return jsonError(message, type, status);
  }
}
