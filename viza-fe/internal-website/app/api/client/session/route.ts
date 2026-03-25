import { NextResponse } from "next/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";

export async function GET() {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return NextResponse.json({ valid: true, userId: impersonation.userId });
  }

  const session = await getUserFromSupabaseSession();
  if (session) {
    return NextResponse.json({ valid: true, userId: session.userId });
  }

  return NextResponse.json({ valid: false, userId: null });
}