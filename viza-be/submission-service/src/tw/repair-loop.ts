import type { Page } from "@playwright/test";
import type { TwCaptchaSolveWithTelemetry } from "./captcha";
import {
  TwFieldVerificationError,
  TwFileUploadError,
  TwOfficialValidationError,
  TwUnexpectedPageError,
  type TwError,
} from "./errors";
import type { TwOfficialReceiptEvidence } from "./receipt";

export type TwRepairFailureCategory = "retryable" | "repairable" | "integrity_fatal";
export type TwRepairOperationKind = "text" | "select" | "radio" | "checkbox" | "date" | "file" | "button" | "section";

export interface TwRepairOperation {
  fieldKey: string;
  controlName: string;
  kind: TwRepairOperationKind;
  run(): Promise<void>;
}

export interface TwRepairFailure {
  fieldKey: string;
  controlName: string;
  kind: TwRepairOperationKind;
  category: TwRepairFailureCategory;
  errorType: string;
  message: string;
}

export interface TwOfficialValidationIssue {
  fieldKey?: string;
  controlName?: string;
  errorType: "html_invalid" | "official_required" | "official_invalid" | "captcha" | "unknown";
}

export interface TwRepairPlanItem {
  fieldKey: string;
  controlName: string;
  errorType: string;
  category: Exclude<TwRepairFailureCategory, "integrity_fatal">;
}

export interface TwRepairSubmissionResult {
  status: "submitted";
  receipt: TwOfficialReceiptEvidence;
  captchaSolve: TwCaptchaSolveWithTelemetry;
  rounds: number;
  repairPlan: TwRepairPlanItem[];
  failures: TwRepairFailure[];
}

export interface TwRepairPreSubmitResult {
  status: "ready_to_submit";
  captchaSolve: TwCaptchaSolveWithTelemetry;
  rounds: number;
  repairPlan: TwRepairPlanItem[];
  failures: TwRepairFailure[];
}

export type TwRepairLoopResult = TwRepairSubmissionResult | TwRepairPreSubmitResult;

export interface TwRepairSubmissionOptions {
  page: Page;
  operations: TwRepairOperation[];
  mode?: "submit" | "pre_submit";
  prepareSubmit?: () => Promise<TwCaptchaSolveWithTelemetry>;
  submit(): Promise<TwCaptchaSolveWithTelemetry>;
  readReceipt(): Promise<TwOfficialReceiptEvidence | null>;
  validate(): Promise<TwOfficialValidationIssue[]>;
  maxRounds?: number;
}

export async function runTwRepairSubmissionLoop(options: TwRepairSubmissionOptions): Promise<TwRepairLoopResult> {
  const maxRounds = options.maxRounds ?? 3;
  const mode = options.mode ?? "submit";
  const failures: TwRepairFailure[] = [];
  let repairPlan: TwRepairPlanItem[] = [];
  let lastCaptchaSolve: TwCaptchaSolveWithTelemetry | null = null;

  for (let round = 1; round <= maxRounds; round += 1) {
    const roundOps = round === 1 ? options.operations : operationsForPlan(options.operations, repairPlan);
    const roundFailures = await runOperations(roundOps);
    failures.push(...roundFailures);
    const fatal = roundFailures.find((failure) => failure.category === "integrity_fatal");
    if (fatal) {
      throw new TwUnexpectedPageError(
        `Taiwan repair loop hit an integrity-fatal field failure (${fatal.fieldKey}:${fatal.controlName}:${fatal.errorType})`,
        {
        url: options.page.url(),
        details: { failure: redactFailure(fatal), round },
        },
      );
    }

    const validationIssues = (await options.validate()).filter((issue) => issue.errorType !== "captcha");
    const validationFailures = issuesAsFailures(validationIssues, options.operations);
    throwIfIntegrityFatalValidation(validationFailures, options.page, round);
    repairPlan = buildTwRepairPlan([...roundFailures, ...validationFailures]);
    if (repairPlan.length > 0 && round < maxRounds) {
      continue;
    }
    if (repairPlan.length > 0) {
      break;
    }

    if (mode === "pre_submit") {
      const prepareSubmit = options.prepareSubmit;
      if (!prepareSubmit) {
        throw new TwUnexpectedPageError("Taiwan pre-submit mode requires a prepareSubmit CAPTCHA step", {
          url: options.page.url(),
          details: { round },
        });
      }
      lastCaptchaSolve = await prepareSubmit();
      const finalValidationIssues = (await options.validate()).filter((issue) => issue.errorType !== "captcha");
      const finalValidationFailures = issuesAsFailures(finalValidationIssues, options.operations);
      throwIfIntegrityFatalValidation(finalValidationFailures, options.page, round);
      repairPlan = buildTwRepairPlan(finalValidationFailures);
      if (repairPlan.length > 0) {
        if (round < maxRounds) continue;
        break;
      }
      return { status: "ready_to_submit", captchaSolve: lastCaptchaSolve, rounds: round, repairPlan, failures };
    }

    lastCaptchaSolve = await options.submit();
    const receipt = await options.readReceipt();
    if (receipt?.caseNumber) {
      return { status: "submitted", receipt, captchaSolve: lastCaptchaSolve, rounds: round, repairPlan, failures };
    }

    const postSubmitIssues = await options.validate();
    const postSubmitFailures = issuesAsFailures(postSubmitIssues, options.operations);
    throwIfIntegrityFatalValidation(postSubmitFailures, options.page, round);
    repairPlan = buildTwRepairPlan(postSubmitFailures);
    if (repairPlan.length === 0) {
      throw new TwUnexpectedPageError(
        "Taiwan final submit produced neither official receipt evidence nor recognizable validation errors",
        { url: options.page.url(), details: { round } },
      );
    }
  }

  const planSummary = repairPlan
    .map((item) => `${item.fieldKey}:${item.controlName}:${item.errorType}`)
    .slice(0, 8)
    .join(",");
  throw new TwUnexpectedPageError(
    `Taiwan repair loop exhausted without official receipt evidence${planSummary ? ` (${planSummary})` : ""}`,
    {
    url: options.page.url(),
    details: {
      maxRounds,
      repairPlan: repairPlan.map((item) => ({
        fieldKey: item.fieldKey,
        controlName: item.controlName,
        errorType: item.errorType,
        category: item.category,
      })),
      captchaAttempts: lastCaptchaSolve?.telemetry.length ?? 0,
    },
    },
  );
}

