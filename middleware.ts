// middleware.ts (ROOT)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // match: /@handle
  if (pathname.startsWith("/@")) {
    const handle = pathname.slice(2);
    if (handle.length > 0) {
      const url = req.nextUrl.clone();
      url.pathname = `/u/${handle}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
