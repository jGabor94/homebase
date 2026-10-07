export class InvoiceProcessingError extends Error {
  readonly code: string;

  constructor(code: string, publicMessage: string) {
    super(publicMessage);
    this.name = "InvoiceProcessingError";
    this.code = code;
  }
}

export const getSafeInvoiceErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof InvoiceProcessingError) return error.message;
  if (error instanceof Error && error.name === "GmailAccessError") return error.message;
  return fallback;
};

const getGoogleErrorReasons = (body: unknown) => {
  const error = body && typeof body === "object" && "error" in body ? body.error : null;
  const reasons = new Set<string>();
  if (error && typeof error === "object") {
    const fields = error as Record<string, unknown>;
    for (const key of ["errors", "details"] as const) {
      const entries = fields[key];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry && typeof entry === "object" && "reason" in entry && typeof entry.reason === "string") {
          reasons.add(entry.reason);
        }
      }
    }
  }
  return reasons;
};

export const isGmailReconnectRequired = (status: number, body: unknown) => {
  const reasons = getGoogleErrorReasons(body);
  return status === 401 || reasons.has("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || reasons.has("insufficientPermissions");
};

export const getGmailAccessErrorMessage = (status: number, body: unknown): string => {
  const reasons = getGoogleErrorReasons(body);
  if (reasons.has("SERVICE_DISABLED") || reasons.has("accessNotConfigured")) {
    return "A Gmail API nincs engedélyezve a Google Cloud projektben. Az OAuth-kliens projektjében nyisd meg az APIs & Services → Library → Gmail API oldalt, és kattints az Enable gombra. Ezután próbáld újra az importot.";
  }
  if (reasons.has("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || reasons.has("insufficientPermissions")) {
    return "A Google nem engedélyezte a Gmail olvasását. Kattints a Gmail összekapcsolása gombra, és engedélyezd a levelek olvasását a Google jóváhagyási képernyőjén.";
  }
  if (reasons.has("domainPolicy")) {
    return "A Google Workspace rendszergazdai szabálya tiltja a Gmail-hozzáférést. A fiók rendszergazdájának engedélyeznie kell az alkalmazást.";
  }
  if (status === 429 || ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded", "RATE_LIMIT_EXCEEDED"].some((reason) => reasons.has(reason))) {
    return "A Gmail lekérdezési kerete elfogyott vagy túl sok kérés érkezett. Próbáld újra később.";
  }
  if (status === 401) return "A Google elutasította a Gmail-hozzáférést a megújítás után is. Csatlakoztasd újra a fiókodat.";
  if (status >= 500) return "A Gmail szolgáltatás átmenetileg hibát jelez. Próbáld újra később.";
  return `A Gmail nem olvasható (HTTP ${status}). Ellenőrizd a Gmail API és az olvasási engedély beállítását.`;
};
