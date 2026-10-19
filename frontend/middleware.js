import { NextResponse } from "next/server";

export function middleware(request) {
  const token = request.cookies.get("lm_access")?.value;
  const { pathname } = request.nextUrl;
  const isProtectedPage = pathname.startsWith("/student") || pathname.startsWith("/teacher") || pathname.startsWith("/admin");

  if (isProtectedPage && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    // Preserve the exact protected URL so shared course links can resume
    // after login or registration instead of sending visitors to a dashboard.
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search || ""}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"]
};
