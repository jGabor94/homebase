import "server-only";
import type { SummaryExportFormat } from "../types";

export interface SummaryEmailAttachment {
  bytes: Buffer;
  filename: string;
  format: SummaryExportFormat;
}

const encodeMimeBody = (value: string) => Buffer.from(value, "utf8").toString("base64").replace(/.{1,76}/gu, "$&\r\n").trimEnd();

const encodeSubject = (subject: string) => {
  const words: string[] = [];
  let chunk = "";
  for (const character of subject) {
    if (Buffer.byteLength(chunk + character, "utf8") > 42) {
      words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
      chunk = character;
    } else {
      chunk += character;
    }
  }
  if (chunk) words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
  return words.join("\r\n ");
};

export const buildSummaryEmailRaw = (input: {
  mailboxEmail: string;
  recipient: string;
  subject: string;
  body: string;
  attachment: SummaryEmailAttachment;
  boundary: string;
}) => {
  const { mailboxEmail, recipient, subject, body, attachment, boundary } = input;
  const rawMessage = [
    `From: ${mailboxEmail}`,
    `To: ${recipient}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(body),
    `--${boundary}`,
    `Content-Type: ${attachment.format === "pdf" ? "application/pdf" : attachment.format === "png" ? "image/png" : "text/plain"}; name=\"${attachment.filename}\"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename=\"${attachment.filename}\"`,
    "",
    attachment.bytes.toString("base64").replace(/.{1,76}/gu, "$&\r\n").trimEnd(),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return Buffer.from(rawMessage, "utf8").toString("base64url");
};

export const sendSummaryMessage = async (input: {
  accessToken: string;
  mailboxEmail: string;
  recipient: string;
  subject: string;
  body: string;
  attachment: SummaryEmailAttachment;
}) => {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildSummaryEmailRaw({ ...input, boundary: `monthly-expenses-${crypto.randomUUID()}` }) }),
  });
  return response;
};