export async function collectTwOfficialValidationIssues(page: Page): Promise<TwOfficialValidationIssue[]> {
  const issues: TwOfficialValidationIssue[] = [];
  const invalidControls = page.locator("input, select, textarea");
  const invalidData = await invalidControls
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const style = window.getComputedStyle(el);
          const visible =
            !el.hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            el.getClientRects().length > 0;
          return visible && !el.disabled && typeof el.checkValidity === "function" && !el.checkValidity();
        })
        .map((node) => {
          const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          return {
            controlName: el.getAttribute("name") ?? el.id ?? el.tagName.toLowerCase(),
            required: el.validity.valueMissing,
          };
        })
        .slice(0, 50),
    )
    .catch(() => []);
  for (const item of invalidData) {
    issues.push({
      controlName: item.controlName,
      errorType: item.required ? "official_required" : "official_invalid",
    });
  }

  const errorTexts = await page
    .locator(
      ".invalid-feedback:visible, .text-danger:visible, .error:visible, [role='alert']:visible, [class*='invalid' i]:visible, [class*='error' i]:visible",
    )
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
          if (!text) return null;
          const doc = node.ownerDocument;
          const id = node.getAttribute("id");
          const forId = node.getAttribute("for");
          let control: Element | null = forId ? doc.getElementById(forId) : null;
          if (!control && id) {
            control = doc.querySelector(`[aria-describedby~="${CSS.escape(id)}"]`);
          }
          let container: Element | null = node;
          for (let depth = 0; !control && container && depth < 6; depth += 1, container = container.parentElement) {
            const candidates = Array.from(container.querySelectorAll("input, select, textarea"));
            control =
              candidates.find((candidate) => candidate.getAttribute("aria-invalid") === "true") ??
              candidates.find((candidate) => {
                const el = candidate as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                return typeof el.checkValidity === "function" && !el.checkValidity();
              }) ??
              (candidates.length === 1 ? candidates[0] : null);
          }
          return {
            text,
            controlName: control?.getAttribute("name") ?? control?.getAttribute("id") ?? undefined,
          };
        })
        .filter((item): item is { text: string; controlName: string | undefined } => item !== null)
        .slice(0, 20),
    )
    .catch(() => []);
  for (const item of errorTexts) {
    issues.push({ controlName: item.controlName, errorType: classifyOfficialErrorText(item.text) });
  }
  return dedupeValidationIssues(issues);
}

export async function assertTwOfficialValidationGate(
  page: Page,
  operations: TwRepairOperation[],
): Promise<void> {
  const issues = (await collectTwOfficialValidationIssues(page)).filter((issue) => issue.errorType !== "captcha");
  if (issues.length === 0) return;
  const failures = issuesAsFailures(issues, operations);
  throw new TwOfficialValidationError(validationKeysForFailures(failures), {
    url: page.url(),
    details: { validationCount: failures.length },
  });
}

