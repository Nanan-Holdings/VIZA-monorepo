import { GET as nextAuthGET, POST as nextAuthPOST } from "@/app/(auth)/auth";

function isAuthEnabled() {
  return process.env.TRAVEL_ENABLE_AUTH === "true";
}

function isSessionRequest(request: Request) {
  const { pathname } = new URL(request.url);
  return pathname.endsWith("/api/auth/session");
}

export async function GET(request: Request) {
  if (!isAuthEnabled()) {
    if (isSessionRequest(request)) {
      return Response.json(null, { status: 200 });
    }
    return Response.json({ error: "Auth is disabled." }, { status: 404 });
  }

  return nextAuthGET(request);
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    if (isSessionRequest(request)) {
      return Response.json(null, { status: 200 });
    }
    return Response.json({ error: "Auth is disabled." }, { status: 404 });
  }

  return nextAuthPOST(request);
}
