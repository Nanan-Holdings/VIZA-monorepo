/**
 * DS-160 repeat-row decoding and execution contracts.
 *
 * The UI persists repeat rows as flat answer keys.  This module decodes those
 * keys without renumbering rows, then hands each row to an injected CEAC
 * mapper/filler.  It intentionally contains no CEAC field-filling code and
 * no live selectors: the checked-in selector plans are unverified metadata.
 */

import {
  DS160_REPEAT_GROUP_CONTRACTS,
  DS160_REPEAT_GROUP_NAMES,
  getDs160RepeatGroupContract,
  type Ds160RepeatGroupContract,
  type Ds160RepeatGroupName,
  type RepeatControlLocatorStrategy,
} from "../ds160-repeat-contract";

export type Ds160FlatAnswers = Readonly<Record<string, unknown>>;

export interface ParsedRepeatStorageKey {
  readonly baseFieldKey: string;
  readonly index: number;
  readonly storageKey: string;
}

export interface Ds160RepeatRow {
  readonly group: Ds160RepeatGroupName;
  /** Zero-based row index. The frontend's first row is index 0. */
  readonly index: number;
  /** Empty for index 0, then `__2`, `__3`, and so on. */
  readonly storageSuffix: string;
  /** Only persisted values are present; absent optional fields stay absent. */
  readonly values: Readonly<Record<string, string>>;
  /** Canonical field key to the exact persisted key used for that value. */
  readonly sourceKeys: Readonly<Record<string, string>>;
}

export interface DecodedDs160RepeatGroup {
  readonly contract: Ds160RepeatGroupContract;
  readonly rows: readonly Ds160RepeatRow[];
  readonly highestIndex: number | null;
  /** Missing indexes are reported, never silently compacted. */
  readonly missingIndices: readonly number[];
  readonly hasGaps: boolean;
  readonly recognizedStorageKeys: readonly string[];
}

export type Ds160RepeatGroupErrorCode =
  | "invalid_storage_key"
  | "invalid_answer_value"
  | "unknown_group"
  | "unverified_condition_evaluator"
  | "unverified_selector_strategy"
  | "row_count_exceeds_contract"
  | "invalid_row_count"
  | "row_count_not_reconciled";

/**
 * Public error used by callers to distinguish a fail-closed schema/selector
 * issue from a portal error.  It carries no applicant answer values.
 */
export class Ds160RepeatGroupError extends Error {
  readonly code: Ds160RepeatGroupErrorCode;
  readonly group: string;
  readonly verified = false;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: Ds160RepeatGroupErrorCode,
    group: string,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "Ds160RepeatGroupError";
    this.code = code;
    this.group = group;
    this.details = details;
  }
}

/**
 * Decode the suffix used by dynamic-step-form's `instanceKey` helper.
 * `field__1` is intentionally invalid because the first row uses `field`.
 */
export function parseRepeatStorageKey(key: string): ParsedRepeatStorageKey | null {
  const match = key.match(/^(.+)__(\d+)$/);
  if (!match) return null;

  const suffixNumber = Number(match[2]);
  if (
    !Number.isSafeInteger(suffixNumber) ||
    suffixNumber < 2 ||
    String(suffixNumber) !== match[2]
  ) {
    return null;
  }

  return {
    baseFieldKey: match[1],
    index: suffixNumber - 1,
    storageKey: key,
  };
}

/** Build the exact persisted key for a zero-based row index. */
export function repeatStorageKey(fieldKey: string, index: number): string {
  if (!fieldKey.trim()) {
    throw new Ds160RepeatGroupError(
      "invalid_storage_key",
      "unknown",
      "A repeat field key must not be empty.",
    );
  }
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Ds160RepeatGroupError(
      "invalid_storage_key",
      "unknown",
      "A repeat row index must be a non-negative safe integer.",
    );
  }
  if (index === 0) return fieldKey;

  const suffixNumber = index + 1;
  if (!Number.isSafeInteger(suffixNumber)) {
    throw new Ds160RepeatGroupError(
      "invalid_storage_key",
      "unknown",
      "A repeat row index cannot be represented by the persisted key format.",
    );
  }
  return `${fieldKey}__${suffixNumber}`;
}

function resolveContract(
  contractOrGroup: Ds160RepeatGroupName | Ds160RepeatGroupContract,
): Ds160RepeatGroupContract {
  if (typeof contractOrGroup !== "string") return contractOrGroup;

  const resolved = DS160_REPEAT_GROUP_CONTRACTS[contractOrGroup];
  if (!resolved) {
    throw new Ds160RepeatGroupError(
      "unknown_group",
      contractOrGroup,
      `No DS-160 repeat-group contract is registered for "${contractOrGroup}".`,
    );
  }
  return resolved;
}

