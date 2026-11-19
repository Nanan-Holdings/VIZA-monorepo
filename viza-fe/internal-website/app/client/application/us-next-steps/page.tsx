import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { HelpArticle } from "@/components/client/help-article";
import { createClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- Server Component: user auth is verified before the service-role read is scoped to that user's applicant profile.
import { withAdmin } from "@/lib/auth/with-admin";
import { getCountryHeroTheme } from "@/lib/client/country-hero-theme";
import { getUsNextStepsCopy } from "./copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: getUsNextStepsCopy(locale).title };
}

interface OwnedUsApplication {
  country: string | null;
  visaType: string | null;
  ceacApplicationId: string | null;
  postCode: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The applicant's own application, or null when it is missing or not theirs. */
async function loadOwnedApplication(
  authUserId: string,
  applicationId: string,
): Promise<OwnedUsApplication | null> {
  return withAdmin("system", "client/application/us-next-steps:app", async (admin) => {
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (!profile) return null;
    const { data } = await admin
      .from("applications")
      .select("applicant_id, country, visa_type, submission_result")
      .eq("id", applicationId)
      .maybeSingle();
    if (!data || data.applicant_id !== profile.id) return null;
    const result =
      data.submission_result && typeof data.submission_result === "object"
        ? (data.submission_result as Record<string, unknown>)
        : {};
    return {
      country: text(data.country),
      visaType: text(data.visa_type),
      ceacApplicationId: text(result.applicationId),
      postCode: text(result.embassyOrConsulate),
    };
  });
}

export default async function UsNextStepsPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string | string[] }>;
}) {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const { applicationId: rawApplicationId } = await searchParams;
  const applicationId = typeof rawApplicationId === "string" ? rawApplicationId.trim() : "";
  const application = applicationId ? await loadOwnedApplication(user.id, applicationId) : null;

  // Back to the same submission result the applicant came from.
  const backHref = application
    ? `/client/application/long-form?${new URLSearchParams({
        applicationId,
        country: application.country ?? "united_states",
        visaType: application.visaType ?? "B1_B2",
      }).toString()}`
    : "/client/status";

  const copy = getUsNextStepsCopy(locale, {
    postCode: application?.postCode ?? null,
    applicationId: application?.ceacApplicationId ?? null,
  });

  return (
    <HelpArticle
      title={copy.title}
      subtitle={copy.subtitle}
      sections={copy.sections}
      backHref={backHref}
      topBackLabel={copy.topBackLabel}
      backLabel={copy.backLabel}
      heroTheme={getCountryHeroTheme(application?.country ?? "united_states")}
      linkify
    />
  );
}
