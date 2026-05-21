/**
 * Selectors and URL constants for the UK Standard Visitor visa portal
 * (visas-immigration.service.gov.uk).
 *
 * Conventions observed from live recon (docs/uk-visa-recon-2026-04-24.json):
 *   - Radio id: `{name}_{value}`  (e.g. `#languageCode_en`).
 *   - Country dropdowns: `<select name="X">` with ISO 3166-1 alpha-3
 *     option values; paired `#X_ui` autocomplete is display-only.
 *   - Every POST form has a hidden `csrfToken` — fill in place, never
 *     rebuild the form.
 *   - Submit: `button[name="submit"]` or `#submit`. A button named
 *     "submit" shadows `form.submit()`, so always click the button.
 */

export const UK_URLS = {
  /** Public gov.uk "Apply now" landing — redirects through to the portal. */
  GOV_UK_APPLY_NOW:
    "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa",
  /** First real page in the UKVI flow — language selection. */
  LANGUAGE_SELECTION:
    "https://visas-immigration.service.gov.uk/alt-language-selection-skip-visa",
  /** Portal origin — useful for action-path matching. */
  PORTAL_ORIGIN: "https://visas-immigration.service.gov.uk",
} as const;

/** Submit button, present on every form. Button named "submit" shadows
 *  form.submit(); always click this rather than calling submit(). */
export const UK_SUBMIT_SELECTOR =
  'button[name="submit"], input[type="submit"]#submit';

/** H1 heading on every page. Used alongside form.action for page detection. */
export const UK_HEADING_SELECTOR = "h1";

/** Hidden csrf token input — informational only; never clear/rewrite. */
export const UK_CSRF_SELECTOR = 'input[name="csrfToken"]';

/** Per-page selector bindings for the pre-auth flow. Post-auth selectors
 *  live under `POST_AUTH_TODO` and are populated from the form-recon run. */
export const UK_PAGE_SELECTORS = {
  language_selection: {
    /** Radio: languageCode. Value = 2-letter code ("en"/"zh"/"hi"/...). */
    languageCode: {
      selector: 'input[name="languageCode"]',
      idPattern: "languageCode_{value}",
      type: "radio" as const,
      validValues: [
        "en", "zh", "hi", "ru", "tr", "th", "ar", "ur", "bn", "fr",
        "id", "ja", "ko", "pt", "si", "es", "vi", "gu", "ta",
      ],
    },
  },
  country_selection: {
    /** Select: countryCode. ISO 3166-1 alpha-3 values (USA, AFG, CHN...). */
    countryCode: {
      selector: 'select[name="countryCode"]',
      uiSelector: "#countryCode_ui",
      type: "select-iso3" as const,
    },
  },
  vac_information: {
    /** Radio: vacAvailabilityConfirmed. true = "I've identified a location". */
    vacAvailabilityConfirmed: {
      selector: 'input[name="vacAvailabilityConfirmed"]',
      idPattern: "vacAvailabilityConfirmed_{value}",
      type: "radio" as const,
      validValues: ["true", "false"],
    },
  },
  visa_type_start: {
    /** Pass-through "Start now" page — no fields, only submit. */
  },
  registration: {
    email: { selector: "#email", type: "email" as const },
    password1: { selector: "#password1", type: "password" as const },
    password2: { selector: "#password2", type: "password" as const },
  },
} as const;

/** Markers for cross-page states. */
export const UK_MARKERS = {
  /** Returning-user / sign-in mode is signalled by hidden hasPassword=true on
   *  the same "Register an email" shell. */
  returningUserHiddenField: 'input[name="hasPassword"][value="true"]',
  /** Session expired pages on govuk-frontend tend to show this heading. */
  sessionExpiredHeadingPattern: /your session has timed out|sign in again/i,
} as const;

/** Post-auth selectors are captured by running `form-recon.ts` against a
 *  logged-in browser session — see the script header for instructions.
 *  This map is intentionally empty until that walk is performed. */
export const POST_AUTH_TODO: Record<string, never> = {};
