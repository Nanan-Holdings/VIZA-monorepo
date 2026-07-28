"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
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
          <EmptyTitle>页面加载失败</EmptyTitle>
          <EmptyDescription>
            {isStaleActionError
              ? "页面版本已更新，系统正在刷新。若页面没有自动恢复，请手动刷新后继续。"
              : "页面加载时出现问题，请刷新后重试。"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
