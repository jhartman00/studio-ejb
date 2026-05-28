import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName } from "@/lib/auth-constants";

// Edge middleware — no Node crypto. We only check the cookie exists
// and is well-formed (two base64url segments). Full HMAC verification
// happens in the Node runtime via requireAdmin() at the top of every
// admin Server Action and route handler.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login route is excluded so users without a cookie can log in.
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const tok = req.cookies.get(adminCookieName())?.value;

  if (!tok || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tok)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
