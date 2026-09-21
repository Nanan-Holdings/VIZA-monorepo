import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  submitted: false,
  saveBarrier: null as Promise<void> | null,
  saveError: null as string | null,
  submissionPosts: [] as string[],
  statusPropsHistory: [] as Array<Record<string, unknown>>,
  dynamicPropsHistory: [] as Array<Record<string, unknown>>,
  reviewPropsHistory: [] as Array<Record<string, unknown>>,
  assistantPropsHistory: [] as Array<Record<string, unknown>>,
  completionInputs: [] as Array<{
    effectiveStepIds: number[];
    effectiveStepNames: string[];
    answers: Record<string, string>;
  }>,
  tabCompletionCalls: 0,
  assistantProgressCalls: 0,
  automaticValidationCalls: 0,
  saveDynamicAnswersCalls: [] as Array<{
    applicationId: string;
    answers: Record<string, unknown>;
  }>,
  initialDynamicAnswers: {} as Record<string, string>,
  validationRequestStarted: Promise.withResolvers<void>(),
  resolveValidation: null as ((value: unknown) => void) | null,
}));

const routeParams = new URLSearchParams(
  "applicationId=application-1&country=united_states&visaType=DS160",
);
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => routeParams,
  usePathname: () => "/client/application/long-form",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => <span aria-hidden="true" />;
  return {
    CircleNotch: Icon,
    Check: Icon,
    CaretDown: Icon,
    ShieldCheck: Icon,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("next-intl", () => {
  const translate = Object.assign((key: string) => key, { has: () => false });
  return {
    useLocale: () => "en",
    useTranslations: () => translate,
  };
});

vi.mock("country-data-list", () => ({ countries: { all: [] } }));
vi.mock("@/hooks/use-content-alignment", () => ({ useContentAlignment: () => 0 }));
vi.mock("../use-content-alignment", () => ({ useContentAlignment: () => 0 }));

vi.mock("@/components/ui/alert", () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Alert: Wrapper, AlertDescription: Wrapper, AlertIcon: Wrapper, AlertTitle: Wrapper };
});

vi.mock("@/components/ui/application-form-panel", () => ({
  ApplicationFormPanel: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <section {...props}>{children}</section>
  ),
}));

vi.mock("@/components/ui/application-checkbox", () => ({
  ApplicationCheckbox: () => null,
}));

vi.mock("@/app/client/documents/document-center-client", () => ({
  DocumentCenterClient: () => null,
}));
vi.mock("@/components/client/client-error-alert", () => ({ ClientErrorAlert: () => null }));
vi.mock("@/components/smooth-progress", () => ({ SmoothProgressBar: () => null }));
vi.mock("@/components/client/passport-ocr-upload", () => ({ PassportOcrUpload: () => null }));
vi.mock("@/components/client/brand-action-button", () => ({
  BrandActionButton: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/application-steps/universal-profile-sync-card", () => ({
  UniversalProfileSyncCard: () => null,
}));
vi.mock("../../_components/result-cards/SubmissionStatusStep", () => ({
  SubmissionStatusStep: (props: Record<string, unknown>) => {
    testState.statusPropsHistory.push(props);
    return <button type="button">Download confirmation</button>;
  },
}));

vi.mock("@/components/application-steps", () => {
  const Empty = () => null;
  return {
    PersonalInfoStep: Empty,
    PassportStep: Empty,
    TravelInfoStep: Empty,
    ReviewStep: Empty,
    DynamicReviewStep: (props: Record<string, unknown>) => {
      testState.reviewPropsHistory.push(props);
      return null;
    },
    TeamStep: Empty,
  };
});

