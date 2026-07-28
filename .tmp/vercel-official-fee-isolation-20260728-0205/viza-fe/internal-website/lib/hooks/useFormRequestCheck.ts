"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  getPendingFormRequests,
  type UserFormRequest,
} from "@/app/actions/form-requests";

interface UseFormRequestCheckResult {
  isChecking: boolean;
  hasPendingRequest: boolean;
  pendingRequest: UserFormRequest | null;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check for pending form requests and handle redirects
 *
 * This hook:
 * 1. Checks for pending form requests on mount
 * 2. Provides state about pending requests
 * 3. Can be used to redirect to the form if needed
 *
 * @param options.autoRedirect - If true, automatically redirects to form when pending request exists
 * @param options.skipPaths - Paths to skip redirect check (e.g., the form page itself)
 */
export function useFormRequestCheck(options?: {
  autoRedirect?: boolean;
  skipPaths?: string[];
}): UseFormRequestCheckResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isChecking, setIsChecking] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<UserFormRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { autoRedirect = false, skipPaths = [] } = options || {};

  const checkFormRequests = useCallback(async () => {
    // Skip check for specified paths
    const shouldSkip = skipPaths.some((path) => pathname.startsWith(path));
    if (shouldSkip) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const result = await getPendingFormRequests();

      if (!result.success) {
        setError(result.error || "Failed to check form requests");
        setIsChecking(false);
        return;
      }

      const requests = result.data || [];
      const aboutMeRequest = requests.find((r) => r.form_type === "about_me");

      if (aboutMeRequest) {
        setHasPendingRequest(true);
        setPendingRequest(aboutMeRequest);

        // Auto-redirect if enabled
        if (autoRedirect) {
          const redirectUrl = `/client/about-me-form?requestId=${aboutMeRequest.id}&returnTo=${encodeURIComponent(pathname)}`;
          router.push(redirectUrl);
          return;
        }
      } else {
        setHasPendingRequest(false);
        setPendingRequest(null);
      }
    } catch (err) {
      console.error("Error checking form requests:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsChecking(false);
    }
  }, [pathname, skipPaths, autoRedirect, router]);

  useEffect(() => {
    // Don't check if we're coming from a form completion (has skipFormCheck param)
    const skipCheck = searchParams.get("skipFormCheck") === "true";
    if (skipCheck) {
      setIsChecking(false);
      return;
    }

    checkFormRequests();
  }, [checkFormRequests, searchParams]);

  return {
    isChecking,
    hasPendingRequest,
    pendingRequest,
    error,
    refetch: checkFormRequests,
  };
}

/**
 * Simpler hook that just returns if there's a pending request
 * Useful for components that just need to know if a request exists
 */
export function usePendingFormRequest(): {
  isLoading: boolean;
  pendingRequest: UserFormRequest | null;
} {
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<UserFormRequest | null>(null);

  useEffect(() => {
    async function check() {
      const result = await getPendingFormRequests();
      if (result.success && result.data && result.data.length > 0) {
        const aboutMeRequest = result.data.find((r) => r.form_type === "about_me");
        setPendingRequest(aboutMeRequest || null);
      }
      setIsLoading(false);
    }

    check();
  }, []);

  return { isLoading, pendingRequest };
}
