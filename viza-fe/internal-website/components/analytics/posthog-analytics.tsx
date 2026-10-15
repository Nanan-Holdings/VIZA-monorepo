"use client";

import { useEffect } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  identifyUser,
  isAnalyticsEnabled,
  isIdentified,
  loadPostHog,
  resetAnalytics,
} from "@/lib/analytics/posthog";

const ROLE_CACHE_PREFIX = "viza_ph_role:";

function readCachedRole(userId: string): string | null | undefined {
  try {
    const raw = window.sessionStorage.getItem(`${ROLE_CACHE_PREFIX}${userId}`);
    if (raw === null) return undefined;
    return raw === "" ? null : raw;
  } catch {
    return undefined;
  }
}

function writeCachedRole(userId: string, role: string | null): void {
  try {
    window.sessionStorage.setItem(`${ROLE_CACHE_PREFIX}${userId}`, role ?? "");
  } catch {
    // Storage can be unavailable (private mode); the lookup simply repeats.
  }
}

/** `users.role` for the signed-in account, or null for applicants without a row. */
async function lookupRole(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const cached = readCachedRole(userId);
  if (cached !== undefined) return cached;
  try {
    const { data } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    const role = typeof data?.role === "string" ? data.role : null;
    writeCachedRole(userId, role);
    return role;
  } catch {
    return null;
  }
}

async function syncIdentity(supabase: SupabaseClient, user: User | null): Promise<void> {
  if (!user) {
    // Signed out (including server-side sign-out followed by a redirect).
    if (isIdentified()) resetAnalytics();
    return;
  }
  const role = await lookupRole(supabase, user.id);
  // Anyone working inside /admin is staff even if the role lookup failed.
  const inAdmin = window.location.pathname.startsWith("/admin");
  await identifyUser({ userId: user.id, role }, inAdmin);
}

/**
 * Loads PostHog on the production portal host and keeps the PostHog person in
 * step with the Supabase auth session: identify on session restore and on
 * sign-in, reset on sign-out. Renders nothing.
 */
export function PostHogAnalytics() {
  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void loadPostHog().then((ph) => {
      if (!ph || cancelled) return;
      const supabase = createClient();
      // INITIAL_SESSION fires immediately with the restored session.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        // Defer Supabase calls out of the auth callback to avoid its lock.
        window.setTimeout(() => {
          if (cancelled) return;
          if (event === "SIGNED_OUT") {
            resetAnalytics();
            return;
          }
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") {
            void syncIdentity(supabase, session?.user ?? null).catch(() => undefined);
          }
        }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return null;
}
