"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { WizardShell } from "@/components/client/wizards/shell/wizard-shell";
import { pickWizardConfig } from "@/components/client/wizards/shell/registry";
import type { WizardConfig } from "@/components/client/wizards/shell/types";
import { usConfig } from "@/components/client/wizards/us/config";
import { getFormVisaType } from "@/lib/visa-destinations";

export default function SimplifiedFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tShared = useTranslations("simplifiedForm.shared");
  const [config, setConfig] = useState<WizardConfig<unknown> | null>(null);
  const [target, setTarget] = useState<{ country: string | null; visaType: string | null }>({
    country: null,
    visaType: null,
  });
  const [resolved, setResolved] = useState(false);
  const explicitCountry = searchParams.get("country")?.trim().toLowerCase() || null;
  const explicitVisaType =
    searchParams.get("visaType")?.trim() || searchParams.get("visa_type")?.trim() || null;

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    setConfig(null);
    setTarget({ country: null, visaType: null });

    (async () => {
      try {
        const pkg = await getUserVisaPackage();
        if (cancelled) return;
        const requestedVisaType = explicitVisaType ?? pkg?.visa_type ?? null;
        const normalizedRequestedVisaType = requestedVisaType ? getFormVisaType(requestedVisaType) : null;
        const resolvedConfig = pickWizardConfig(normalizedRequestedVisaType);
        if (resolvedConfig) {
          setConfig(resolvedConfig);
          setTarget({
            country: explicitCountry ?? pkg?.country ?? resolvedConfig.defaultCountry,
            visaType: normalizedRequestedVisaType ?? resolvedConfig.defaultVisaType,
          });
        } else {
          // Legacy / unconfigured packages — bounce to the long form.
          const params = new URLSearchParams();
          const targetCountry = explicitCountry ?? pkg?.country ?? null;
          if (targetCountry) params.set("country", targetCountry);
          if (normalizedRequestedVisaType) params.set("visaType", normalizedRequestedVisaType);
          const suffix = params.toString() ? `?${params.toString()}` : "";
          router.replace(`/client/application/long-form${suffix}`);
          return;
        }
      } catch {
        // No active package or auth issue — fall back to the US wizard so
        // the user still sees something usable.
        if (!cancelled) {
          setConfig(usConfig as WizardConfig<unknown>);
          setTarget({
            country: explicitCountry ?? usConfig.defaultCountry,
            visaType: explicitVisaType ? getFormVisaType(explicitVisaType) : usConfig.defaultVisaType,
          });
        }
      }
      if (!cancelled) setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [explicitCountry, explicitVisaType, router]);

  if (!resolved || !config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
      </div>
    );
  }

  return (
    <WizardShell
      config={config}
      requestedCountry={target.country}
      requestedVisaType={target.visaType}
    />
  );
}
