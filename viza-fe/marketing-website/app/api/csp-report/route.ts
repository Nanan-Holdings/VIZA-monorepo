import { createCspReportCollector } from "@/lib/security/csp-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collector = createCspReportCollector();

export async function POST(request: Request): Promise<Response> {
  return collector.handle(request);
}
