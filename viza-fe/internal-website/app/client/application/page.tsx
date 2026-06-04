"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { hasWizardConfig } from "@/components/client/wizards/shell/registry";
import { getFormVisaType } from "@/lib/visa-destinations";
import { getRecentApplicationFormHref } from "@/lib/client/recent-application-form";

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
        const requestedVisaType =
          params.get("visaType")?.trim() || params.get("visa_type")?.trim() || null;
        params.delete("applicationId");
        const targetPath = requestedVisaType && hasWizardConfig(getFormVisaType(requestedVisaType))
          ? "/client/simplified-form"
          : "/client/application/long-form";
        const suffix = params.toString() ? `?${params.toString()}` : "";
        router.replace(`${targetPath}${suffix}`);
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

        const targetPath = pkg?.visa_type && hasWizardConfig(getFormVisaType(pkg.visa_type))
          ? "/client/simplified-form"
          : "/client/application/long-form";
        const params = new URLSearchParams();
        if (pkg?.country) params.set("country", pkg.country);
        if (pkg?.visa_type) params.set("visaType", pkg.visa_type);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        router.replace(`${targetPath}${suffix}`);
      } catch {
        if (!cancelled) {
          router.replace("/client/application/long-form");
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