vi.mock("@/components/dynamic-step-form", () => {
  const DynamicStepForm = (props: Record<string, unknown>) => {
    testState.dynamicPropsHistory.push(props);
    const onDraftChange = props.onDraftChange as (data: Record<string, string>) => void;
    const step = props.step as { stepNumber?: number };
    const isFirstStep = step.stepNumber === 1;
    return (
      <>
        <button
          type="button"
          data-testid={isFirstStep ? "dynamic-edit" : `dynamic-edit-step-${step.stepNumber ?? "unknown"}`}
          onClick={() => onDraftChange(isFirstStep ? { first_name: "edited" } : { alternate_details: "edited-second" })}
        >
          Edit
        </button>
        {isFirstStep ? (
          <button
            type="button"
            data-testid="dynamic-branch-edit"
            onClick={() => onDraftChange({ branch: "alternate" })}
          >
            Switch branch
          </button>
        ) : null}
        {isFirstStep ? (
          <button
            type="button"
            data-testid="dynamic-branch-revert"
            onClick={() => onDraftChange({ branch: "base" })}
          >
            Revert branch
          </button>
        ) : null}
        {isFirstStep ? (
          <button
            type="button"
            data-testid="dynamic-nationality-edit"
            onClick={() => onDraftChange({ nationality_country: "JPN" })}
          >
            Edit nationality
          </button>
        ) : null}
      </>
    );
  };
  return {
    DynamicStepForm,
    ensureVnPrearrivalOtherFlightFlow: (steps: unknown) => steps,
  };
});

vi.mock("@/components/client/form-assistant", () => {
  const FormFillingAssistant = (props: Record<string, unknown>) => {
    testState.assistantPropsHistory.push(props);
    const onValidate = props.onValidate as () => Promise<unknown>;
    return (
      <button type="button" data-testid="assistant-validate" onClick={() => void onValidate()}>
        Validate
      </button>
    );
  };
  return { FormFillingAssistant };
});

vi.mock("@/app/actions/visa-form-fields", () => ({
  getVisaFormSteps: vi.fn(async () => [
    {
      stepNumber: 1,
      stepName: "Personal",
      fields: [{
        id: "field-1",
        visaType: "DS160",
        fieldName: "branch",
        label: "Branch",
        fieldType: "radio",
        required: false,
        stepNumber: 1,
        stepName: "Personal",
        displayOrder: 1,
        placeholder: null,
        validationRules: null,
        options: ["base", "alternate"],
        conditionalLogic: null,
      }],
    },
    {
      stepNumber: 2,
      stepName: "Alternate details",
      fields: [{
        id: "field-2",
        visaType: "DS160",
        fieldName: "alternate_details",
        label: "Alternate details",
        fieldType: "text",
        required: true,
        stepNumber: 2,
        stepName: "Alternate details",
        displayOrder: 1,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: { showIf: "branch === alternate" },
      }],
    },
  ]),
}));

vi.mock("@/app/client/documents/actions", () => ({
  loadDocumentCenterData: vi.fn(async () => ({
    ok: true,
    data: { documents: [], selectedApplication: { id: "application-1" } },
  })),
}));

vi.mock("@/app/actions/application-group", () => ({
  getTeamApplicationContext: vi.fn(async () => ({
    ok: true,
    application: {
      id: "application-1",
      country: "united_states",
      visa_type: "DS160",
      status: "draft",
      purpose: "VIZA_PLACEHOLDER_DRY_RUN",
    },
    profile: { full_name: "Ada Lovelace", nationality: "United Kingdom" },
  })),
  markTeamCompanionReviewed: vi.fn(),
}));

vi.mock("@/app/actions/visa-application-answers", () => ({
  loadApplicationFormContext: vi.fn(),
  loadDynamicAnswers: vi.fn(async () => ({ answers: testState.initialDynamicAnswers })),
  saveDynamicAnswers: vi.fn(async (applicationId: string, answers: Record<string, unknown>) => {
    testState.saveDynamicAnswersCalls.push({ applicationId, answers });
    if (testState.saveBarrier) await testState.saveBarrier;
    if (testState.saveError) return { error: testState.saveError };
    return { ok: true };
  }),
  ensureDraftApplication: vi.fn(),
}));
vi.mock("@/app/actions/ds160-normalize", () => ({ persistDS160AnswerSet: vi.fn() }));
vi.mock("@/app/actions/user-package", () => ({ getUserVisaPackage: vi.fn() }));

