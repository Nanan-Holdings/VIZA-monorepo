"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { getRecentApplicationFormHref } from "@/lib/client/recent-application-form";

const LONG_FORM_PATH = "/client/application/long-form";

export default function ApplicationRouterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tShared = useTranslations("simplifiedForm.shared");

  useEffect(() => {
    let cancelled = false;

    async function redirectToApplicationForm() {
      const qs = searchParams?.toString();

      if (qs) {
        const params = new URLSearchParams(qs);
        params.delete("applicationId");
        const suffix = params.toString() ? `?${params.toString()}` : "";
        router.replace(`${LONG_FORM_PATH}${suffix}`);
        return;
      }

      const recentFormHref = getRecentApplicationFormHref();
      if (recentFormHref) {
        router.replace(recentFormHref);
        return;
      }

      try {
        const pkg = await getUserVisaPackage();
        if (cancelled) return;

        const params = new URLSearchParams();
        if (pkg?.country) params.set("country", pkg.country);
        if (pkg?.visa_type) params.set("visaType", pkg.visa_type);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        router.replace(`${LONG_FORM_PATH}${suffix}`);
      } catch {
        if (!cancelled) {
          router.replace(LONG_FORM_PATH);
        }
      }
    }

    void redirectToApplicationForm();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
    </div>
  );
}
