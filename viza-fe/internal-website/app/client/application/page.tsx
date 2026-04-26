"use client";

/**
 * /client/application is the user's primary entry point for filling out
 * their visa form. It now decides between two presentations based on the
 * user's assigned visa package:
 *
 * - If a per-country `WizardConfig` exists in the wizards registry → redirect
 *   to the simplified-form wizard at `/client/simplified-form`.
 * - Otherwise (legacy packages, e.g. Indonesia B211A) → redirect to the
 *   long DynamicStepForm at `/client/application/long-form`.
 *
 * Both target routes preserve `?step=…` and other query params for deep
 * linking from the dashboard / email.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { hasWizardConfig } from "@/components/client/wizards/shell/registry";

export default function ApplicationRouterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tShared = useTranslations("simplifiedForm.shared");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qs = searchParams?.toString();
      const suffix = qs ? `?${qs}` : "";
      try {
        const pkg = await getUserVisaPackage();
        if (cancelled) return;
        if (hasWizardConfig(pkg?.visa_type)) {
          router.replace(`/client/simplified-form${suffix}`);
        } else {
          router.replace(`/client/application/long-form${suffix}`);
        }
      } catch {
        if (!cancelled) router.replace(`/client/application/long-form${suffix}`);
      }
    })();
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
