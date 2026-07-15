import { NextResponse } from "next/server";
import { createClientSession } from "@/lib/client-session";

function isLocalDevelopmentRequest(request: Request): boolean {
  const hostname = request.headers.get("host")?.split(":")[0];
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_LOCAL_TEST_SESSION === "true" &&
    (hostname === "127.0.0.1" || hostname === "localhost")
  );
}

export async function POST(request: Request) {
  if (!isLocalDevelopmentRequest(request)) {
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
  return NextResponse.json({ success: true, redirectTo: "/client/home" });
}
