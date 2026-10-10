import "server-only";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/drizzle/db";
import { accountsTable } from "@/drizzle/schema";
import { getGmailAccessErrorMessage, isGmailReconnectRequired } from "./errors";

const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";

export class GmailAccessError extends Error {
  constructor(message: string, readonly requiresReconnect = false) {
    super(message);
    this.name = "GmailAccessError";
  }
}

export const getGoogleAccess = async (
  user: Session["user"],
  options: { send?: boolean } = {},
): Promise<{ accessToken: string; mailboxEmail: string }> => {
  const expectedEmail = (process.env.MONTHLY_EXPENSES_GMAIL_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL)?.trim().toLowerCase();
  if (!expectedEmail) throw new GmailAccessError("A saját Gmail-postafiók még nincs kijelölve az alkalmazásban.");
  if (!user.id || user.email?.trim().toLowerCase() !== expectedEmail) {
    throw new GmailAccessError("Ezt a postafiókot csak a kijelölt tulajdonosa olvashatja.");
  }
  const [account] = await db.select().from(accountsTable).where(and(
    eq(accountsTable.userId, user.id), eq(accountsTable.provider, "google"),
  )).limit(1);
  const requiredScopes = options.send ? [gmailScope, gmailSendScope] : [gmailScope];
  if (!account || !requiredScopes.every((scope) => account.scope?.split(/\s+/).includes(scope))) {
    throw new GmailAccessError(options.send
      ? "A levélküldéshez külön Gmail-küldési engedély szükséges."
      : "Csatlakoztasd a Gmail-fiókodat olvasási engedéllyel.", true);
  }
  const accountFilter = and(
    eq(accountsTable.userId, user.id), eq(accountsTable.provider, "google"),
    eq(accountsTable.providerAccountId, account.providerAccountId),
  );

  const refresh = async () => {
    if (!account.refresh_token || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new GmailAccessError("A Gmail-hozzáférés lejárt. Csatlakoztasd újra a saját fiókodat.", true);
    }
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: account.refresh_token, grant_type: "refresh_token",
        }),
      });
    } catch {
      throw new GmailAccessError("A Google jelenleg nem érhető el. Próbáld újra később.");
    }
    if (!response.ok) throw new GmailAccessError("A Gmail-engedély megújítása nem sikerült. Próbáld újra később, vagy csatlakoztasd újra a fiókodat.", [400, 401, 403].includes(response.status));
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("access_token" in value) || typeof value.access_token !== "string" ||
      !("expires_in" in value) || typeof value.expires_in !== "number" || value.expires_in <= 0) {
      throw new GmailAccessError("A Google nem adott használható hozzáférést. Csatlakoztasd újra a fiókodat.");
    }
    const scope = "scope" in value && typeof value.scope === "string" ? value.scope : account.scope;
    if (!requiredScopes.every((required) => scope?.split(/\s+/).includes(required))) {
      throw new GmailAccessError(options.send
        ? "A Gmail-küldési engedély hiányzik. Csatlakoztasd újra a fiókodat a küldés engedélyezéséhez."
        : "A Gmail olvasási engedélye hiányzik. Csatlakoztasd újra a fiókodat.", true);
    }
    try {
      await db.update(accountsTable).set({
      access_token: value.access_token,
      expires_at: Math.floor(Date.now() / 1000) + value.expires_in,
      scope,
      ...("refresh_token" in value && typeof value.refresh_token === "string" && value.refresh_token
        ? { refresh_token: value.refresh_token } : {}),
      }).where(accountFilter);
    } catch {
      throw new GmailAccessError("A Gmail-hozzáférés megújítása nem tárolható. Próbáld újra később.");
    }
    return value.access_token;
  };

  let accessToken = account.access_token;
  if (!accessToken || !account.expires_at || account.expires_at * 1000 <= Date.now() + 60_000) accessToken = await refresh();
  const getProfile = () => fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  let profile: Response;
  try {
    profile = await getProfile();
    if (profile.status === 401) { accessToken = await refresh(); profile = await getProfile(); }
  } catch (error) {
    if (error instanceof GmailAccessError) throw error;
    throw new GmailAccessError("A Gmail jelenleg nem érhető el. A kézi számlafelvitel tovább használható.");
  }
  if (!profile.ok) {
    const body: unknown = await profile.json().catch(() => null);
    throw new GmailAccessError(getGmailAccessErrorMessage(profile.status, body), isGmailReconnectRequired(profile.status, body));
  }
  const result: unknown = await profile.json();
  if (!result || typeof result !== "object" || !("emailAddress" in result) ||
    typeof result.emailAddress !== "string" || result.emailAddress.toLowerCase() !== expectedEmail) {
    throw new GmailAccessError("A csatlakoztatott postafiók nem egyezik a kijelölt saját Gmail-fiókkal.");
  }
  return { accessToken, mailboxEmail: result.emailAddress };
};