function normalizeAnswerValue(
  value: unknown,
  group: Ds160RepeatGroupName,
  storageKey: string,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  throw new Ds160RepeatGroupError(
    "invalid_answer_value",
    group,
    `Persisted answer for repeat key "${storageKey}" is not a scalar value.`,
    { storageKey },
  );
}

interface RowBuilder {
  readonly values: Record<string, string>;
  readonly sourceKeys: Record<string, string>;
  readonly sourcePriority: Record<string, number>;
}

/**
 * Decode one seed repeat group from the flat `visa_application_answers` map.
 * A row is created as soon as any recognized key for its exact index exists;
 * therefore a partially populated second row is retained instead of being
 * merged into row 0.
 */
export function decodeRepeatGroupAnswers(
  answers: Ds160FlatAnswers,
  contractOrGroup: Ds160RepeatGroupName | Ds160RepeatGroupContract,
): DecodedDs160RepeatGroup {
  const contract = resolveContract(contractOrGroup);
  const group = contract.group;
  const fieldKeys = new Set(contract.rowFieldKeys);
  const rows = new Map<number, RowBuilder>();
  const recognizedStorageKeys: string[] = [];

  const ensureRow = (index: number): RowBuilder => {
    const existing = rows.get(index);
    if (existing) return existing;
    const created: RowBuilder = {
      values: {},
      sourceKeys: {},
      sourcePriority: {},
    };
    rows.set(index, created);
    return created;
  };

  const consume = (
    fieldKey: string,
    index: number,
    storageKey: string,
    rawValue: unknown,
    priority: number,
  ): void => {
    const row = ensureRow(index);
    const normalized = normalizeAnswerValue(rawValue, group, storageKey);
    recognizedStorageKeys.push(storageKey);
    if (normalized === null) return;

    if ((row.sourcePriority[fieldKey] ?? -1) > priority) return;
    row.values[fieldKey] = normalized;
    row.sourceKeys[fieldKey] = storageKey;
    row.sourcePriority[fieldKey] = priority;
  };

  for (const [storageKey, rawValue] of Object.entries(answers)) {
    if (fieldKeys.has(storageKey)) {
      consume(storageKey, 0, storageKey, rawValue, 2);
      continue;
    }

    const parsed = parseRepeatStorageKey(storageKey);
    if (parsed && fieldKeys.has(parsed.baseFieldKey)) {
      consume(parsed.baseFieldKey, parsed.index, storageKey, rawValue, 2);
      continue;
    }

    // The frontend may persist bilingual companions for text fields. CEAC
    // consumes the official value, so `_en` is a lower-priority fallback;
    // `_zh` still establishes row presence but is never sent to CEAC.
    const languageMatch = storageKey.match(/^(.*)_(en|zh)$/);
    if (!languageMatch) continue;
    const languageBase = languageMatch[1];
    const language = languageMatch[2];
    const languageParsed = parseRepeatStorageKey(languageBase);
    if (languageParsed && fieldKeys.has(languageParsed.baseFieldKey)) {
      if (language === "en") {
        consume(
          languageParsed.baseFieldKey,
          languageParsed.index,
          storageKey,
          rawValue,
          1,
        );
      } else {
        ensureRow(languageParsed.index);
        recognizedStorageKeys.push(storageKey);
      }
    }
  }

  const indexes = [...rows.keys()].sort((a, b) => a - b);
  const highestIndex = indexes.length > 0 ? indexes[indexes.length - 1] : null;
  const missingIndices: number[] = [];
  if (highestIndex !== null) {
    for (let index = 0; index <= highestIndex; index += 1) {
      if (!rows.has(index)) missingIndices.push(index);
    }
  }

  return {
    contract,
    rows: indexes.map((index) => {
      const row = rows.get(index);
      if (!row) {
        throw new Error("Repeat-row builder disappeared while decoding.");
      }
      return {
        group,
        index,
        storageSuffix: index === 0 ? "" : `__${index + 1}`,
        values: { ...row.values },
        sourceKeys: { ...row.sourceKeys },
      } satisfies Ds160RepeatRow;
    }),
    highestIndex,
    missingIndices,
    hasGaps: missingIndices.length > 0,
    recognizedStorageKeys,
  };
}

