"use client";

import { useEffect } from "react";
import { WarningCircle as CircleAlert } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";
import {
  attemptStaleServerActionReload,
  isStaleServerActionError,
} from "@/lib/server-action-recovery";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("pageError");
  const isAbortError = isIgnorableRuntimeAbortError(error);
  const isStaleActionError = isStaleServerActionError(error);

  useEffect(() => {
    if (isAbortError) reset();
    if (isStaleActionError) attemptStaleServerActionReload(error);
  }, [error, isAbortError, isStaleActionError, reset]);

  if (isAbortError) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Empty className="max-w-lg">
        <EmptyHeader className="max-w-lg">
          <EmptyMedia variant="icon">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>
            {isStaleActionError
              ? t("updated")
              : t("description")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
