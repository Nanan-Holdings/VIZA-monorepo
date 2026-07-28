"use client";

import { useEffect } from "react";
import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";
import {
  attemptStaleServerActionReload,
  isStaleServerActionError,
} from "@/lib/server-action-recovery";

export function RuntimeAbortErrorGuard() {
  useEffect(() => {
    const preventIgnorableAbort = (event: PromiseRejectionEvent) => {
      if (isStaleServerActionError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        attemptStaleServerActionReload(event.reason);
        return;
      }
      if (!isIgnorableRuntimeAbortError(event.reason)) return;
      event.preventDefault();
    };
    const preventIgnorableError = (event: ErrorEvent) => {
      const error = event.error ?? event.message;
      if (isStaleServerActionError(error)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        attemptStaleServerActionReload(error);
        return;
      }
      if (!isIgnorableRuntimeAbortError(error)) return;
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