vi.mock("@/lib/visa-form-schema-aliases", () => ({
  resolveVisaFormSchemaVisaType: (value: string) => value,
}));
vi.mock("@/lib/form-utils", () => ({
  evaluateShowIf: (
    field: { conditionalLogic?: { showIf?: unknown } | null },
    answers: Record<string, string>,
  ) => field.conditionalLogic?.showIf === "branch === alternate"
    ? answers.branch === "alternate"
    : true,
}));
vi.mock("@/lib/visa-destinations", () => ({
  getCanonicalApplicationProductCountry: (country: string) => country,
  getFormVisaType: (visaType: string) => visaType,
  getVisaPackageTitle: () => "DS-160",
}));
vi.mock("@/lib/applications/ongoing-application", () => ({ applicationIdentityMatches: () => true }));
vi.mock("@/lib/universal-profile-prefill", () => ({
  buildMalaysiaMdacUniversalProfileAnswerPatch: () => ({}),
  buildUniversalProfileAnswerPatch: () => ({}),
  mergeUniversalProfileIntoAnswers: (answers: Record<string, string>) => answers,
  splitUniversalFullName: () => ({ givenNames: "", surname: "" }),
}));
vi.mock("@/lib/form-assistant/bootstrap", () => ({ shouldBootstrapFormAssistantDraft: () => false }));
vi.mock("@/lib/form-assistant/constants", () => ({
  canUseFormAssistant: () => true,
  isFormAssistantConfirmationField: () => false,
}));
vi.mock("@/lib/form-assistant/review-issues", () => ({
  buildFormAssistantFieldReviewIssues: () => [],
  getBaseAnswerFieldName: (value: string) => value,
  normalizeFormAssistantValidationResponse: (value: unknown) => value,
}));
vi.mock("@/lib/application-tab-completion", () => ({
  computeAllTabCompletion: (input: {
    effectiveSteps: Array<{ id: number; name: string }>;
    answers: Record<string, string>;
  }) => {
    testState.tabCompletionCalls += 1;
    testState.completionInputs.push({
      effectiveStepIds: input.effectiveSteps.map((step) => step.id),
      effectiveStepNames: input.effectiveSteps.map((step) => step.name),
      answers: { ...input.answers },
    });
    return { completedStepIds: [], missingFields: [] };
  },
  getApplicationFieldErrorMessage: () => "Invalid",
  getContiguousCompletedCount: () => 0,
  getMissingRequiredDocumentRequirementKeys: () => [],
  getRequiredDocumentProgress: () => ({ completed: 0, total: 0 }),
}));
vi.mock("@/lib/form-assistant/validator", () => ({
  getAssistantProgress: () => {
    testState.assistantProgressCalls += 1;
    return { completed: 0, total: 1 };
  },
  validateApplicationAnswers: () => {
    testState.automaticValidationCalls += 1;
    return { errors: [], warnings: [], canReview: true, validationId: "auto" };
  },
}));
vi.mock("@/lib/application-submission-display", () => ({
  shouldShowReviewAlongsideSubmissionStatus: () => testState.submitted,
  shouldShowSubmissionStatusStep: (input: { submissionResultStatus?: string }) =>
    testState.submitted || ["waiting", "submitted"].includes(input.submissionResultStatus ?? ""),
}));
vi.mock("@/lib/form-assistant/submission-readonly", () => ({
  hasSuccessfulFormSubmission: (input: { submissionResult?: { status?: string } }) =>
    testState.submitted || input.submissionResult?.status === "submitted",
  toSubmittedFormAssistantProgress: (progress: unknown) => progress,
  toSubmittedFormAssistantState: (state: unknown) => state,
}));
vi.mock("@/lib/runtime-abort-errors", () => ({ isIgnorableRuntimeAbortError: () => false }));
vi.mock("@/features/kr-arrival-card/config", () => ({ isKoreaEArrivalCardLiveEnabled: () => false }));
vi.mock("@/features/kr-arrival-card/preflight", () => ({
  canCreateKoreaArrivalCardDraft: () => true,
  validateKoreaEArrivalPreflight: () => ({ ok: false }),
}));
vi.mock("@/features/kr-arrival-card/schema-availability", () => ({ isKoreaArrivalCardSchemaUnavailable: () => false }));
vi.mock("@/app/client/arrival-cards/south-korea/gate", () => ({ KoreaArrivalCardEligibilityGate: () => null }));
vi.mock("@/features/kr-arrival-card/routes", () => ({ buildKoreaArrivalCardFormHref: () => "/" }));
vi.mock("@/lib/server-action-recovery", () => ({
  attemptStaleServerActionReload: vi.fn(),
  isStaleServerActionError: () => false,
}));
vi.mock("@/lib/application-step-sections", () => ({
  buildApplicationStepSections: (steps: unknown[]) => [{ id: "personal", key: "personal", title: "Personal", steps }],
  getDynamicStepTranslationCandidates: () => [],
  initializeExpandedSectionState: () => ({}),
}));
vi.mock("@/lib/taiwan-entry-permit-layout", () => ({
  buildTaiwanEntryPermitSections: () => [],
  isTaiwanEntryPermitQualificationStepSource: () => false,
  shouldShowStandaloneDocumentStep: (show: boolean) => show,
}));
vi.mock("@/lib/submission-queue", () => ({
  isDs160VisaType: () => true,
  isDigitalArrivalCardApplication: () => false,
  isIndonesiaEVisaApplication: () => false,
  isJapanVisitJapanWebApplication: () => false,
  isKenyaEtaApplication: () => false,
  isKoreaEArrivalCardApplication: () => false,
  isMalaysiaMdacApplication: () => false,
  isFranceVisasVisaType: () => false,
  isPhilippinesEtravelApplication: () => false,
  isSgArrivalCardApplication: () => false,
  isThailandTdacApplication: () => false,
  isUkStandardVisitorApplication: () => false,
  isVietnamEVisaApplication: () => false,
  isVietnamPrearrivalApplication: () => false,
}));
vi.mock("@/lib/taiwan-entry-permit-document-requirements", () => ({
  getTaiwanEntryPermitExtraRequirements: () => [],
  getTaiwanEntryPermitRequiredDocumentKeys: () => [],
  getTaiwanEntryPermitVisibleDocumentKeys: () => [],
}));
vi.mock("@/lib/client/recent-application-form", () => ({
  buildApplicationFormHref: () => "/client/application/long-form",
  buildApplicationLongFormHref: () => "/client/application/long-form",
  setRecentApplicationFormHref: vi.fn(),
}));
vi.mock("@/lib/client/active-application-selection", () => ({ setActiveApplicationSelection: vi.fn() }));
vi.mock("@/lib/client/application-route-params", () => ({
  readApplicationRouteParam: (params: URLSearchParams, ...keys: string[]) =>
    keys.map((key) => params.get(key)).find(Boolean) ?? null,
}));
vi.mock("@/app/api/applications/customer-submission-result", () => ({ sanitizeCustomerSubmissionResult: (value: unknown) => value }));

