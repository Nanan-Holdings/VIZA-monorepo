import { ensureDraftApplication } from "@/app/actions/visa-application-answers";
import { EVENT, currentRoute, eventCode, track } from "./events";

/**
 * `ensureDraftApplication` plus the `application_started` funnel event.
 *
 * The server action creates the applications row lazily and reports
 * `created: true` only for a new row, so re-opening an existing draft never
 * counts as a start. Use this from browser call sites in place of the bare
 * server action.
 */
export const ensureDraftApplicationTracked: typeof ensureDraftApplication = async (
  country,
  visaType,
  options,
) => {
  const result = await ensureDraftApplication(country, visaType, options);
  if (result?.created && result.applicationId) {
    track(EVENT.application_started, {
      destination_country: eventCode(country),
      visa_type: eventCode(visaType),
      source: currentRoute(),
    });
  }
  return result;
};
