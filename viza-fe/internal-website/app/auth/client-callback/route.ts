import { NextRequest, NextResponse } from "next/server";

/* Older applicant links (and Supabase templates) may still point here. This
   route used to be an unchecked copy of a staff callback: it read `user`
   before declaring it, so every PKCE code crashed with a 500, and it signed out
   anyone not in the staff users table. It now forwards a code to
   /auth/callback, which exchanges it for the applicant's session, and sends an
   implicit-flow visit (tokens in the hash) straight to its destination. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const requestedNext = searchParams.get("next") ?? "/client/home";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/client/home";
  const code = searchParams.get("code");
  if (code) {
    const forward = new URL("/auth/callback", origin);
    forward.searchParams.set("code", code);
    forward.searchParams.set("next", next);
    return NextResponse.redirect(forward);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