const response = (payload: unknown) => ({
  ok: true,
  json: async () => payload,
});

beforeEach(() => {
  testState.submitted = false;
  testState.saveBarrier = null;
  testState.saveError = null;
  testState.submissionPosts.length = 0;
  testState.statusPropsHistory.length = 0;
  testState.dynamicPropsHistory.length = 0;
  testState.reviewPropsHistory.length = 0;
  testState.assistantPropsHistory.length = 0;
  testState.completionInputs.length = 0;
  testState.tabCompletionCalls = 0;
  testState.assistantProgressCalls = 0;
  testState.automaticValidationCalls = 0;
  testState.saveDynamicAnswersCalls.length = 0;
  testState.initialDynamicAnswers = {};
  testState.validationRequestStarted = Promise.withResolvers<void>();
  testState.resolveValidation = null;
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "(min-width: 1024px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/retry-submission")) {
      testState.submissionPosts.push(String(init?.body));
      return response({ jobId: "mock-job", queueStatus: "queued" }) as Response;
    }
    if (url.includes("form-assistant?") && !url.includes("/validate")) {
      return response({
        sessionId: "assistant-session",
        assistantMessage: "Ready",
        messages: [],
        missingFields: [],
        aiFilledFieldNames: [],
        progress: { completed: 0, total: 1 },
        canRunFinalCheck: true,
      }) as Response;
    }
    if (url.includes("/form-assistant/validate")) {
      testState.validationRequestStarted.resolve();
      const payload = await new Promise<unknown>((resolve) => {
        testState.resolveValidation = resolve;
      });
      return response(payload) as Response;
    }
    return response({}) as Response;
  }) as typeof fetch;
});