/** Decode every seed repeat group, preserving empty groups in the result. */
export function decodeAllRepeatGroupAnswers(
  answers: Ds160FlatAnswers,
): Readonly<Record<Ds160RepeatGroupName, DecodedDs160RepeatGroup>> {
  const decoded = {} as Record<Ds160RepeatGroupName, DecodedDs160RepeatGroup>;
  for (const group of DS160_REPEAT_GROUP_NAMES) {
    decoded[group] = decodeRepeatGroupAnswers(answers, group);
  }
  return decoded;
}

/** Encode decoded rows without compacting their indexes. */
export function encodeRepeatGroupRows(
  group: Ds160RepeatGroupName,
  rows: readonly Ds160RepeatRow[],
): Record<string, string> {
  const contract = getDs160RepeatGroupContract(group);
  const fieldKeys = new Set(contract.rowFieldKeys);
  const encoded: Record<string, string> = {};

  for (const row of rows) {
    if (row.group !== group) {
      throw new Ds160RepeatGroupError(
        "unknown_group",
        group,
        `Cannot encode a row from repeat group "${row.group}" as "${group}".`,
      );
    }
    for (const [fieldKey, value] of Object.entries(row.values)) {
      if (!fieldKeys.has(fieldKey)) continue;
      encoded[repeatStorageKey(fieldKey, row.index)] = value;
    }
  }
  return encoded;
}

export interface RepeatSelectorEvidence {
  readonly verified: boolean;
  readonly source: string;
  readonly note: string;
}

export interface RepeatGroupConditionContext {
  readonly contract: Ds160RepeatGroupContract;
  readonly expression: string;
  readonly answers: Ds160FlatAnswers;
  readonly row?: Ds160RepeatRow;
  readonly fieldKey?: string;
}

export interface RepeatPageContext<Page> {
  readonly contract: Ds160RepeatGroupContract;
  readonly page: Page;
}

export interface RepeatRowContext<Page, Row> {
  readonly contract: Ds160RepeatGroupContract;
  readonly page: Page;
  readonly row: Ds160RepeatRow;
  readonly rowHandle: Row | undefined;
  readonly activeFieldKeys: readonly string[];
  readonly fieldAnswers: Readonly<Record<string, string>>;
}

/**
 * Adapter boundary for the existing CEAC page and field mapping code.  The
 * repeat module only coordinates row counts and row indexes; `fillRow` owns
 * actual selectors and delegates to the already-tested field filler.
 */
export interface Ds160RepeatExecutionAdapter<Page, Row = unknown> {
  readonly resolvePage: (
    context: { readonly contract: Ds160RepeatGroupContract; readonly rows: readonly Ds160RepeatRow[] },
  ) => Page | Promise<Page>;
  readonly getRowCount: (context: RepeatPageContext<Page>) => number | Promise<number>;
  readonly addRow?: (context: RepeatPageContext<Page> & { readonly expectedIndex: number }) =>
    void | Promise<void>;
  readonly removeRow?: (context: RepeatPageContext<Page> & { readonly rowIndex: number }) =>
    void | Promise<void>;
  readonly resolveRow?: (
    context: { readonly contract: Ds160RepeatGroupContract; readonly page: Page; readonly row: Ds160RepeatRow },
  ) => Row | Promise<Row>;
  readonly fillRow: (context: RepeatRowContext<Page, Row>) => void | Promise<void>;
  readonly selectorEvidence?: (
    contract: Ds160RepeatGroupContract,
  ) => RepeatSelectorEvidence | Promise<RepeatSelectorEvidence | undefined>;
  readonly isGroupActive?: (
    context: RepeatGroupConditionContext,
  ) => boolean | Promise<boolean>;
  readonly isFieldActive?: (
    context: RepeatGroupConditionContext,
  ) => boolean | Promise<boolean>;
}

export type RepeatGroupExecutionStatus = "filled" | "skipped" | "empty";

export interface RepeatGroupExecutionResult {
  readonly group: Ds160RepeatGroupName;
  readonly page: Ds160RepeatGroupContract["page"];
  readonly status: RepeatGroupExecutionStatus;
  readonly reason?: "condition_inactive" | "no_persisted_rows" | "all_fields_hidden";
  readonly requestedRowCount: number;
  readonly actualRowCount: number | null;
  readonly filledRowIndices: readonly number[];
  readonly skippedRowIndices: readonly number[];
  readonly hasStorageGaps: boolean;
}

export interface Ds160RepeatExecutionResult {
  readonly groups: readonly RepeatGroupExecutionResult[];
}

