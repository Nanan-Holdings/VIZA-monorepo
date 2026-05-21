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

      // ── 融合 HEAD 逻辑 ──────────────────────────────────────────────────
      // 拦截并保持对文档详情页深层链接（Deep Link）的向前兼容性
      const requestedView = searchParams.get("view");
      if (requestedView === "detail") {
        const requestedApplicationId = searchParams.get("applicationId")?.trim();
        const requestedCountry = searchParams.get("country")?.trim();
        const requestedVisaType = (searchParams.get("visaType") || searchParams.get("visa_type"))?.trim();

        const destParams = new URLSearchParams({ view: "detail" });
        if (requestedApplicationId) destParams.set("applicationId", requestedApplicationId);
        if (requestedCountry) destParams.set("country", requestedCountry);
        if (requestedVisaType) destParams.set("visaType", requestedVisaType);

        router.replace(`/client/documents?${destParams.toString()}`);
        return;
      }
      // ──────────────────────────────────────────────────────────────────

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