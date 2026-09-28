import { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

const protectedRoutes = [

] as string[] // example: /admin

export const authConfig = {
    providers: [],
    trustHost: true,
    callbacks: {
        authorized({ auth, request }) {

            if (!auth && protectedRoutes.some(path => request.nextUrl.pathname.startsWith(path))) {
                return NextResponse.redirect(new URL('/login', request.url))
            }

            if (auth && request.nextUrl.pathname === "/login") {
                return NextResponse.redirect(new URL('/home', request.url))
            }
            return true
        },
    }


} satisfies NextAuthConfig;
