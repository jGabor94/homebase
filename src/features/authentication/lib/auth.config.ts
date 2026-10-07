import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

export const authConfig = {
  providers: [],
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");

      if (!auth?.user && isAppRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (auth?.user && pathname === "/login") {
        return NextResponse.redirect(new URL("/app", request.url));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
