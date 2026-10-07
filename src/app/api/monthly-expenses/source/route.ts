import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import { getSafeInvoiceErrorMessage } from "@/features/monthly-expenses/lib/errors";
import { fetchGmailInvoicePdf } from "@/features/monthly-expenses/lib/gmail";
import { getGoogleAccess } from "@/features/monthly-expenses/lib/google-access";
import { parsePdfDocument } from "@/features/monthly-expenses/lib/pdf";
import { isDateInMonthWindow } from "@/features/monthly-expenses/utils/dates";
import { gmailDocumentReferenceSchema, invoiceMonthKeySchema } from "@/features/monthly-expenses/zod/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonError = (message: string, status: number) => Response.json(
  { success: false, error: { type: "source-preview-error", message } },
  { status, headers: { "Cache-Control": "no-store, private" } },
);

const safeInlineName = (value: string) => {
  const clean = value.replace(/[\u0000-\u001f\u007f"\\/]/gu, "_").slice(0, 120) || "szamla.pdf";
  const ascii = clean.replace(/[^\x20-\x7e]/gu, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
};

export async function GET(request: Request) {
  let session;
  try { session = await auth(); }
  catch { return jsonError("A számla megtekintéséhez jelentkezz be újra.", 401); }
  if (!session) return jsonError("A számla megtekintéséhez jelentkezz be.", 401);
  if (!hasPermission(session.user, "monthlyExpenses", "import")) return jsonError("Ehhez a funkcióhoz nincs hozzáférésed.", 403);

  const url = new URL(request.url);
  const reportMonth = invoiceMonthKeySchema.safeParse(url.searchParams.get("reportMonth"));
  const year = Number(url.searchParams.get("reportMonth")?.slice(0, 4));
  const messageId = url.searchParams.get("messageId") ?? "";
  const attachmentId = url.searchParams.get("attachmentId");
  const linkIndexValue = url.searchParams.get("linkIndex");
  const linkIndex = linkIndexValue === null || !/^\d{1,2}$/u.test(linkIndexValue) ? undefined : Number(linkIndexValue);
  if (!reportMonth.success || year < 2000 || year > 2100 || !messageId || (attachmentId === null) === (linkIndexValue === null)) {
    return jsonError("Érvénytelen számlaforrás.", 400);
  }
  if (linkIndexValue !== null && linkIndex === undefined) return jsonError("Érvénytelen számlalink.", 400);

  const referenceResult = gmailDocumentReferenceSchema.safeParse({
    reportMonth: reportMonth.data,
    messageId,
    fileName: "szamla.pdf",
    ...(attachmentId !== null ? { attachmentId } : { linkIndex }),
  });
  if (!referenceResult.success) return jsonError("Érvénytelen számlaforrás.", 400);

  try {
    const access = await getGoogleAccess(session.user);
    const { bytes, context } = await fetchGmailInvoicePdf(access.accessToken, referenceResult.data);
    const [monthYear, monthNumber] = context.reportMonth.split("-").map(Number);
    if (!context.sentAt || !isDateInMonthWindow(context.sentAt, monthYear, monthNumber)) {
      return jsonError("A dokumentum nem ehhez a kimutatási hónaphoz tartozik.", 404);
    }
    await parsePdfDocument(bytes);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": safeInlineName(context.fileName),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; frame-ancestors 'self'",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    const fallback = error && typeof error === "object" && "name" in error && error.name === "GmailAccessError"
      ? getSafeInvoiceErrorMessage(error, "A Gmail-hozzáférés nem olvasható.")
      : getSafeInvoiceErrorMessage(error, "A számlaforrás nem érhető el. Próbáld újra, vagy töltsd fel kézzel a PDF-et.");
    return jsonError(fallback, 404);
  }
}