export function buildTwRepairPlan(failures: TwRepairFailure[]): TwRepairPlanItem[] {
  const seen = new Set<string>();
  const plan: TwRepairPlanItem[] = [];
  for (const failure of failures) {
    if (failure.category === "integrity_fatal") continue;
    const key = `${failure.fieldKey}:${failure.controlName}:${failure.errorType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plan.push({
      fieldKey: failure.fieldKey,
      controlName: failure.controlName,
      errorType: failure.errorType,
      category: failure.category,
    });
  }
  return plan;
}

async function runOperations(operations: TwRepairOperation[]): Promise<TwRepairFailure[]> {
  const failures: TwRepairFailure[] = [];
  for (const operation of operations) {
    try {
      await operation.run();
    } catch (err) {
      failures.push(classifyTwRepairFailure(operation, err));
    }
  }
  return failures;
}

function operationsForPlan(operations: TwRepairOperation[], plan: TwRepairPlanItem[]): TwRepairOperation[] {
  if (plan.length === 0) return operations;
  const keys = new Set(plan.flatMap((item) => [item.fieldKey, item.controlName].filter(Boolean)));
  return operations.filter((operation) => keys.has(operation.fieldKey) || keys.has(operation.controlName));
}

function classifyTwRepairFailure(operation: TwRepairOperation, err: unknown): TwRepairFailure {
  const message = err instanceof Error ? err.message : String(err);
  return {
    fieldKey: operation.fieldKey,
    controlName: controlNameFromError(err) ?? operation.controlName,
    kind: operation.kind,
    category: classifyCategory(operation, err, message),
    errorType: errorTypeFromMessage(message),
    message,
  };
}

function classifyCategory(operation: TwRepairOperation, err: unknown, message: string): TwRepairFailureCategory {
  if (err instanceof TwFieldVerificationError || err instanceof TwFileUploadError) {
    if (/missing required VIZA value|missing required local file/i.test(message)) return "integrity_fatal";
    if (/not found|not present|not visible|not available/i.test(message)) return "retryable";
    return "repairable";
  }
  if (
    ["select", "radio", "checkbox", "date", "text", "file"].includes(operation.kind) &&
    /selectOption|Timeout|waiting for|option|not found|not visible|not enabled|Element is not|Target page/i.test(message)
  ) {
    return /Timeout|waiting for|not found|not visible|not enabled/i.test(message) ? "retryable" : "repairable";
  }
  return "integrity_fatal";
}

function errorTypeFromMessage(message: string): string {
  if (/missing required VIZA value|missing required local file/i.test(message)) return "integrity_fatal";
  if (/not found|not present|not visible|not available/i.test(message)) return "missing_control";
  if (/does not match|was not selected|was not checked/i.test(message)) return "value_mismatch";
  if (/upload/i.test(message)) return "upload_failed";
  return "unknown";
}

function controlNameFromError(err: unknown): string | null {
  const asTw = err as Partial<TwError>;
  const value = asTw.context?.details?.controlName;
  return typeof value === "string" ? value : null;
}

function issuesAsFailures(
  issues: TwOfficialValidationIssue[],
  operations: TwRepairOperation[],
): TwRepairFailure[] {
  return issues.map((issue) => {
    const operation = operations.find(
      (candidate) =>
        (issue.fieldKey && candidate.fieldKey === issue.fieldKey) ||
        (issue.controlName && candidate.controlName === issue.controlName),
    );
    return {
      fieldKey: issue.fieldKey ?? operation?.fieldKey ?? "unknown",
      controlName: issue.controlName ?? operation?.controlName ?? "unknown",
      kind: operation?.kind ?? "section",
      category:
        issue.errorType === "captcha"
          ? "retryable"
          : issue.errorType === "official_invalid" || issue.errorType === "unknown" || !operation
          ? "integrity_fatal"
          : issue.errorType === "official_required" || issue.errorType === "html_invalid"
            ? "repairable"
            : "retryable",
      errorType: issue.errorType,
      message: issue.errorType,
    };
  });
}

function throwIfIntegrityFatalValidation(
  failures: TwRepairFailure[],
  page: Page,
  round: number,
): void {
  const fatal = failures.filter((failure) => failure.category === "integrity_fatal");
  if (fatal.length === 0) return;
  throw new TwOfficialValidationError(validationKeysForFailures(fatal), {
    url: page.url(),
    details: { round, validationCount: fatal.length },
  });
}

function validationKeysForFailures(failures: TwRepairFailure[]): string[] {
  return failures.map((failure) =>
    failure.fieldKey && failure.fieldKey !== "unknown" ? failure.fieldKey : failure.controlName,
  );
}

function dedupeValidationIssues(issues: TwOfficialValidationIssue[]): TwOfficialValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.fieldKey ?? ""}:${issue.controlName ?? ""}:${issue.errorType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyOfficialErrorText(text: string): TwOfficialValidationIssue["errorType"] {
  if (/驗證碼|验证码|captcha/i.test(text)) return "captcha";
  if (/必填|請輸入|请选择|請選擇|required/i.test(text)) return "official_required";
  if (/錯誤|错误|不正確|invalid/i.test(text)) return "official_invalid";
  return "unknown";
}

function redactFailure(failure: TwRepairFailure): Record<string, unknown> {
  return {
    fieldKey: failure.fieldKey,
    controlName: failure.controlName,
    kind: failure.kind,
    category: failure.category,
    errorType: failure.errorType,
  };
}
