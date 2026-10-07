"use server";

import { signIn } from "@/features/authentication/lib/auth";
import { Dal } from "@/lib/dal";
import { createErrorReturn } from "@/lib/dal/types";
import { isRedirectError } from "next/dist/client/components/redirect-error";

const connect = Dal.create({ cache: false }).authenticate()
  .authorize({ resource: "monthlyExpenses", action: "import" })
  .operation(async ({ user }) => {
  const expectedEmail = (process.env.MONTHLY_EXPENSES_GMAIL_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL)?.trim().toLowerCase();
  if (!expectedEmail || user.email?.toLowerCase() !== expectedEmail) {
    return createErrorReturn({ type: "gmail-owner-required", message: "A Gmail-csatlakoztatást csak a kijelölt tulajdonos indíthatja." });
  }
  try {
    await signIn("google", { redirectTo: "/monthly-expenses" }, {
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline", prompt: "consent", login_hint: expectedEmail,
      include_granted_scopes: "true",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return createErrorReturn({ type: "gmail-connect-failed", message: "A Google-csatlakoztatás most nem indítható." });
  }
});

export const connectGmail = async () => {
  const result = await connect();
  if (result && !result.success) throw new Error("A Gmail-csatlakoztatás nem indítható. Ellenőrizd a bejelentkezést és a saját postafiók beállítását.");
};
