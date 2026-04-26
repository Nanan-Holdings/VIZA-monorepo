/**
 * Per-country simplified-form wizard contract.
 *
 * The shell at `wizards/shell/wizard-shell.tsx` manages navigation,
 * application draft creation, persistence, auto-save, and the long-form
 * fallback footer link. Each country provides a `WizardConfig` that
 * declares its step list, payload mapping, and submit redirect target.
 */
import type { ReactNode } from "react";

export interface StepRenderArgs<TForm> {
  form: TForm;
  setForm: (updater: (prev: TForm) => TForm) => void;
  applicationId: string | null;
  onContinue: () => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  goToStep: (index: number) => void;
}

export interface WizardStep<TForm> {
  /** Stable url-safe identifier — used for analytics and step `key=` props. */
  key: string;
  /** i18n key resolved against the wizard's `i18nNamespace` (e.g. `steps.identity`). */
  titleKey: string;
  /** Optional gate — return false to skip this step (e.g. US Stay only when has-plans). */
  showIf?: (form: TForm) => boolean;
  /** Render the step body. Receives every shell-level helper inline. */
  render: (args: StepRenderArgs<TForm>) => ReactNode;
}

export interface WizardConfig<TForm> {
  /** Matches `visa_packages.visa_type` (DS160, UK_STANDARD_VISITOR, …). */
  visaType: string;
  /** Country/visa_type passed to `ensureDraftApplication` when no package is resolvable. */
  defaultCountry: string;
  defaultVisaType: string;
  /** Stable empty form blueprint — must be deterministic and side-effect-free. */
  emptyForm: () => TForm;
  /** Country-aware step list — order matters. */
  steps: WizardStep<TForm>[];
  /** Translates the form into the canonical DS-160 / UK / Schengen / VN / AU answer keys. */
  buildAnswerPayload: (form: TForm) => Record<string, string>;
  /**
   * Optional contact-email seeding hook. The shell passes the user's auth
   * email to `seedAuthEmail` whenever it can — keeps the per-country form
   * shape opaque to the shell.
   */
  seedAuthEmail?: (form: TForm, email: string) => TForm;
  /** Translation namespace under `messages.json` (e.g. `simplifiedForm.us`). */
  i18nNamespace: string;
  /** Where to send the user after submit (defaults to `/client/application/long-form`). */
  onSubmitRedirect?: string;
  /**
   * Per-country review section definitions. Each country declares the
   * groupings it wants — `WizardReview` consumes this to render a uniform
   * "Section title → list of label/value rows" UI across countries while
   * keeping the actual schema content country-specific.
   */
  reviewSections: (form: TForm) => WizardReviewSection[];
}

/** One named review group on the per-country review screen. */
export interface WizardReviewSection {
  /** i18n key resolved against the wizard's `i18nNamespace` (e.g. `review.identity`). */
  titleKey: string;
  /** Step the user jumps to when they hit "Edit" on this section. */
  editStepKey?: string;
  rows: WizardReviewRow[];
}

export interface WizardReviewRow {
  /** i18n key OR a literal label string (when prefixed `literal:`). */
  labelKey: string;
  value: string;
}