describe("long form page orchestration", () => {
  it("waits for the latest save before enqueueing once and advancing to status", async () => {
    const barrier = Promise.withResolvers<void>();
    testState.saveBarrier = barrier.promise;
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Submit$/ })).toBeEnabled());
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));

    fireEvent.click(screen.getByTestId("dynamic-edit"));
    const submit = screen.getByRole("button", { name: /^Submit$/ });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(testState.saveDynamicAnswersCalls.length).toBeGreaterThan(0));
    expect(testState.submissionPosts).toHaveLength(0);
    expect(testState.saveDynamicAnswersCalls.at(-1)?.answers.first_name).toBe("edited");

    await act(async () => { barrier.resolve(); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Download confirmation" })).toBeEnabled());
    expect(testState.submissionPosts).toHaveLength(1);
    expect(JSON.parse(testState.submissionPosts[0])).toMatchObject({ visaType: "DS160" });
    expect(screen.queryByRole("button", { name: /^Submit$/ })).not.toBeInTheDocument();

    const onResult = testState.statusPropsHistory.at(-1)?.onSubmissionResult as
      (update: { status: string; result: { country: string; status: string; applicationId: string } }) => void;
    act(() => onResult({
      status: "submitted",
      result: { country: "US", status: "submitted", applicationId: "AA00TEST01" },
    }));
    await waitFor(() => expect(screen.getByTestId("dynamic-edit")).toBeDisabled());
    expect(screen.getByRole("button", { name: "Download confirmation" })).toBeEnabled();
  });

  it("keeps the draft editable and never enqueues when saving fails", async () => {
    testState.saveError = "Save failed. Please retry.";
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Submit$/ })).toBeEnabled());
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));

    fireEvent.click(screen.getByTestId("dynamic-edit"));
    fireEvent.click(screen.getByRole("button", { name: /^Submit$/ }));
    await waitFor(() => expect(screen.getByText("Save failed. Please retry.")).toBeInTheDocument());
    expect(testState.submissionPosts).toHaveLength(0);
    expect(screen.getByTestId("dynamic-edit")).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Submit$/ })).toBeEnabled();
  });

  it("locks submitted form controls and stale save callbacks while leaving confirmation downloads available", async () => {
    testState.submitted = true;
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(screen.getByTestId("dynamic-edit")).toBeDisabled());
    expect(screen.getByRole("button", { name: "Download confirmation" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Submit$/ })).not.toBeInTheDocument();
    expect(testState.reviewPropsHistory.at(-1)?.readOnly).toBe(true);
    expect(testState.reviewPropsHistory.at(-1)?.onSaveOfficialValue).toBeUndefined();

    const props = testState.dynamicPropsHistory.at(-1)!;
    await act(async () => {
      (props.onDraftChange as (answers: Record<string, string>) => void)({ first_name: "changed" });
      await (props.onComplete as (answers: Record<string, string>) => Promise<void>)({ first_name: "changed" });
    });
    expect(testState.saveDynamicAnswersCalls).toHaveLength(0);
  });

  it("keeps dynamic form props reusable after a draft snapshot refresh", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));
    const initialProps = testState.dynamicPropsHistory.at(-1)!;

    await act(async () => {
      fireEvent.click(screen.getByTestId("dynamic-edit"));
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    });
    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(1));

    const refreshedProps = testState.dynamicPropsHistory.at(-1)!;
    expect(refreshedProps.step).toBe(initialProps.step);
    expect(refreshedProps.onComplete).toBe(initialProps.onComplete);
    expect(refreshedProps.onDraftChange).toBe(initialProps.onDraftChange);
    expect(refreshedProps.aiFilledFieldNames).toBe(initialProps.aiFilledFieldNames);
    expect(refreshedProps.invalidFieldNames).toBe(initialProps.invalidFieldNames);
    expect(refreshedProps.invalidFieldMessages).toBe(initialProps.invalidFieldMessages);
  });

  it("rejects a validation response captured before an in-flight edit", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.assistantPropsHistory.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId("assistant-validate"));
    await testState.validationRequestStarted.promise;

    fireEvent.click(screen.getByTestId("dynamic-edit"));
    testState.resolveValidation?.({
      validationId: "stale-response",
      errors: [{ code: "stale", message: "stale", fieldNames: ["first_name"] }],
      warnings: [],
      canReview: false,
      progress: { completed: 0, total: 1 },
      missingFields: [],
    });

    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));
    expect(testState.assistantPropsHistory.at(-1)?.validationResult).toBeNull();
  });

  it("debounces whole-page answer derivations during a typing burst", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));
    await waitFor(() => expect(testState.reviewPropsHistory.length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    });

    const baseline = {
      tabCompletionCalls: testState.tabCompletionCalls,
      assistantProgressCalls: testState.assistantProgressCalls,
      automaticValidationCalls: testState.automaticValidationCalls,
      reviewPropsCount: testState.reviewPropsHistory.length,
    };

    await act(async () => {
      fireEvent.click(screen.getByTestId("dynamic-edit"));
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      fireEvent.click(screen.getByTestId("dynamic-edit"));
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    expect(testState.tabCompletionCalls).toBe(baseline.tabCompletionCalls);
    expect(testState.assistantProgressCalls).toBe(baseline.assistantProgressCalls);
    expect(testState.automaticValidationCalls).toBe(baseline.automaticValidationCalls);
    expect(testState.reviewPropsHistory).toHaveLength(baseline.reviewPropsCount);

    await waitFor(() => {
      expect(testState.reviewPropsHistory.at(-1)?.dynamicAnswers).toMatchObject({
        first_name: "edited",
      });
    }, { timeout: 1000 });
    expect(testState.tabCompletionCalls).toBeGreaterThan(baseline.tabCompletionCalls);
  });

  it("uses the latest draft at submission even before the derived snapshot debounce", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());

    const reviewCountBeforeEdit = testState.reviewPropsHistory.length;
    fireEvent.click(screen.getByTestId("dynamic-edit"));
    expect(testState.reviewPropsHistory).toHaveLength(reviewCountBeforeEdit);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(testState.saveDynamicAnswersCalls.length).toBeGreaterThan(0));

    expect(testState.saveDynamicAnswersCalls.at(-1)?.answers).toMatchObject({
      first_name: "edited",
    });
  });

  it("uses the latest visible branch for submission validation before debounce", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());

    const initialCompletion = testState.completionInputs.at(-1);
    expect(initialCompletion?.effectiveStepIds).not.toContain(1);
    const reviewCountBeforeBranchEdit = testState.reviewPropsHistory.length;

    fireEvent.click(screen.getByTestId("dynamic-branch-edit"));
    expect(testState.reviewPropsHistory).toHaveLength(reviewCountBeforeBranchEdit);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(testState.completionInputs.at(-1)?.effectiveStepIds).toContain(1);
    });
    expect(testState.completionInputs.at(-1)?.answers).toMatchObject({
      branch: "alternate",
    });
  });

  it("projects unsaved DS-160 structural controllers into dynamic prefill", async () => {
    testState.initialDynamicAnswers = {
      branch: "base",
      nationality_country: "CHN",
      marital_status: "single",
      date_of_birth: "2000-01-01",
      has_specific_plans: "no",
      intended_length_of_stay_unit: "DAY(S)",
      saved_answer: "persisted",
    };
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    expect((testState.dynamicPropsHistory.at(-1)?.prefill as Record<string, string>).nationality_country)
      .toBe("CHN");

    fireEvent.click(screen.getByTestId("dynamic-nationality-edit"));
    await waitFor(() => {
      expect((testState.dynamicPropsHistory.at(-1)?.prefill as Record<string, string>).nationality_country)
        .toBe("JPN");
    });

    // The structural projection updates before the 30-second persistence timer
    // and leaves ordinary persisted answers intact.
    expect(testState.saveDynamicAnswersCalls).toHaveLength(0);
    expect((testState.dynamicPropsHistory.at(-1)?.prefill as Record<string, string>).saved_answer)
      .toBe("persisted");
  });

  it("refreshes a branch when a draft moves A to B and back to the saved A value", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    expect(screen.queryByTestId("dynamic-edit-step-2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("dynamic-branch-edit"));
    await waitFor(() => expect(screen.getByTestId("dynamic-edit-step-2")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("dynamic-branch-revert"));
    await waitFor(() => expect(screen.queryByTestId("dynamic-edit-step-2")).not.toBeInTheDocument());

    // No autosave is needed for this assertion; the visible branch must still
    // follow the current draft when it returns to the persisted value.
    expect(testState.saveDynamicAnswersCalls).toHaveLength(0);
  });

  it("flushes every dirty dynamic panel when navigation reads a stale current step", async () => {
    const { default: ApplicationPage } = await import("../page");
    render(<ApplicationPage />);

    await waitFor(() => expect(testState.dynamicPropsHistory.length).toBeGreaterThan(0));
    await waitFor(() => expect(testState.assistantPropsHistory.at(-1)?.loading).toBe(false));

    // Keep the scroll observer from advancing currentStep while the second
    // panel is edited. This models a click arriving before its async update.
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = vi.fn(() => 0) as unknown as typeof window.requestAnimationFrame;
    try {
      fireEvent.click(screen.getByTestId("dynamic-branch-edit"));
      await waitFor(() => expect(screen.getByTestId("dynamic-edit-step-2")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("dynamic-edit-step-2"));

      // Navigate to the newly visible panel before the stale currentStep can
      // catch up. The old implementation only saved the first panel here.
      fireEvent.click(screen.getAllByRole("button", { name: /Alternate details/ })[0]);

      await waitFor(() => expect(testState.saveDynamicAnswersCalls.length).toBeGreaterThan(0));
      expect(testState.saveDynamicAnswersCalls.at(-1)?.answers).toMatchObject({
        branch: "alternate",
        alternate_details: "edited-second",
      });

      // The first click leaves the page's currentStep at the target. A later
      // edit in the other panel must still flush when targetStepId ===
      // currentStep; the old early return dropped this write entirely.
      fireEvent.click(screen.getByTestId("dynamic-edit"));
      fireEvent.click(screen.getAllByRole("button", { name: /Alternate details/ })[0]);
      await waitFor(() => expect(testState.saveDynamicAnswersCalls.at(-1)?.answers).toMatchObject({
        first_name: "edited",
      }));
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
