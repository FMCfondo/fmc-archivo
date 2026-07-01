import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;

  // Next.js no aplica el nonce a sus propios scripts (verificado: no aparece en el HTML
  // servido), así que un CSP nonce+strict-dynamic estricto rompería la hidratación de la
  // app. Usamos 'unsafe-inline' para script/style (permite los scripts propios de Next),
  // mientras seguimos bloqueando orígenes externos, iframes, plugins y mixed content.
  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
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

  return conCabeceras(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/auth).*)"],
};
