import { getLocale } from "next-intl/server";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { hashAdminInviteToken } from "@/lib/admin-invite-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AdminRegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; flow?: string }>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const token = params.token?.trim() ?? "";
  let initialEmail = "";
  let initiallyClaimed = false;
  let initiallyInvalid = true;

  const admin = createAdminClient();
  const tokenDigest = token ? hashAdminInviteToken(token) : "";
  const { data: invite } = token
    ? await admin
        .from("admin_registration_invites")
        .select("status, claimed_email, expires_at")
        .eq("token_digest", tokenDigest)
        .in("status", ["pending", "claimed"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()
    : { data: null };

  if (invite?.status === "pending") {
    initiallyInvalid = false;
  }

  // A new administrator returns here after Supabase verifies the invited
  // email. Restore only the claim that belongs to that authenticated email;
  // an unauthenticated holder may still re-enter the bound email after a
  // refresh, without the server revealing which email was claimed.
  if (invite?.status === "claimed" && token) {
    initiallyClaimed = true;
    initiallyInvalid = false;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (authUser?.email && authUser.email_confirmed_at) {
      const email = authUser.email.trim().toLowerCase();
      if (invite.claimed_email === email) {
        initialEmail = email;
      }
    }
  }

  return (
    <AdminRegistrationForm
      locale={normalizeInterfaceLocale(locale)}
      token={token}
      initialEmail={initialEmail}
      initiallyClaimed={initiallyClaimed}
      initiallyInvalid={initiallyInvalid}
    />
  );
}
