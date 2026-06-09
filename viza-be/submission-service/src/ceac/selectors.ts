/**
 * Common CEAC DS-160 selectors, centralized so page identity detection,
 * navigation, and field-fill code can share one source of truth.
 *
 * CEAC is an ASP.NET WebForms app: control IDs are long and prefixed with
 * things like `ctl00_SiteContentPlaceHolder_`. We match on suffix/substring
 * so minor markup churn on CEAC doesn't break every selector at once.
 */

export const CEAC_URLS = {
  /** DS-160 landing page (language + embassy + captcha selection). */
  START: "https://ceac.state.gov/GenNIV/Default.aspx",
  /**
   * Retrieval URL template for an existing application. Callers must append
   * the Application ID.
   */
  RETRIEVAL_BASE: "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=",
} as const;

/**
 * Navigation controls that appear on most DS-160 pages. Each value is a
 * comma-separated selector list; the fill helper tries each until one hits.
 */
export const CEAC_NAV_SELECTORS = {
  // CEAC primary Next button has class="next" and value starting with
  // "Next:" (e.g. "Next: Personal 2"). We match on BOTH class and the
  // "Next:" prefix to exclude hidden modal buttons like
  // `btnNextPageComplete` (value="No – Continue Form") that otherwise
  // match on `id*="btnNext"` and get picked first.
  next:
    'input[type="submit"].next, input[type="submit"][value^="Next:"], input[type="submit"][value="Next"], input[id*="btnNext"]:not([id*="Complete"])',
  back:
    'input[type="submit"].back, input[type="submit"][value^="Back:"], input[type="submit"][value="Back"], input[id*="btnBack"]',
  save: 'input[type="submit"][value*="Save"], input[id*="btnSave"]',
  saveToFile:
    'input[type="submit"][value*="Save Application to File"], input[id*="btnSaveToFile"]',
  continueApplication: 'a[id*="lnkContinue"], input[id*="btnContinue"]',
} as const;

/**
 * Primary page-identity markers. CEAC DS-160 pages each render a distinctive
 * H2 heading inside the main content placeholder. Heading match is the
 * preferred identity signal because it survives minor DOM changes elsewhere.
 */
export const CEAC_HEADING_SELECTOR = "h2, .SubHead, [id*='SiteContentPlaceHolder'] h2";

/**
 * Selector for inline validation error summary on a CEAC page. CEAC renders
 * a ValidationSummary control when a page is submitted with invalid fields.
 */
export const CEAC_VALIDATION_SUMMARY_SELECTOR =
  '[id*="ValidationSummary"], .error, .validation-summary-errors';

/**
 * Selector for per-field validation messages (asp:RequiredFieldValidator etc).
 */
export const CEAC_FIELD_ERROR_SELECTOR =
  '[id*="RequiredFieldValidator"], [id*="RegularExpressionValidator"], [id*="CompareValidator"]';

/**
 * Application-ID display. On CEAC, once an application is started the ID is
 * rendered near the top of each page, typically with a label like
 * "Application ID AA00ABCDEF" and matches the `AA\d{10}` pattern.
 */
export const CEAC_APPLICATION_ID_SELECTORS = [
  'span[id*="ApplicationID"]',
  'span[id*="lblAppID"]',
  '[id*="ctl00_SiteContentPlaceHolder_lblID"]',
];

/** Regex for the canonical DS-160 Application ID format. */
export const CEAC_APPLICATION_ID_PATTERN = /AA[A-Z0-9]{8,10}/;

/**
 * Session-expired / timeout markers. When CEAC drops the session, it renders
 * a message roughly matching one of these patterns.
 */
export const CEAC_SESSION_EXPIRED_MARKERS: readonly RegExp[] = [
  /session has expired/i,
  /your session has timed out/i,
  /please start over/i,
];

/**
 * Markers specific to the Sign and Submit page. Detected by heading plus the
 * presence of the passport-number signature input and the final submit
 * button. The worker must stop when these appear.
 */
/**
 * Anti-bot, captcha, and manual-intervention gate markers. When CEAC detects
 * automated traffic it may present a challenge page, a "please verify"
 * interstitial, or a Cloudflare/WAF block before the DS-160 start page loads.
 * These markers let the worker detect that state explicitly and surface it
 * as a structured gate error instead of retrying blindly.
 */
export const CEAC_GATE_MARKERS = {
  /** Body-text patterns that indicate an anti-bot or rate-limit interstitial. */
  textPatterns: [
    /access denied/i,
    /automated access/i,
    /please verify you are (a )?human/i,
    /unusual activity/i,
    /too many requests/i,
    /rate limit/i,
    /blocked/i,
    /security check/i,
    /challenge/i,
    /one more step/i,
    /checking your browser/i,
    /attention required/i,
  ] as readonly RegExp[],
  /**
   * Start-page CAPTCHA selectors. Live assisted DS-160 treats these as human
   * checkpoints; do not route them to CAPTCHA-solving APIs.
   */
  solvableCaptchaSelectors: [
    'img[id*="Captcha"]',
  ] as readonly string[],
  /**
   * Blocking gate selectors — anti-bot challenges the worker cannot solve.
   * These trigger ds160_blocked classification and skip retries.
   */
  blockingCaptchaSelectors: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenge"]',
    '#challenge-form',
    '.cf-browser-verification',
    '.g-recaptcha',
    '.h-captcha',
  ] as readonly string[],
  /**
   * Combined list for backward compatibility. Gate detection should use
   * blockingCaptchaSelectors only.
   * @deprecated Use blockingCaptchaSelectors or solvableCaptchaSelectors.
   */
  captchaSelectors: [
    'img[id*="Captcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenge"]',
    '#challenge-form',
    '.cf-browser-verification',
    '.g-recaptcha',
    '.h-captcha',
  ] as readonly string[],
} as const;

export const CEAC_SIGN_AND_SUBMIT_MARKERS = {
  headingPattern: /sign and submit/i,
  passportSignatureSelector:
    'input[id*="SIGN_PASSPORT"], input[name*="SignPassport"]',
  finalSubmitSelector:
    'input[type="submit"][value*="Sign and Submit"], input[id*="btnSignSubmit"]',
  captchaSelector: 'img[id*="Captcha"], [id*="c_defaultleftdefaultaspx_ctl00_sitecontentplaceholder_captcha1"]',
} as const;
