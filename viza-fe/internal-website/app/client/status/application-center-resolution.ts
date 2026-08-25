import type {
  ClientStatusState,
  StatusAction,
  StatusStepState,
} from "./status-data";

export type ApplicantIntakeSummary = {
  complete: boolean;
  questionnaireComplete: boolean;
  documentCollectionComplete: boolean;
};

export type ApplicationCenterResolution = {
  state: ClientStatusState;
  editable: boolean;
  rowHref: string;
  actions: StatusAction[] | null;
};

export function resolveApplicationCenterApplication(input: {
  lifecycleState: ClientStatusState;
  paymentState: StatusStepState;
  intake: ApplicantIntakeSummary | null;
  officialReadOnly: boolean;
  officialProcessing: boolean;
  paymentEligible: boolean;
  editHref: string;
  detailHref: string;
  checkoutHref: string;
}): ApplicationCenterResolution {
  if (input.officialReadOnly) {
    return {
      state: input.lifecycleState,
      editable: false,
      rowHref: input.detailHref,
      actions: null,
    };
  }

  if (!input.intake?.complete) {
    const documentsOnly = Boolean(
      input.intake?.questionnaireComplete &&
      !input.intake.documentCollectionComplete
    );
    return {
      state: documentsOnly ? "needs_documents" : "in_progress",
      editable: true,
      rowHref: input.editHref,
      actions: [{ key: "continueForm", href: input.editHref, primary: true }],
    };
  }

  if (input.paymentState !== "complete") {
    if (!input.paymentEligible) {
      return {
        state: "in_progress",
        editable: true,
        rowHref: input.editHref,
        actions: [{ key: "continueForm", href: input.editHref, primary: true }],
      };
    }
    return {
      state: "needs_payment",
      editable: true,
      rowHref: input.editHref,
      actions: [
        { key: "pay", href: input.checkoutHref, primary: true },
        { key: "continueForm", href: input.editHref, primary: false },
      ],
    };
  }

  if (input.officialProcessing) {
    return {
      state: input.lifecycleState,
      editable: false,
      rowHref: input.detailHref,
      actions: null,
    };
  }

  return {
    state:
      input.lifecycleState === "needs_payment" ||
      input.lifecycleState === "not_started"
        ? "in_progress"
        : input.lifecycleState,
    editable: true,
    rowHref: input.editHref,
    actions: null,
  };
}
