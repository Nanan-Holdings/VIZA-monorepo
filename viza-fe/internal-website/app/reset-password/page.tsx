import { redirect } from "next/navigation";

interface ResetPasswordRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordRedirect({ searchParams }: ResetPasswordRedirectProps) {
  // Supabase email links sometimes hit /reset-password directly. Forward
  // to the canonical handler that already implements the
  // PASSWORD_RECOVERY auth-state-change flow.
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") qs.set(k, v[0]);
  }
  const tail = qs.toString();
  redirect(tail ? `/auth/reset-password?${tail}` : "/auth/reset-password");
}
