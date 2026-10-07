import "server-only";
import type { GmailCandidate, GmailCollectionResult, GmailDocumentReference } from "../types";
import { GMAIL_PAGE_SIZE, MAX_GMAIL_RESULTS, MAX_UPLOAD_BYTES } from "../config";
import { getBudapestMonthWindow, isDateInMonthWindow, parseValidMailDate } from "../utils/dates";
import { invoiceMonthKeySchema } from "../zod/schema";
import { classifyInvoiceEmail } from "../utils/email-purpose";
import { InvoiceProcessingError } from "./errors";
import { downloadInvoicePdfFromAllowedUrl, extractAllowedInvoiceLinks } from "./invoice-download";
import type { PdfInvoiceSourceContext } from "./extract-invoice";

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
}
interface MessageDocument {
  candidate: GmailCandidate;
  remoteAttachmentId?: string;
  inlineData?: string;
  url?: string;
}

const normalizeText = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const safeFileName = (value: string) => value.replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 200) || "szamla.pdf";
const monthParts = (reportMonth: string) => {
  invoiceMonthKeySchema.parse(reportMonth);
  const [year, month] = reportMonth.split("-").map(Number);
  getBudapestMonthWindow(year, month);
  return { year, month };
};

const gmailJson = async <T,>(accessToken: string, path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new InvoiceProcessingError(response.status === 401 || response.status === 403 ? "gmail-access-denied" : "gmail-api-error",
        response.status === 401 || response.status === 403
          ? "A Gmail-hozzáférés nem használható. Csatlakoztasd újra a saját fiókodat."
          : "A Gmail lekérése nem sikerült. Próbáld újra később.");
    }
    if (!response.body) throw new Error("empty-response");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8 * 1024 * 1024) {
          await reader.cancel();
          throw new InvoiceProcessingError("gmail-response-too-large", "A Gmail-üzenet túl nagy. Töltsd fel kézzel a számla PDF-jét.");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (error) {
    if (error instanceof InvoiceProcessingError) throw error;
    throw new InvoiceProcessingError("gmail-request-failed", "A Gmail lekérése megszakadt vagy nem adott olvasható választ.");
  }
};

const decodeBodyText = (part: GmailPart) => {
  if (!part.body?.data) return "";
  const contentType = part.headers?.find(({ name }) => name.toLowerCase() === "content-type")?.value ?? "";
  const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/iu)?.[1] ?? "utf-8";
  try { return new TextDecoder(charset).decode(Buffer.from(part.body.data, "base64url")); }
  catch { return new TextDecoder().decode(Buffer.from(part.body.data, "base64url")); }
};

const getMessageDocuments = (message: GmailMessage, reportMonth: string) => {
  const { year, month } = monthParts(reportMonth);
  const payload = message.payload;
  const headers = payload?.headers ?? [];
  if (message.labelIds?.some((label) => ["SENT", "DRAFT"].includes(label))) {
    return { documents: [] as MessageDocument[] };
  }
  const sentAt = parseValidMailDate(headers.find(({ name }) => name.toLowerCase() === "date")?.value);
  if (sentAt && !isDateInMonthWindow(sentAt, year, month)) return { documents: [] as MessageDocument[] };
  const subject = headers.find(({ name }) => name.toLowerCase() === "subject")?.value ?? "";
  const receivedTimestamp = Number(message.internalDate);
  const receivedAt = message.internalDate && Number.isFinite(receivedTimestamp)
    && !Number.isNaN(new Date(receivedTimestamp).getTime()) ? new Date(receivedTimestamp).toISOString() : null;
  const documents: MessageDocument[] = [];
  const textBodies: string[] = [];
  const walk = (part: GmailPart, path: string) => {
    const isPdf = part.mimeType?.toLowerCase() === "application/pdf" || part.filename?.toLowerCase().endsWith(".pdf");
    if (isPdf && (part.body?.attachmentId || part.body?.data)) {
      // Google's download token can change on each read; identify the document by its MIME part.
      const attachmentId = part.body.attachmentId ? `part:${part.partId || path}` : `inline:${path}`;
      documents.push({ candidate: {
        id: `${message.id}:attachment:${attachmentId}`, messageId: message.id,
        fileName: safeFileName(part.filename ?? "szamla.pdf"), kind: "attachment", attachmentId,
        sentAt, receivedAt,
      }, ...(part.body.attachmentId ? { remoteAttachmentId: part.body.attachmentId } : { inlineData: part.body.data }) });
    }
    if (part.mimeType?.toLowerCase().startsWith("text/")) textBodies.push(decodeBodyText(part));
    part.parts?.forEach((child, index) => walk(child, `${path}.${index}`));
  };
  if (payload) walk(payload, "0");
  const sender = headers.find(({ name }) => name.toLowerCase() === "from")?.value ?? "";
  const text = normalizeText(`${subject}\n${sender}\n${textBodies.join("\n").replace(/<[^>]*>/gu, " ")}`);
  if (!/\b(mvm|alfoldviz|mohu)\b/u.test(text) || !/(szamla|invoice)/u.test(text)) return { documents: [] as MessageDocument[] };
  // Prefer one MIME representation; duplicating plain/HTML bodies can introduce conflicting signals.
  const purpose = classifyInvoiceEmail(subject, textBodies[0] ?? "");
  if (purpose === "notification") return { documents: [] as MessageDocument[] };
  if (!sentAt) return { documents: [] as MessageDocument[], warning: "Egy számlajelölt kiküldési dátuma hiányzik vagy bizonytalan; kézi ellenőrzés szükséges." };
  const links = extractAllowedInvoiceLinks(textBodies);
  links.forEach((url, linkIndex) => documents.push({ url, candidate: {
    id: `${message.id}:link:${linkIndex}`, messageId: message.id, fileName: `szamla-${linkIndex + 1}.pdf`,
    kind: "link", linkIndex, sentAt, receivedAt,
  } }));
  return {
    documents,
    ...(documents.length === 0 ? { warning: purpose === "invoice"
      ? "Egy számlaértesítőhöz nincs elérhető PDF-melléklet vagy engedélyezett közvetlen letöltőlink. PDF-feltöltéssel pótolhatod."
      : "Egy lehetséges számlalevélben nincs elérhető PDF; nem dönthető el biztosan, hogy új számláról szól-e. Ellenőrizd a Gmailben." } : {}),
  };
};