export interface ExecuteDs160RepeatGroupsOptions<Page, Row = unknown> {
  readonly answers: Ds160FlatAnswers;
  readonly adapter: Ds160RepeatExecutionAdapter<Page, Row>;
  readonly groups?: readonly Ds160RepeatGroupName[];
}

function validateRowCount(
  group: Ds160RepeatGroupName,
  count: number,
): number {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Ds160RepeatGroupError(
      "invalid_row_count",
      group,
      "The CEAC repeat-row mapper returned an invalid row count.",
    );
  }
  return count;
}

async function reconcileRowCount<Page>(
  contract: Ds160RepeatGroupContract,
  page: Page,
  currentCount: number,
  desiredCount: number,
  adapter: Pick<
    Ds160RepeatExecutionAdapter<Page, never>,
    "getRowCount" | "addRow" | "removeRow" | "selectorEvidence"
  >,
): Promise<number> {
  if (currentCount === desiredCount) return currentCount;

  const evidence = adapter.selectorEvidence
    ? await adapter.selectorEvidence(contract)
    : undefined;
  if (!evidence?.verified) {
    throw new Ds160RepeatGroupError(
      "unverified_selector_strategy",
      contract.group,
      `Repeat-row controls for "${contract.group}" are unverified; refusing to add or remove CEAC rows.`,
      {
        strategy: contract.controls.strategy,
        contractEvidence: contract.controls.evidence,
        injectedEvidence: evidence?.note ?? null,
      },
    );
  }

  let count = currentCount;
  while (count < desiredCount) {
    if (!adapter.addRow) {
      throw new Ds160RepeatGroupError(
        "unverified_selector_strategy",
        contract.group,
        `No verified add-row callback is available for "${contract.group}".`,
      );
    }
    await adapter.addRow({ contract, page, expectedIndex: count });
    const nextCount = validateRowCount(
      contract.group,
      await adapter.getRowCount({ contract, page }),
    );
    if (nextCount <= count) {
      throw new Ds160RepeatGroupError(
        "row_count_not_reconciled",
        contract.group,
        `CEAC did not expose a new row after adding row ${count}.`,
        { expectedIndex: count },
      );
    }
    count = nextCount;
  }

  while (count > desiredCount) {
    if (!adapter.removeRow) {
      throw new Ds160RepeatGroupError(
        "unverified_selector_strategy",
        contract.group,
        `No verified remove-row callback is available for "${contract.group}".`,
      );
    }
    const rowIndex = count - 1;
    await adapter.removeRow({ contract, page, rowIndex });
    const nextCount = validateRowCount(
      contract.group,
      await adapter.getRowCount({ contract, page }),
    );
    if (nextCount >= count) {
      throw new Ds160RepeatGroupError(
        "row_count_not_reconciled",
        contract.group,
        `CEAC did not remove row ${rowIndex}.`,
        { rowIndex },
      );
    }
    count = nextCount;
  }

  return count;
}

