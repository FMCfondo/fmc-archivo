import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data:;
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const path = nextUrl.pathname;
  const isLoggedIn = !!session?.user;
  const isLoginPage = path === "/login";
  const isCuenta = path.startsWith("/cuenta");

  function conCabeceras(res: NextResponse) {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  if (!isLoggedIn && !isLoginPage) {
    return conCabeceras(NextResponse.redirect(new URL("/login", nextUrl)));
  }
  if (isLoggedIn && isLoginPage) {
    return conCabeceras(NextResponse.redirect(new URL("/carpetas", nextUrl)));
  }
  if (isLoggedIn && session.user.debeCambiarPassword && !isCuenta) {
    return conCabeceras(NextResponse.redirect(new URL("/cuenta", nextUrl)));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  return conCabeceras(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/auth).*)"],
};
