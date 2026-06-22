"use client";

import { useEffect } from "react";
import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";

export function RuntimeAbortErrorGuard() {
  useEffect(() => {
    const preventIgnorableAbort = (event: PromiseRejectionEvent) => {
      if (!isIgnorableRuntimeAbortError(event.reason)) return;
      event.preventDefault();
    };
    const preventIgnorableError = (event: ErrorEvent) => {
      if (!isIgnorableRuntimeAbortError(event.error ?? event.message)) return;
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", preventIgnorableAbort);
    window.addEventListener("error", preventIgnorableError);
    return () => {
      window.removeEventListener("unhandledrejection", preventIgnorableAbort);
      window.removeEventListener("error", preventIgnorableError);
    };
  }, []);

  return null;
}
