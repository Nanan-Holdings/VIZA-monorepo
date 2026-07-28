import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import { loadAllHelpArticles, type LoadedArticle } from "@/lib/help";
import { HelpClient } from "./help-client";

export const dynamic = "force-dynamic";

interface ApplicationLite {
  country: string;
  visa_type: string;
}

async function loadApplicantApplications(): Promise<ApplicationLite[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return withAdmin("system", "client/help/articles:apps", async (admin) => {
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!profile) return [];
    const { data } = await admin
      .from("applications")
      .select("country, visa_type")
      .eq("applicant_id", profile.id);
    return (data ?? []) as ApplicationLite[];
  });
}

export default async function HelpArticlesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const articles: LoadedArticle[] = loadAllHelpArticles();
  const applications = await loadApplicantApplications();
  const activeKeys = new Set(
    applications.map((a) => `${a.country}|${a.visa_type}`),
  );
  const filtered = articles.filter((a) =>
    a.visaType ? activeKeys.has(`${a.country}|${a.visaType}`) : true,
  );
  const initial = filtered.length > 0 ? filtered : articles;

  return (
    <div className="w-full p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/client/help"
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Help
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">Package FAQs</h1>
        <p className="text-sm text-[#6b6b6b]">
          {filtered.length > 0
            ? `Showing articles for your ${filtered.length} active package${filtered.length === 1 ? "" : "s"}.`
            : "Browse all package help articles."}
        </p>
      </div>
      <HelpClient articles={initial} />
    </div>
  );
}