async function runOneRepeatGroup<Page, Row>(
  answers: Ds160FlatAnswers,
  group: Ds160RepeatGroupName,
  adapter: Ds160RepeatExecutionAdapter<Page, Row>,
): Promise<RepeatGroupExecutionResult> {
  const decoded = decodeRepeatGroupAnswers(answers, group);
  const contract = decoded.contract;

  if (contract.activation) {
    if (!adapter.isGroupActive) {
      if (decoded.rows.length === 0) {
        return {
          group,
          page: contract.page,
          status: "skipped",
          reason: "no_persisted_rows",
          requestedRowCount: 0,
          actualRowCount: null,
          filledRowIndices: [],
          skippedRowIndices: [],
          hasStorageGaps: decoded.hasGaps,
        };
      }
      throw new Ds160RepeatGroupError(
        "unverified_condition_evaluator",
        group,
        `The activation condition for repeat group "${group}" has no verified evaluator.`,
        { expression: contract.activation },
      );
    }

    const active = await adapter.isGroupActive({
      contract,
      expression: contract.activation,
      answers,
    });
    if (!active) {
      return {
        group,
        page: contract.page,
        status: "skipped",
        reason: "condition_inactive",
        requestedRowCount: 0,
        actualRowCount: null,
        filledRowIndices: [],
        skippedRowIndices: decoded.rows.map((row) => row.index),
        hasStorageGaps: decoded.hasGaps,
      };
    }
  }

  if (decoded.rows.length === 0) {
    return {
      group,
      page: contract.page,
      status: "empty",
      reason: "no_persisted_rows",
      requestedRowCount: 0,
      actualRowCount: null,
      filledRowIndices: [],
      skippedRowIndices: [],
      hasStorageGaps: decoded.hasGaps,
    };
  }

  const plans: Array<{
    row: Ds160RepeatRow;
    activeFieldKeys: string[];
    fieldAnswers: Record<string, string>;
  }> = [];
  const skippedRowIndices: number[] = [];

  for (const row of decoded.rows) {
    const activeFieldKeys: string[] = [];
    const fieldAnswers: Record<string, string> = {};

    for (const fieldKey of contract.rowFieldKeys) {
      const expression = contract.fieldShowIf[fieldKey];
      let active = true;
      if (expression) {
        if (!adapter.isFieldActive) {
          if (row.values[fieldKey] === undefined) continue;
          throw new Ds160RepeatGroupError(
            "unverified_condition_evaluator",
            group,
            `The field condition for "${fieldKey}" in repeat group "${group}" has no verified evaluator.`,
            { expression, fieldKey },
          );
        }
        active = await adapter.isFieldActive({
          contract,
          expression,
          answers,
          row,
          fieldKey,
        });
      }
      if (!active) continue;
      activeFieldKeys.push(fieldKey);
      const value = row.values[fieldKey];
      if (value !== undefined) fieldAnswers[fieldKey] = value;
    }

    if (activeFieldKeys.length === 0) {
      skippedRowIndices.push(row.index);
      continue;
    }
    plans.push({ row, activeFieldKeys, fieldAnswers });
  }

  if (plans.length === 0) {
    return {
      group,
      page: contract.page,
      status: "skipped",
      reason: "all_fields_hidden",
      requestedRowCount: 0,
      actualRowCount: null,
      filledRowIndices: [],
      skippedRowIndices,
      hasStorageGaps: decoded.hasGaps,
    };
  }

  const requestedRowCount = Math.max(...plans.map((plan) => plan.row.index)) + 1;
  if (contract.maxItems !== undefined && requestedRowCount > contract.maxItems) {
    throw new Ds160RepeatGroupError(
      "row_count_exceeds_contract",
      group,
      `Persisted rows for "${group}" exceed the seed maximum of ${contract.maxItems}.`,
      { requestedRowCount, maxItems: contract.maxItems },
    );
  }

  const page = await adapter.resolvePage({ contract, rows: plans.map((plan) => plan.row) });
  const currentRowCount = validateRowCount(
    group,
    await adapter.getRowCount({ contract, page }),
  );
  const actualRowCount = await reconcileRowCount(
    contract,
    page,
    currentRowCount,
    requestedRowCount,
    adapter,
  );

  const filledRowIndices: number[] = [];
  for (const plan of plans) {
    const rowHandle = adapter.resolveRow
      ? await adapter.resolveRow({ contract, page, row: plan.row })
      : undefined;
    await adapter.fillRow({
      contract,
      page,
      row: plan.row,
      rowHandle,
      activeFieldKeys: plan.activeFieldKeys,
      fieldAnswers: plan.fieldAnswers,
    });
    filledRowIndices.push(plan.row.index);
  }

  return {
    group,
    page: contract.page,
    status: "filled",
    requestedRowCount,
    actualRowCount,
    filledRowIndices,
    skippedRowIndices,
    hasStorageGaps: decoded.hasGaps,
  };
}

/** Execute the requested repeat groups through injected page/row callbacks. */
export async function executeDs160RepeatGroups<Page, Row = unknown>(
  options: ExecuteDs160RepeatGroupsOptions<Page, Row>,
): Promise<Ds160RepeatExecutionResult> {
  const groups = options.groups ?? DS160_REPEAT_GROUP_NAMES;
  const results: RepeatGroupExecutionResult[] = [];
  for (const group of groups) {
    results.push(await runOneRepeatGroup(options.answers, group, options.adapter));
  }
  return { groups: results };
}

/** Execute a single repeat group while preserving the same adapter contract. */
export async function executeDs160RepeatGroup<Page, Row = unknown>(
  options: ExecuteDs160RepeatGroupsOptions<Page, Row> & {
    readonly group: Ds160RepeatGroupName;
  },
): Promise<RepeatGroupExecutionResult> {
  const result = await executeDs160RepeatGroups({
    answers: options.answers,
    adapter: options.adapter,
    groups: [options.group],
  });
  return result.groups[0];
}

/** Expose the unverified checked-in control plans to audit/report callers. */
export function getRepeatControlStrategy(
  group: Ds160RepeatGroupName,
): RepeatControlLocatorStrategy {
  return getDs160RepeatGroupContract(group).controls;
}
