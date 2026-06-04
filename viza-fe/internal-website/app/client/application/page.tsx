"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ApplicationRouterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tShared = useTranslations("simplifiedForm.shared");

  useEffect(() => {
    const qs = searchParams?.toString();
    const suffix = qs ? `?${qs}` : "";
    router.replace(`/client/application/long-form${suffix}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
    </div>
  );
}
