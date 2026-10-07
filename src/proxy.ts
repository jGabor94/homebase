import { auth } from "@/features/authentication/lib/auth";

export { auth as proxy };

export const config = {
  matcher: ["/app/:path*", "/login"],
};
