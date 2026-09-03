"use client";

/**
 * Cached readers for the data every portal tab needs.
 *
 * Home, Application and Status all read the same applicant status payload, and
 * the long-form wizard re-reads the same package and form schema on every
 * visit. Routing those reads through one keyed cache means a tab switch paints
 * from memory and refreshes behind the applicant, instead of blocking on a
 * fresh multi-table round trip each time.
 */

import {
  getClientApplicationStatuses,
  type ClientApplicationStatusesResult,
} from "@/app/actions/client-application-status";
import {
  getClientHomeDashboardData,
  type ClientHomeDashboardData,
} from "@/app/actions/client-home-dashboard";
import { getTeamApplicationContext } from "@/app/actions/application-group";
import {
  loadDynamicAnswers,
  saveDynamicAnswers as saveDynamicAnswersAction,
} from "@/app/actions/visa-application-answers";
import { getUserVisaPackage, type UserVisaPackage } from "@/app/actions/user-package";
import { getVisaFormSteps } from "@/app/actions/visa-form-fields";
import type { WizardStep } from "@/types/visa-form-fields";
import { fetchCached, invalidateCached, useCachedAction } from "@/lib/client/action-cache";

const APPLICATION_STATUSES_KEY = "client:application-statuses";

/** How long a status payload is served without a background refresh. */
const STATUS_STALE_MS = 10_000;

export function useClientApplicationStatuses(options: { enabled?: boolean } = {}) {
  return useCachedAction<ClientApplicationStatusesResult>(
    APPLICATION_STATUSES_KEY,
    getClientApplicationStatuses,
    { staleMs: STATUS_STALE_MS, enabled: options.enabled ?? true },
  );
}

/** Imperative variant for callers that are not React components. */
export function loadClientApplicationStatuses() {
  return fetchCached<ClientApplicationStatusesResult>(
    APPLICATION_STATUSES_KEY,
    getClientApplicationStatuses,
    { staleMs: STATUS_STALE_MS },
  );
}

/**
 * Call after anything that changes an application (submit, payment, document
 * upload) so the next read goes back to the server.
 */
export function invalidateClientApplicationStatuses() {
  invalidateCached(APPLICATION_STATUSES_KEY);
}

const HOME_DASHBOARD_KEY = "client:home-dashboard";

/** The compact Home payload: profile completeness, applications, payments. */
export function loadClientHomeDashboard() {
  return fetchCached<ClientHomeDashboardData>(
    HOME_DASHBOARD_KEY,
    getClientHomeDashboardData,
    { staleMs: STATUS_STALE_MS },
  );
}

const VISA_PACKAGE_KEY = "client:visa-package";

/** The applicant's active package; changes only when ops assign a new one. */
export function loadUserVisaPackage() {
  return fetchCached<UserVisaPackage | null>(VISA_PACKAGE_KEY, getUserVisaPackage, {
    staleMs: 30_000,
  });
}

/**
 * A visa form schema. This is configuration rather than applicant data, so it
 * is cached for the life of the tab: re-opening the wizard should not re-read
 * the whole field list.
 */
export function loadVisaFormSteps(visaType: string, country: string | null) {
  return fetchCached<WizardStep[]>(
    `client:visa-form-steps:${visaType}:${country ?? ""}`,
    () => getVisaFormSteps(visaType, { country }),
    { staleMs: 10 * 60_000 },
  );
}

export function invalidatePortalCaches() {
  invalidateCached("client:");
}

/**
 * How long a wizard read stays usable without going back to the server.
 *
 * Short on purpose: this window exists so that work started before the
 * applicant asks — when the current page goes idle, or when they hover the
 * Application tab — is still warm by the time the click lands. It is not meant
 * to let the wizard render minutes-old data.
 */
const WIZARD_STALE_MS = 15_000;

export function loadTeamApplicationContext(applicationId: string) {
  return fetchCached(
    `client:application-context:${applicationId}`,
    () => getTeamApplicationContext(applicationId),
    { staleMs: WIZARD_STALE_MS },
  );
}

export function loadApplicationAnswers(applicationId: string) {
  return fetchCached(
    `client:application-answers:${applicationId}`,
    () => loadDynamicAnswers(applicationId),
    { staleMs: WIZARD_STALE_MS },
  );
}

/**
 * Saves answers and drops this application's cached reads, so a tab switch
 * straight after a save cannot show the pre-save draft.
 */
export async function saveApplicationAnswers(
  ...args: Parameters<typeof saveDynamicAnswersAction>
): ReturnType<typeof saveDynamicAnswersAction> {
  try {
    return await saveDynamicAnswersAction(...args);
  } finally {
    invalidateApplicationForm(args[0]);
    invalidateClientApplicationStatuses();
  }
}

/** Drops the cached wizard reads for one application after a write. */
export function invalidateApplicationForm(applicationId: string) {
  invalidateCached(`client:application-context:${applicationId}`);
  invalidateCached(`client:application-answers:${applicationId}`);
}

/**
 * Starts the reads the application wizard needs, before the applicant asks for
 * it. Called when they hover or focus the Application tab, so the click lands
 * on data that is already in memory instead of starting a round trip.
 */
export function prefetchApplicationForm(target: {
  applicationId?: string | null;
  visaType?: string | null;
  country?: string | null;
}) {
  if (target.visaType) {
    void loadVisaFormSteps(target.visaType, target.country ?? null).catch(() => undefined);
  } else {
    void loadUserVisaPackage().catch(() => undefined);
  }
  if (target.applicationId) {
    void loadTeamApplicationContext(target.applicationId).catch(() => undefined);
    void loadApplicationAnswers(target.applicationId).catch(() => undefined);
  }
}
