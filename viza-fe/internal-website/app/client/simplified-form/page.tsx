"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { WizardShell } from "@/components/client/wizards/shell/wizard-shell";
import { pickWizardConfig } from "@/components/client/wizards/shell/registry";
import type { WizardConfig } from "@/components/client/wizards/shell/types";
import { usConfig } from "@/components/client/wizards/us/config";

export default function SimplifiedFormPage() {
  const router = useRouter();
  const tShared = useTranslations("simplifiedForm.shared");
  const [config, setConfig] = useState<WizardConfig<unknown> | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkg = await getUserVisaPackage();
        if (cancelled) return;
        const resolvedConfig = pickWizardConfig(pkg?.visa_type);
        if (resolvedConfig) {
          setConfig(resolvedConfig);
        } else {
          // Legacy / unconfigured packages — bounce to the long form.
          router.replace("/client/application/long-form");
          return;
        }
      } catch {
        // No active package or auth issue — fall back to the US wizard so
        // the user still sees something usable.
        if (!cancelled) setConfig(usConfig as WizardConfig<unknown>);
      }
      if (!cancelled) setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!resolved || !config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
      </div>
    );
  }

  return <WizardShell config={config} />;
}