export const collectGmailDocuments = async (accessToken: string, reportMonth: string): Promise<GmailCollectionResult> => {
  const { year, month } = monthParts(reportMonth);
  const { afterSeconds, beforeSeconds } = getBudapestMonthWindow(year, month);
  const query = `in:anywhere -in:sent -in:drafts after:${afterSeconds} before:${beforeSeconds} {MVM ALFÖLDVÍZ ALFOLDVIZ MOHU} {számla szamla számlaértesítő szamlaertesito invoice}`;
  const ids = new Set<string>();
  const seenTokens = new Set<string>();
  const warnings: string[] = [];
  let complete = true;
  let pageToken: string | undefined;
  do {
    try {
      const params = new URLSearchParams({ q: query, maxResults: String(GMAIL_PAGE_SIZE), includeSpamTrash: "true" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmailJson<{ messages?: { id: string }[]; nextPageToken?: string }>(accessToken, `messages?${params}`);
      if (page.messages && !Array.isArray(page.messages)) throw new Error("invalid-page");
      for (const message of page.messages ?? []) {
        if (typeof message.id !== "string" || !/^[\w-]{1,200}$/u.test(message.id)) throw new Error("invalid-message-id");
        if (ids.size >= MAX_GMAIL_RESULTS && !ids.has(message.id)) { complete = false; break; }
        ids.add(message.id);
      }
      pageToken = page.nextPageToken;
      if (pageToken && (seenTokens.has(pageToken) || ids.size >= MAX_GMAIL_RESULTS)) { complete = false; break; }
      if (pageToken) seenTokens.add(pageToken);
    } catch {
      complete = false;
      warnings.push("A Gmail-keresés nem minden oldala olvasható. A sikeresen beolvasott dokumentumokat megtartottuk.");
      break;
    }
  } while (pageToken);
  if (!complete && ids.size >= MAX_GMAIL_RESULTS) warnings.push("A keresés elérte a 300 levéles korlátot; az eredmény részleges.");
  const candidates: GmailCandidate[] = [];
  const messages = [...ids];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < messages.length) {
      const messageId = messages[nextIndex++];
      try {
        const message = await gmailJson<GmailMessage>(accessToken, `messages/${encodeURIComponent(messageId)}?format=full`);
        if (message.id !== messageId) throw new Error("invalid-message");
        const result = getMessageDocuments(message, reportMonth);
        candidates.push(...result.documents.map(({ candidate }) => candidate));
        if (result.warning) warnings.push(result.warning);
      } catch {
        complete = false;
        warnings.push("Egy Gmail-levél nem olvasható; a gyűjtés részleges.");
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return { candidates, complete, warnings: [...new Set(warnings)], searchedMessages: ids.size };
};

export const fetchGmailInvoicePdf = async (accessToken: string, reference: GmailDocumentReference) => {
  const message = await gmailJson<GmailMessage>(accessToken, `messages/${encodeURIComponent(reference.messageId)}?format=full`);
  if (message.id !== reference.messageId) throw new InvoiceProcessingError("invalid-source", "A számlaforrás nem azonosítható.");
  const result = getMessageDocuments(message, reference.reportMonth);
  const document = result.documents.find(({ candidate }) => reference.attachmentId
    ? candidate.attachmentId === reference.attachmentId : candidate.linkIndex === reference.linkIndex);
  if (!document || !document.candidate.sentAt) {
    throw new InvoiceProcessingError("invalid-source", "A dokumentum nem ehhez a hónaphoz tartozó, támogatott eredeti számlalevélből származik.");
  }
  let bytes: Uint8Array;
  if (document.url) bytes = await downloadInvoicePdfFromAllowedUrl(document.url);
  else {
    const data = document.inlineData ?? (await gmailJson<{ data?: string; size?: number }>(accessToken,
      `messages/${encodeURIComponent(reference.messageId)}/attachments/${encodeURIComponent(document.remoteAttachmentId!)}`)).data;
    if (typeof data !== "string" || data.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) {
      throw new InvoiceProcessingError("attachment-invalid", "A PDF-melléklet hiányzik vagy nagyobb a 3 MiB-os korlátnál.");
    }
    bytes = new Uint8Array(Buffer.from(data, "base64url"));
    if (!bytes.length || bytes.byteLength > MAX_UPLOAD_BYTES) throw new InvoiceProcessingError("attachment-invalid", "A PDF-melléklet nem olvasható vagy túl nagy.");
  }
  const context: PdfInvoiceSourceContext = {
    kind: "gmail", reportMonth: reference.reportMonth, messageId: reference.messageId,
    fileName: document.candidate.fileName,
    ...(document.candidate.attachmentId ? { attachmentId: document.candidate.attachmentId } : { linkIndex: document.candidate.linkIndex }),
    sentAt: document.candidate.sentAt, receivedAt: document.candidate.receivedAt,
  };
  return { bytes, context };
};
