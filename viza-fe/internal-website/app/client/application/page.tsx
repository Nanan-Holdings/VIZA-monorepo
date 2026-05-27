"use client";

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

        // 根据远端架构：判断分发至全新简化表单还是老版长表单
        if (hasWizardConfig(pkg?.visa_type)) {
          router.replace(`/client/simplified-form${suffix}`);
        } else {
          router.replace(`/client/application/long-form${suffix}`);
        }
      } catch {
        if (!cancelled) {
          router.replace(`/client/application/long-form${suffix}`);
        }
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
