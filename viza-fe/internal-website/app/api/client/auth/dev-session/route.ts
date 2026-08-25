import { NextResponse } from "next/server";
import { createClientSession } from "@/lib/client-session";
import { LOCAL_TEST_SESSION_COOKIE_NAME } from "@/lib/client-dev-session";
import { isLocalTestSessionAllowed } from "./availability";

export async function POST(request: Request) {
  if (!isLocalTestSessionAllowed({
    host: request.headers.get("host"),
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.ENABLE_LOCAL_TEST_SESSION,
  })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = process.env.LOCAL_TEST_CLIENT_ID?.trim();
  const email = process.env.LOCAL_TEST_CLIENT_EMAIL?.trim().toLowerCase();
  if (!userId || !email) {
    return NextResponse.json(
      { success: false, code: "local_test_session_not_configured" },
      { status: 503 }
    );
  }

  await createClientSession(userId, email);
  const response = NextResponse.json({ success: true, redirectTo: "/client/home" });
  response.cookies.set(LOCAL_TEST_SESSION_COOKIE_NAME, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
