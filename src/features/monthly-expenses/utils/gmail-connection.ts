import type { StoredGmailConnection } from "../types";

export const hasStoredGmailConnection = (account: StoredGmailConnection, nowMs = Date.now()) => Boolean(
  account?.scope?.split(/\s+/u).includes("https://www.googleapis.com/auth/gmail.readonly")
  && (account.hasRefreshToken || (account.hasAccessToken && account.expiresAt && account.expiresAt * 1000 > nowMs + 60_000)),
);
