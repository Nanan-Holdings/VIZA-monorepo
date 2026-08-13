"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { getRecentApplicationFormHref } from "@/lib/client/recent-application-form";

const LONG_FORM_PATH = "/client/application/long-form";

export default function ApplicationRouterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tShared = useTranslations("simplifiedForm.shared");

  useEffect(() => {
    const qs = searchParams?.toString();
    if (qs) {
      router.replace(`${LONG_FORM_PATH}?${qs}`);
      return;
    }

    // The long-form route already resolves the active package. Avoid doing the
    // same server action here first, which used to add a second full loading
    // screen to every first visit to the Application tab.
    router.replace(getRecentApplicationFormHref() ?? LONG_FORM_PATH);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
    </div>
  );
}
