import { timingSafeEqual } from "node:crypto";

export function authorizeMarketingCron(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(provided); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
