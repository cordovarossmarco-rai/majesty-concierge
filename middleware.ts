import { NextResponse, type NextRequest } from "next/server";

/*
  A shared password in a cookie, checked on every /admin request.

  This is not real authentication and the README says so plainly. There are no accounts, no
  per-person audit trail, and one password for everybody, so it cannot tell you who changed a lead's
  status. What it does do is keep guest enquiries off the open internet while the prototype is
  hosted somewhere public, which is the actual risk during an evaluation.

  Real sign-in, roles and an audit trail are described in the README as production work.
*/
export function middleware(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;

  // Refusing everyone is the right failure when the gate is not configured. Letting everyone in
  // because a variable is missing is how staff screens end up publicly readable.
  if (!expected) {
    return new NextResponse("The admin area is not configured. Set ADMIN_PASSWORD.", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }

  if (request.cookies.get("majesty_admin")?.value === expected) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*"] };
