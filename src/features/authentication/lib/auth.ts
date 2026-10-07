import { db } from "@/drizzle/db"
import { accountsTable, usersTable } from "@/drizzle/schema"
import { and, eq } from "drizzle-orm"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { authConfig } from "./auth.config"
import { customAdapter } from "./NextAuth_adapter"

export const { handlers: { GET, POST }, auth, signIn, signOut, unstable_update } = NextAuth({
    ...authConfig,
    adapter: customAdapter,
    session: {
        strategy: "jwt",
    },
    secret: process.env.AUTH_SECRET,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        signIn: async ({ account, profile }) => {
            if (account?.provider === "google" && profile?.email_verified !== true) return false
            return true
        },
        jwt: async ({ token, user, account, trigger }) => {
            // Session updates are client input; reload identity instead of trusting roles from the browser.
            let userData = user
            if (trigger === "update" && token.userData?.id) {
                const [storedUser] = await db.select().from(usersTable).where(eq(usersTable.id, token.userData.id))
                if (!storedUser) return null
                userData = storedUser
            }
            if (user && account?.provider === "google") {
                try {
                    await db.update(accountsTable).set({
                    access_token: account.access_token,
                    ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
                    expires_at: account.expires_at,
                    scope: account.scope,
                    token_type: account.token_type,
                }).where(and(
                    eq(accountsTable.userId, user.id),
                    eq(accountsTable.provider, "google"),
                    eq(accountsTable.providerAccountId, account.providerAccountId),
                    ))
                } catch {
                    // Database errors can contain OAuth tokens in SQL parameters.
                    throw new Error("A Google-hozzáférés frissítése nem tárolható.")
                }
            }
            if (userData && !userData.email) return null
            if (userData) return {
                ...token, userData: {
                    id: userData.id,
                    username: userData.username,
                    name: userData.name ?? "",
                    image: userData.image ?? "",
                    roles: userData.roles ?? [],
                    email: userData.email ?? "",
                }
            }
            return token
        },
        session: async ({ session, token }) => ({ ...session, user: { ...session.user, ...token.userData } })
    },
})
