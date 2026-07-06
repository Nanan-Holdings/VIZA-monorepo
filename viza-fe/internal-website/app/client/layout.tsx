"use client";

import { NavBar } from "@/components/client/navbar";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { userSignOut } from "@/app/actions/client-auth";
import {
  getPendingFormRequests,
  createFirstLoginFormRequestIfNeeded,
} from "@/app/actions/form-requests";
import { getAuthenticatedUserId } from "@/lib/auth/get-authenticated-user";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { SimplifiedFormProvider } from "@/lib/context/simplified-form-context";
import { isIgnorableClientSessionCheckError } from "./session-check-errors";

// sessionStorage keys for tracking the session this browser tab has verified.
// Browsers can copy sessionStorage into target=_blank tabs, so every stored
// record is tied to a per-tab window.name id before it can be trusted.
const CLIENT_SESSION_RECORD_KEY = "client_session_record";
const CLIENT_TAB_NAME_PREFIX = "viza-client-tab:";
const LEGACY_SESSION_USER_KEY = "impersonation_user_id";
const LEGACY_SESSION_INVALIDATED_KEY = "impersonation_session_invalidated";

type ClientSessionKind = "impersonation" | "supabase";

type ClientSessionRecord = {
  tabId: string;
  sessionKind: ClientSessionKind;
  sessionId: string;
  userId: string;
};

type ClientSessionResponse = {
  valid: boolean;
  userId?: string | null;
  sessionKind?: ClientSessionKind | null;
  sessionId?: string | null;
};

function getOrCreateTabId() {
  if (window.name.startsWith(CLIENT_TAB_NAME_PREFIX)) {
    return window.name.slice(CLIENT_TAB_NAME_PREFIX.length);
  }

  const tabId = crypto.randomUUID();
  window.name = `${CLIENT_TAB_NAME_PREFIX}${tabId}`;
  return tabId;
}

function readStoredSession(tabId: string): ClientSessionRecord | null {
  const rawRecord = sessionStorage.getItem(CLIENT_SESSION_RECORD_KEY);
  if (!rawRecord) {
    return null;
  }

  try {
    const record = JSON.parse(rawRecord) as Partial<ClientSessionRecord>;
    if (
      record.tabId === tabId &&
      (record.sessionKind === "impersonation" || record.sessionKind === "supabase") &&
      typeof record.sessionId === "string" &&
      typeof record.userId === "string"
    ) {
      return record as ClientSessionRecord;
    }
  } catch {
    sessionStorage.removeItem(CLIENT_SESSION_RECORD_KEY);
  }

  return null;
}

function writeStoredSession(record: ClientSessionRecord) {
  sessionStorage.setItem(CLIENT_SESSION_RECORD_KEY, JSON.stringify(record));
  sessionStorage.removeItem(LEGACY_SESSION_USER_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_INVALIDATED_KEY);
}

// Wrapper component to provide Suspense boundary for useSearchParams
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SimplifiedFormProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        </div>
      }>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </Suspense>
    </SimplifiedFormProvider>
  );
}

function ClientLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("session");
  // Hide scrollbars for all client pages
  useEffect(() => {
    // Add styles to hide scrollbars
    const style = document.createElement("style");
    style.textContent = `
      /* Hide scrollbar for Chrome, Safari and Opera */
      body::-webkit-scrollbar,
      *::-webkit-scrollbar {
        display: none;
      }

      /* Hide scrollbar for IE, Edge and Firefox */
      body,
      * {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
      }
    `;
    document.head.appendChild(style);

    // Cleanup on unmount
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  // Session validity state: null = checking, true = valid, "invalidated" = session was taken over by another tab
  const [sessionValid, setSessionValid] = useState<boolean | null | "invalidated">(null);
  // Form request checking state
  const [formRequestChecked, setFormRequestChecked] = useState(false);
  const isCheckingRef = useRef(false);
  const isInvalidatedRef = useRef(false);
  const formRequestCheckRef = useRef(false);
  const tabIdRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Ensure nav colors are black on all non-home/invite pages
  // Fixes issue where navigating from Home (white nav) to another page keeps white colors
  useEffect(() => {
    const isHome = pathname.startsWith("/client/home");
    const isInvite = pathname.startsWith("/client/invite-friends");
    if (!isHome && !isInvite) {
      document.documentElement.style.setProperty("--nav-text-color", "#000000");
      document.documentElement.style.setProperty("--nav-stroke-color", "#000000");
    }
  }, [pathname]);

  const isReportPage = false;

  // Match page-level shell background at the body level.
  useEffect(() => {
    const previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FAFAFA";

    return () => {
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [isReportPage]);
  const searchParams = useSearchParams();
  const isAboutMeForm = pathname.startsWith("/client/about-me-form");
  const isApplicationFlow =
    pathname === "/client/application" || pathname.startsWith("/client/application/");

  // Check session validity.
  // A per-tab id prevents new target=_blank tabs from inheriting another tab's
  // stored expected session and invalidating themselves immediately.
  // IMPORTANT: This BLOCKS rendering until session is verified to prevent data race conditions
  const checkSessionValidity = useCallback(async (blockRendering: boolean = false) => {
    // Skip check on client auth pages
    if (pathname.startsWith("/client/login") || pathname.startsWith("/client/signup") || pathname.startsWith("/client/register")) {
      return;
    }

    // If session was already invalidated in this render, don't check again
    if (isInvalidatedRef.current) {
      return;
    }

    // Prevent concurrent checks
    if (isCheckingRef.current) {
      return;
    }
    isCheckingRef.current = true;

    const tabId = tabIdRef.current ?? getOrCreateTabId();
    tabIdRef.current = tabId;
    const expectedSession = readStoredSession(tabId);

    // If blocking, set session to null (checking state) to show loading
    if (blockRendering) {
      setSessionValid(null);
    }

    try {
      const response = await fetch("/api/client/session", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to check session");
      }

      const result = (await response.json()) as ClientSessionResponse;

      if (!result.valid) {
        // No valid session — redirect to login instead of showing invalidated state.
        // "Invalidated" is reserved for the impersonation-mismatch case only.
        isCheckingRef.current = false;
        router.replace("/client/login");
        return;
      }

      const currentUserId = result.userId ?? null;
      const currentSessionKind = result.sessionKind ?? null;
      const currentSessionId = result.sessionId ?? null;

      if (!currentUserId || !currentSessionKind || !currentSessionId) {
        isCheckingRef.current = false;
        router.replace("/client/login");
        return;
      }

      const currentSession: ClientSessionRecord = {
        tabId,
        sessionKind: currentSessionKind,
        sessionId: currentSessionId,
        userId: currentUserId,
      };

      if (!expectedSession) {
        writeStoredSession(currentSession);
        setSessionValid(true);
      } else if (
        expectedSession.sessionKind === "impersonation" &&
        currentSession.sessionKind === "impersonation" &&
        currentSession.sessionId !== expectedSession.sessionId
      ) {
        // Another impersonation replaced this tab's verified impersonation
        // cookie. Avoid rendering data under the wrong applicant identity.
        isInvalidatedRef.current = true;
        setSessionValid("invalidated");
        sessionStorage.removeItem(CLIENT_SESSION_RECORD_KEY);
        isCheckingRef.current = false;
        return;
      } else {
        writeStoredSession(currentSession);
        setSessionValid(true);
      }
    } catch (error) {
      if (!isIgnorableClientSessionCheckError(error)) {
        console.error("Error checking session:", error);
      }
      // On transient errors (network, server), let the user through rather than
      // permanently locking the tab. If the session is truly invalid, the next
      // server action or API call will redirect to login.
      setSessionValid(true);
    }

    isCheckingRef.current = false;
  }, [pathname, router]);

  // Run a single session validity check on mount; skip focus/visibility re-checks to avoid remounts
  useEffect(() => {
    if (pathname.startsWith("/client/login") || pathname.startsWith("/client/signup") || pathname.startsWith("/client/register") || isAboutMeForm) {
      return;
    }

    checkSessionValidity(false);
  }, [pathname, isAboutMeForm, checkSessionValidity]);

  // Check for pending form requests after session is validated
  // This implements the first-login redirect flow
  useEffect(() => {
    async function checkFormRequests() {
      // Skip if:
      // - Already checking
      // - Session not yet validated
      // - On login page or about-me-form
      // - Coming back from form (has skipFormCheck param)
      // - Already checked
      if (
        formRequestCheckRef.current ||
        sessionValid !== true ||
        pathname.startsWith("/client/login") ||
        isAboutMeForm ||
        searchParams.get("skipFormCheck") === "true" ||
        formRequestChecked
      ) {
        if (!formRequestChecked && (pathname.startsWith("/client/login") || isAboutMeForm || searchParams.get("skipFormCheck") === "true")) {
          setFormRequestChecked(true);
        }
        return;
      }

      formRequestCheckRef.current = true;

      try {
        // First, check if this is potentially a first login and create request if needed
        const userId = await getAuthenticatedUserId();
        if (userId) {
          // This will create a form request if the user hasn't filled the form before
          await createFirstLoginFormRequestIfNeeded(userId);
        }

        // Then check for any pending requests
        const result = await getPendingFormRequests();
        if (result.success && result.data && result.data.length > 0) {
          const aboutMeRequest = result.data.find((r) => r.form_type === "about_me");
          if (aboutMeRequest) {
            // Redirect to the form with the request ID
            const returnTo = encodeURIComponent(pathname);
            router.push(`/client/about-me-form?requestId=${aboutMeRequest.id}&returnTo=${returnTo}`);
            return;
          }
        }
      } catch (error) {
        console.error("Error checking form requests:", error);
      } finally {
        formRequestCheckRef.current = false;
        setFormRequestChecked(true);
      }
    }

    checkFormRequests();
  }, [sessionValid, pathname, isAboutMeForm, searchParams, formRequestChecked, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Clear this tab's remembered session before logout.
    sessionStorage.removeItem(CLIENT_SESSION_RECORD_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_USER_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_INVALIDATED_KEY);
    await userSignOut();
  };

  useEffect(() => {
    setMenuReady(true);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/client/home")) {
      setActiveTab("Home");
    } else if (pathname.startsWith("/client/application")) {
      setActiveTab("Application");
    } else if (pathname.startsWith("/client/status")) {
      setActiveTab("Status");
    } else if (pathname.startsWith("/client/documents")) {
      setActiveTab("Documents");
    } else if (pathname.startsWith("/client/chat")) {
      setActiveTab("Chat");
    } else if (pathname.startsWith("/client/support") || pathname.startsWith("/client/help")) {
      setActiveTab("Support");
    } else if (pathname.startsWith("/client/settings")) {
      setActiveTab("Settings");
    } else {
      setActiveTab(null);
    }
  }, [pathname, searchParams]);

  // Don't render layout wrapper for auth pages (login, signup) or about-me form (immersive)
  const isAuthPage =
    pathname.startsWith("/client/login") || pathname.startsWith("/client/signup") || pathname.startsWith("/client/register");
  if (isAuthPage || isAboutMeForm) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <main>{children}</main>
      </div>
    );
  }

  // Session was invalidated (another tab started a new impersonation)
  // Show a message instead of redirecting (redirect would just use the new session cookie)
  if (sessionValid === "invalidated") {
    return (
      <div className="client-shell min-h-screen bg-[#fafafa] font-sans flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("invalidatedTitle")}</h2>
            <p className="text-gray-600">
              {t("invalidatedBody")}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            {t("invalidatedHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "client-shell min-h-screen font-sans",
        isReportPage ? "bg-white" : "bg-[#fafafa]"
      )}
    >
      {/* <ClientSidebar /> */}
      {/* <main className="pl-64"> */}
      <NavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        menuReady={menuReady}
      />

      <main
        className={clsx(
          "px-4 pt-32 sm:px-6 md:px-10 xl:px-20 xl:pt-32",
          isApplicationFlow && "lg:h-dvh lg:overflow-hidden"
        )}
      >
        {sessionValid === null || (sessionValid === true && !formRequestChecked) ? (
          // Show loading spinner while verifying session or checking form requests
          // This prevents data fetching and also handles the first-login redirect flow
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
