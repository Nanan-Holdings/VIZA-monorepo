import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNewSgacApplication } from "@/features/sgac/server/create-new-application";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await createNewSgacApplication(auth.user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ applicationId: result.applicationId }, { status: result.status });
}
