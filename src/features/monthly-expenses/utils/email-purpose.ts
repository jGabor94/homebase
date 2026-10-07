const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().replace(/\s+/gu, " ").trim();

const invoiceSignals = [
  /\b(?:uj|elkeszult|kiallitott)\b.{0,60}\b[a-z]*szamla/u,
  /\b[a-z]*szamla\S*\b.{0,40}\b(?:keszult|elkeszult|kiallitva)/u,
  /\b(?:e-szamla|szamlaertesit|szamla ertesit)/u,
  /\b(?:new invoice|invoice (?:issued|available)|billing notification)\b/u,
];

const notificationSignals = [
  /\b(?:sikeres|sikeresen)\b.{0,50}\b(?:szamlafizetes|fizetes|befizetes|tranzakcio)/u,
  /\b(?:fizetes|befizetes|tranzakcio)\S*\b.{0,50}\b(?:sikeres|sikeresen|megtortent|visszaigazolas)/u,
  /\b(?:payment (?:confirmation|receipt|successful|received)|successful payment|receipt for (?:your )?payment)\b/u,
];

const reminderSignal = /\b(?:emlekezteto|felszolitas|reminder|payment demand)\b/u;

const matches = (text: string, signals: RegExp[]) => signals.some((signal) => signal.test(text));

export const classifyInvoiceEmail = (subject: string, body: string): "invoice" | "notification" | "uncertain" => {
  const title = normalize(subject);
  const invoiceTitle = matches(title, invoiceSignals);
  const notificationTitle = matches(title, notificationSignals) || reminderSignal.test(title);
  if (invoiceTitle && notificationTitle) return "uncertain";
  if (invoiceTitle) return "invoice";

  // Only inspect the introduction: quoted history and payment boilerplate are not the message's purpose.
  const introduction = normalize(body
    .replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/giu, " ")
    .replace(/<blockquote\b[\s\S]*/iu, " ")
    .split(/(?:\r?\n)\s*(?:>|On .+wrote:|.*irta:)/iu)[0]
    .replace(/<[^>]*>/gu, " ").replace(/&(?:nbsp|#160);/giu, " ")).slice(0, 600);
  const invoiceBody = matches(introduction, invoiceSignals);
  const notificationBody = matches(introduction, notificationSignals);
  if (notificationTitle) return invoiceBody ? "uncertain" : "notification";
  if (invoiceBody && notificationBody) return "uncertain";
  if (invoiceBody) return "invoice";
  if (notificationBody) return "notification";
  return "uncertain";
};
