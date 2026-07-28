"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTemplate, type TemplateLocale } from "@/lib/notify/templates";

/**
 * Post-payment account provisioning + magic-link mail.
 *
 * Invoked (fire-and-forget) from every guest-checkout rail once an order
 * flips to `paid` — WeChat Pay Native (`/api/wechat-pay/notify`) and the
 * guest card rail (`/api/stripe/webhook`, guest branch), both via
 * `lib/checkout/post-paid.ts`. Side-effect only — never throws into the
 * webhook caller (matching the Stripe receipt mailer).
 *
 *   1. Resolve order → applicant_profiles → email + locale + app meta.
 *   2. auth.admin.createUser({email_confirm:true}) if no user exists, and
 *      bind applicant_profiles.auth_user_id (idempotent) — always.
 *   3. If order.guest_checkout is false, stop here (authenticated buyers
 *      already have a session; no login-link mail).
 *   4. auth.admin.generateLink({type:'magiclink'}) with redirectTo back
 *      to the existing /auth/callback?next=/client/home handler.
 *   5. Send the locale-branched `paid_welcome` email via Resend.
 */

interface ProfileLite {
  id: string;
  email: string | null;
  full_name: string | null;
  auth_user_id: string | null;
  language_pref: string | null;
}

interface AppLite {
  id: string;
  country: string;
  visa_type: string;
}

const COUNTRY_LABELS_EN: Record<string, string> = {
  indonesia: "Indonesia",
  united_states: "United States",
  united_kingdom: "United Kingdom",
  european_union: "Schengen",
  vietnam: "Vietnam",
  australia: "Australia",
  japan: "Japan",
  south_korea: "South Korea",
  thailand: "Thailand",
  malaysia: "Malaysia",
  singapore: "Singapore",
  hong_kong: "Hong Kong",
  macau: "Macau",
  new_zealand: "New Zealand",
  philippines: "Philippines",
  cambodia: "Cambodia",
  laos: "Laos",
  sri_lanka: "Sri Lanka",
  india: "India",
  maldives: "Maldives",
  egypt: "Egypt",
  russia: "Russia",
  turkey: "Türkiye",
  united_arab_emirates: "United Arab Emirates",
  canada: "Canada",
  south_africa: "South Africa",
};

const COUNTRY_LABELS_ZH: Record<string, string> = {
  indonesia: "印度尼西亚",
  united_states: "美国",
  united_kingdom: "英国",
  european_union: "申根",
  vietnam: "越南",
  australia: "澳大利亚",
  japan: "日本",
  south_korea: "韩国",
  thailand: "泰国",
  malaysia: "马来西亚",
  singapore: "新加坡",
  hong_kong: "香港",
  macau: "澳门",
  new_zealand: "新西兰",
  philippines: "菲律宾",
  cambodia: "柬埔寨",
  laos: "老挝",
  sri_lanka: "斯里兰卡",
  india: "印度",
  maldives: "马尔代夫",
  egypt: "埃及",
  russia: "俄罗斯",
  turkey: "土耳其",
  united_arab_emirates: "阿联酋",
  canada: "加拿大",
  south_africa: "南非",
};

function labelFor(country: string, locale: TemplateLocale): string {
  const dict = locale === "zh-CN" ? COUNTRY_LABELS_ZH : COUNTRY_LABELS_EN;
  return dict[country] ?? country;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.viza.it.com";
}

export async function provisionAccountAndMagicLink(
  orderId: string,
): Promise<void> {
  await withAdmin(
    "system",
    "actions/wechat-provisioning:run",
    async (admin) => {
      const { data: order, error: orderErr } = await admin
        .from("order")
        .select("id, applicant_id, application_id, guest_checkout")
        .eq("id", orderId)
        .maybeSingle();
      if (orderErr || !order) {
        throw new Error(`order lookup: ${orderErr?.message ?? "not found"}`);
      }

      const [{ data: profile }, { data: app }] = await Promise.all([
        admin
          .from("applicant_profiles")
          .select("id, email, full_name, auth_user_id, language_pref")
          .eq("id", order.applicant_id)
          .maybeSingle<ProfileLite>(),
        admin
          .from("applications")
          .select("id, country, visa_type")
          .eq("id", order.application_id)
          .maybeSingle<AppLite>(),
      ]);
      if (!profile || !profile.email) {
        console.warn(
          `[wechat-provisioning] order ${orderId} has no email — skipping`,
        );
        return;
      }
      if (!app) {
        console.warn(
          `[wechat-provisioning] order ${orderId} missing application`,
        );
        return;
      }

      // 1. Find or create the auth user. We bind auth_user_id regardless
      //    of guest_checkout so any later sign-in resolves to one user;
      //    the login-link *email* below is gated on guest_checkout.
      let authUserId = profile.auth_user_id;
      if (!authUserId) {
        const listed = await admin.auth.admin.listUsers();
        const existing = listed.data?.users?.find(
          (u) => u.email?.toLowerCase() === profile.email!.toLowerCase(),
        );
        if (existing) {
          authUserId = existing.id;
        } else {
          const { data: created, error: createErr } =
            await admin.auth.admin.createUser({
              email: profile.email,
              email_confirm: true,
              user_metadata: { full_name: profile.full_name ?? undefined },
            });
          if (createErr || !created.user) {
            throw new Error(`createUser: ${createErr?.message}`);
          }
          authUserId = created.user.id;
        }

        await admin
          .from("applicant_profiles")
          .update({
            auth_user_id: authUserId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
      }

      // 2. Login-link mail is for guest checkouts only. An authenticated
      //    `/client` purchase (guest_checkout=false) already has a session,
      //    so re-mailing a magic link would be noise (and a phishing-shaped
      //    pattern). Bail after binding the auth user above.
      if (!order.guest_checkout) {
        return;
      }

      // 3. Generate magic-link.
      const redirectTo = `${siteUrl()}/auth/callback?next=/client/home`;
      const { data: linkData, error: linkErr } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: profile.email,
          options: { redirectTo },
        });
      if (linkErr || !linkData?.properties?.action_link) {
        throw new Error(`generateLink: ${linkErr?.message}`);
      }
      const magicLink = linkData.properties.action_link;

      // 4. Mail it (locale per applicant profile).
      const locale: TemplateLocale = (["zh-CN", "vi", "es"] as const).includes(
        profile.language_pref as "zh-CN" | "vi" | "es",
      )
        ? (profile.language_pref as TemplateLocale)
        : "en";
      const rendered = renderTemplate(
        "paid_welcome",
        {
          applicantName: profile.full_name ?? profile.email.split("@")[0],
          applicationId: app.id,
          countryLabel: labelFor(app.country, locale),
          visaTypeLabel: app.visa_type,
          magicLink,
        },
        locale,
      );

      await sendEmail({
        from: process.env.NOTIFY_FROM_EMAIL ?? "VIZA <welcome@viza.it.com>",
        to: profile.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    },
  );
}
