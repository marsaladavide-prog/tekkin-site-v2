import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // "/@slug" -> "/u/slug"
  if (pathname.startsWith("/@")) {
    const slug = pathname.slice(2);
    if (!slug) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = `/u/${slug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // tutte le route, esclusi asset Next e api
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
