import { NextRequest } from "next/server";
import {
  applicationIdSchema,
  contextErrorResponse,
  contextResponse,
  errorResponse,
} from "../contract";
import { loadInterviewApplicationContext } from "@/lib/interview/application-context";

export async function GET(request: NextRequest) {
  const applicationId = request.nextUrl.searchParams.get("applicationId")?.trim();
  const parsed = applicationIdSchema.safeParse(applicationId);
  if (!parsed.success) {
    return errorResponse("INVALID_APPLICATION_ID", "申请编号格式不正确。", 400);
  }

  try {
    const resolved = await loadInterviewApplicationContext(parsed.data);
    return Response.json({
      profile: resolved.profile,
      context: contextResponse(resolved.context),
    });
  } catch (error) {
    return contextErrorResponse(error);
  }
}
