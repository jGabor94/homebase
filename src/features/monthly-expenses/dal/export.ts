"use server";

import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { z } from "zod";
import { getGoogleAccess, GmailAccessError } from "../lib/google-access";
import { sendSummaryMessage } from "../lib/summary-email";
import { isGmailReconnectRequired } from "../lib/errors";
import { createSummaryEmailContent, SUMMARY_EMAIL_RECIPIENT } from "../utils/summary-export";
import { sendSummaryEmailSchema } from "../zod/summary-export";

const maxAttachmentBytes = 2 * 1024 * 1024;
const extensionByFormat = { pdf: "pdf", png: "png", txt: "txt" } as const;
const sendSummary = Dal.create({ cache: false })
  .$Input<[z.infer<typeof sendSummaryEmailSchema>]>()
  .schema({ input: z.tuple([sendSummaryEmailSchema]) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "import" })
  .operation(async ({ user, input }) => {
    const payload = input[0];
    try {
      const access = await getGoogleAccess(user, { send: true });
      const bytes = Buffer.from(payload.attachmentBase64, "base64");
      if (!bytes.length || bytes.length > maxAttachmentBytes || bytes.toString("base64") !== payload.attachmentBase64) {
        return createErrorReturn({ type: "attachment-too-large", message: "A csatolmány túl nagy az e-mailhez. Töltsd le a fájlt, és küldd el kézzel." });
      }
      const validSignature = payload.format === "pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
        : payload.format === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.toString("utf8").startsWith("Havi közös költségkimutatás");
      if (!validSignature) return createErrorReturn({ type: "invalid-attachment", message: "A csatolmány nem a kiválasztott formátumú fájl." });

      const filename = `havi-kimutatas-${payload.reportMonth}.${extensionByFormat[payload.format]}`;
      const monthLabel = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" })
        .format(new Date(`${payload.reportMonth}-01T12:00:00Z`));
      const { subject, body } = createSummaryEmailContent(monthLabel, payload.total, payload.half);
      const response = await sendSummaryMessage({
        accessToken: access.accessToken,
        mailboxEmail: access.mailboxEmail,
        recipient: SUMMARY_EMAIL_RECIPIENT,
        subject,
        body,
        attachment: { bytes, filename, format: payload.format },
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const missingScope = isGmailReconnectRequired(response.status, result);
        return createErrorReturn({
          type: missingScope ? "gmail-send-permission-required" : "gmail-send-error",
          message: missingScope ? "A Gmail-küldési engedély hiányzik. Kapcsold össze újra a fiókodat a küldés engedélyezéséhez." : "Az e-mailt most nem sikerült elküldeni. Próbáld újra később.",
        });
      }
      return createSuccessReturn({ sent: true });
    } catch (error) {
      if (error instanceof GmailAccessError) {
        return createErrorReturn({ type: error.requiresReconnect ? "gmail-send-permission-required" : "gmail-access-error", message: error.message });
      }
      return createErrorReturn({ type: "gmail-send-error", message: "Az e-mail küldése időtúllépés vagy hálózati hiba miatt nem erősíthető meg. Ellenőrizd az Elküldött levelek mappát, mielőtt újrapróbálod." });
    }
  });

export const sendSummaryEmail = async (payload: z.infer<typeof sendSummaryEmailSchema>) => {
  try {
    const result = await sendSummary(payload);
    if (result?.success) return { success: true as const };
    const error = result && "error" in result ? result.error : null;
    const type = error && "type" in error && typeof error.type === "string" ? error.type : "gmail-send-error";
    const message = error && "message" in error && typeof error.message === "string" ? error.message : "Az e-mailt most nem sikerült elküldeni. Próbáld újra később.";
    return { success: false as const, error: { type, message } };
  } catch {
    return { success: false as const, error: { type: "gmail-send-error", message: "Az e-mailt most nem sikerült elküldeni. Próbáld újra később." } };
  }
};
