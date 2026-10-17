import { NextResponse } from "next/server";

export function middleware(request) {
  const token = request.cookies.get("lm_access")?.value;
  const { pathname } = request.nextUrl;
  const isProtectedPage = pathname.startsWith("/student") || pathname.startsWith("/teacher") || pathname.startsWith("/admin");

  if (isProtectedPage && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"]
};
