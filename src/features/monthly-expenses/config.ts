export const INVOICE_CATEGORIES = [
  "gas",
  "electricity",
  "water",
  "waste",
  "other",
] as const;

export const GMAIL_CATEGORIES = ["gas", "electricity", "water", "waste"] as const;

export const DOCUMENT_TYPES = ["invoice", "credit", "correction", "cancellation"] as const;

export const INVOICE_FIELDS = [
  "providerName",
  "category",
  "invoiceNumber",
  "amountMinor",
  "currency",
  "dueDate",
  "billingPeriod",
  "issuedAt",
  "consumptionQuantity",
  "consumptionUnit",
] as const;

export const CONSUMPTION_UNITS = ["m3", "kWh", "MJ", "kg", "l", "piece"] as const;

export const INVOICE_ISSUES = [
  "missing-provider",
  "missing-category",
  "missing-amount",
  "missing-due-date",
  "missing-invoice-number",
  "missing-period",
  "missing-issued-at",
  "missing-currency",
  "foreign-currency",
  "source-unverified",
  "conflict",
  "possible-duplicate",
  "correction-unresolved",
  "unreadable",
] as const;

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
export const MAX_DOCUMENT_TEXT_LENGTH = 120_000;
export const MAX_GMAIL_RESULTS = 300;
export const GMAIL_PAGE_SIZE = 100;
export const IMPORT_CONCURRENCY = 2;
export const PDF_TIMEOUT_MS = 20_000;
export const DOWNLOAD_TIMEOUT_MS = 15_000;
export const MAX_DOWNLOAD_REDIRECTS = 3;
export const MAX_INVOICE_DOWNLOAD_BYTES = 3 * 1024 * 1024;

export const INVOICE_CATEGORY_LABELS = {
  gas: "Gáz",
  electricity: "Villany",
  water: "Víz",
  waste: "Hulladék",
  other: "Egyéb számla",
} as const;

export const INVOICE_ISSUE_LABELS = {
  "missing-provider": "A szolgáltató nem olvasható.",
  "missing-category": "A szolgáltatás típusa ellenőrzést igényel.",
  "missing-amount": "A fizetendő bruttó összeg nem olvasható.",
  "missing-due-date": "A fizetési határidő nem olvasható.",
  "missing-invoice-number": "A számlaszám nem olvasható.",
  "missing-period": "A számlázási időszak nincs feltüntetve vagy nem olvasható.",
  "missing-issued-at": "A számla kelte nincs feltüntetve vagy nem olvasható.",
  "missing-currency": "A pénznem nem olvasható, ezért az összeg nincs beleszámítva.",
  "foreign-currency": "Nem forintos számla; az összeg nincs beleszámítva.",
  "source-unverified": "A kinyert adat forrása ellenőrzést igényel.",
  conflict: "Eltérő forrásadat érkezett; nézd át a számlát.",
  "possible-duplicate": "Lehetséges ismétlődés; mindkét sort ellenőrizd.",
  "correction-unresolved": "A módosító számla nem számít bele, amíg a kapcsolatát nem ellenőrzöd.",
  unreadable: "A dokumentum nem olvasható számlaként.",
} as const;
