import {
  type VisaFormFieldOption,
  type VisaFormFieldRow,
  type VisaFormFieldType,
  type WizardStep,
} from "@/types/visa-form-fields";

export const APPLICATION_SCHEMA_UI_COMPONENTS = [
  "application-input",
  "sensitive-input",
  "application-textarea",
  "application-date-picker",
  "application-select",
  "application-searchable-select",
  "application-searchable-multi-select",
  "application-region-select",
  "application-yes-no-control",
  "application-radio-group",
  "application-checkbox",
  "country-dropdown",
  "supporting-document-card",
  "unsupported",
] as const;

export type ApplicationSchemaUiComponent = typeof APPLICATION_SCHEMA_UI_COMPONENTS[number];
export type ApplicationSchemaUiSeverity = "error" | "warning" | "guidance";
export type ApplicationSchemaUiPanelMode = "shared" | "outer_only";

export type ApplicationSchemaUiIssueCode =
  | "unsupported_field_type"
  | "missing_options"
  | "inferred_option_source"
  | "duplicate_option_value"
  | "binary_non_boolean_radio"
  | "sensitive_answer_field"
  | "file_field_requires_document_contract"
  | "unknown_conditional_controller"
  | "forward_conditional_dependency"
  | "cross_step_conditional"
  | "multiple_conditional_roots"
  | "non_option_conditional_controller"
  | "unparseable_conditional_expression"
  | "duplicate_display_order"
  | "repeat_group_missing_repeatable"
  | "repeat_group_mixed_controller"
  | "repeat_group_conflicting_max_items"
  | "inline_group_too_large"
  | "inline_group_mixed_controller";

export interface ApplicationSchemaUiIssue {
  code: ApplicationSchemaUiIssueCode;
  severity: ApplicationSchemaUiSeverity;
  visaType: string;
  fieldNames: string[];
  stepNumbers: number[];
  component: ApplicationSchemaUiComponent | null;
  message: string;
  guidance: string;
  designEdgeCase: boolean;
}

export interface ApplicationSchemaUiReport {
  visaType: string;
  fieldCount: number;
  componentUsage: Record<ApplicationSchemaUiComponent, number>;
  issues: ApplicationSchemaUiIssue[];
  summary: {
    errors: number;
    warnings: number;
    guidance: number;
    designEdgeCases: number;
  };
}

export interface CompiledApplicationSchemaUi {
  steps: WizardStep[];
  report: ApplicationSchemaUiReport;
}

type UiContractValidationRules = Record<string, unknown> & {
  block_group?: string;
  dependent_options?: Record<string, VisaFormFieldOption[]>;
  dependent_options_key?: string;
  depends_on?: string;
  dependsOn?: string;
  document_slot?: string;
  official_options_source?: string;
  official_source?: string;
  option_source_field?: string;
  source?: string;
  inline_group?: string;
  max_items?: number;
  remote_search?: boolean;
  repeat_group?: string;
  repeatable?: boolean;
  sensitive?: boolean;
  ui_component?: ApplicationSchemaUiComponent;
  ui_conditional_panel_controller?: string;
  ui_conditional_panel_mode?: ApplicationSchemaUiPanelMode;
};

const SUPPORTED_FIELD_TYPES = new Set<VisaFormFieldType>([
  "text",
  "password",
  "email",
  "tel",
  "number",
  "select",
  "multi_select",
  "date",
  "file",
  "radio",
  "checkbox",
  "textarea",
  "country",
]);

const OPTION_FIELD_TYPES = new Set<VisaFormFieldType>(["select", "multi_select", "radio"]);
const PANEL_CONTROLLER_TYPES = new Set<VisaFormFieldType>([
  "select",
  "multi_select",
  "radio",
  "checkbox",
  "country",
]);
export const APPLICATION_SEARCHABLE_OPTION_MIN = 12;

function emptyComponentUsage(): Record<ApplicationSchemaUiComponent, number> {
  return Object.fromEntries(
    APPLICATION_SCHEMA_UI_COMPONENTS.map((component) => [component, 0]),
  ) as Record<ApplicationSchemaUiComponent, number>;
}

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function rulesFor(field: VisaFormFieldRow): UiContractValidationRules {
  return (field.validationRules ?? {}) as UiContractValidationRules;
}

function showIfFor(field: VisaFormFieldRow): string | null {
  const showIf = (field.conditionalLogic as { showIf?: unknown } | null)?.showIf;
  return typeof showIf === "string" && showIf.trim() ? showIf.trim() : null;
}

function inferOptionSource(field: VisaFormFieldRow): string | null {
  const declaredSource = rulesFor(field).source;
  if (typeof declaredSource === "string" && declaredSource.trim()) return declaredSource.trim();
  if (field.fieldType !== "select" || (field.options?.length ?? 0) > 0) return null;

  const fieldName = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  if (fieldName === "phone_country_code") return "PHONE_COUNTRY_CODES";
  if (
    /(^|_)(country|nationality)(_|$)/.test(fieldName) ||
    /country of|country\/territory|nationality/.test(label)
  ) return "ISO3166-1";
  if (
    field.visaType === "DS160" &&
    (/(^|_)state(_|$)/.test(fieldName) || /u\.s\. state|us state/.test(label))
  ) return "US_STATES";
  return null;
}

function hasDeclaredOptionSource(field: VisaFormFieldRow): boolean {
  const rules = rulesFor(field);
  return inferOptionSource(field) !== null || rules.remote_search === true || [
    rules.official_source,
    rules.official_options_source,
    rules.dependent_options_key,
    rules.dependent_options,
  ].some((source) => source !== null && (typeof source === "object" || (typeof source === "string" && source.trim().length > 0)));
}

function inferOptionsFromSibling(
  field: VisaFormFieldRow,
  fields: VisaFormFieldRow[],
): { sourceField: VisaFormFieldRow; options: VisaFormFieldOption[] } | null {
  if (!OPTION_FIELD_TYPES.has(field.fieldType) || (field.options?.length ?? 0) > 0) return null;
  const declaredSourceField = rulesFor(field).option_source_field;
  const semanticKey = field.fieldName.split("_").at(-1);
  const candidates = fields.filter((candidate) => {
    if (candidate === field || !candidate.options?.length || candidate.fieldType !== field.fieldType) return false;
    if (declaredSourceField) return candidate.fieldName === declaredSourceField;
    return semanticKey && candidate.fieldName === `current_${semanticKey}`;
  });
  return candidates.length === 1
    ? { sourceField: candidates[0], options: candidates[0].options! }
    : null;
}

export function getConditionalExpressionDependencies(expression: string): string[] {
  const dependencies = new Set<string>();
  for (const match of expression.matchAll(
    /(?:^|\|\||&&)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:===|!==|not\s+in\b|in\b|contains_any\b)/g,
  )) {
    dependencies.add(match[1]);
  }
  return [...dependencies];
}

export function getApplicationFieldUiComponent(
  field: VisaFormFieldRow,
): ApplicationSchemaUiComponent {
  const fieldType = field.fieldType as string;
  if (!SUPPORTED_FIELD_TYPES.has(fieldType as VisaFormFieldType)) return "unsupported";
  const optionSource = inferOptionSource(field);

  switch (field.fieldType) {
    case "password":
      return "sensitive-input";
    case "text":
    case "email":
    case "tel":
    case "number":
      return "application-input";
    case "textarea":
      return "application-textarea";
    case "date":
      return "application-date-picker";
    case "country":
      return "country-dropdown";
    case "checkbox":
      return "application-checkbox";
    case "file":
      return "supporting-document-card";
    case "multi_select":
      return "application-searchable-multi-select";
    case "select":
      if (optionSource === "ISO3166-1" || optionSource === "SCHENGEN_MEMBER_STATES") return "country-dropdown";
      if (optionSource === "US_STATES") return "application-region-select";
      if (optionSource === "PHONE_COUNTRY_CODES") return "application-searchable-select";
      return rulesFor(field).remote_search === true || (field.options?.length ?? 0) >= APPLICATION_SEARCHABLE_OPTION_MIN
        ? "application-searchable-select"
        : "application-select";
    case "radio":
      if (field.options?.length === 2) return "application-yes-no-control";
      return (field.options?.length ?? 0) >= APPLICATION_SEARCHABLE_OPTION_MIN
        ? "application-searchable-select"
        : "application-radio-group";
  }
}

export function getCompiledConditionalPanelController(
  field: VisaFormFieldRow,
): string | null {
  const controller = rulesFor(field).ui_conditional_panel_controller;
  return typeof controller === "string" && controller.trim() ? controller : null;
}

export function getCompiledConditionalPanelMode(
  field: VisaFormFieldRow,
): ApplicationSchemaUiPanelMode | null {
  const mode = rulesFor(field).ui_conditional_panel_mode;
  return mode === "shared" || mode === "outer_only" ? mode : null;
}

function addIssue(
  issues: ApplicationSchemaUiIssue[],
  issue: Omit<ApplicationSchemaUiIssue, "fieldNames" | "stepNumbers"> & {
    fields: VisaFormFieldRow[];
  },
) {
  const { fields, ...issueWithoutFields } = issue;
  issues.push({
    ...issueWithoutFields,
    fieldNames: [...new Set(fields.map((field) => field.fieldName))],
    stepNumbers: [...new Set(fields.map((field) => field.stepNumber))].sort((a, b) => a - b),
  });
}

function terminalConditionalRoots(
  field: VisaFormFieldRow,
  fieldsByName: Map<string, VisaFormFieldRow>,
): { roots: Set<string>; unknown: Set<string> } {
  const roots = new Set<string>();
  const unknown = new Set<string>();
  const visited = new Set<string>();

  const visit = (fieldName: string) => {
    if (visited.has(fieldName)) return;
    visited.add(fieldName);
    const dependency = fieldsByName.get(fieldName);
    if (!dependency) {
      unknown.add(fieldName);
      return;
    }
    const showIf = showIfFor(dependency);
    const dependencies = showIf ? getConditionalExpressionDependencies(showIf) : [];
    if (dependencies.length === 0) {
      roots.add(fieldName);
      return;
    }
    dependencies.forEach(visit);
  };

  const showIf = showIfFor(field);
  if (showIf) getConditionalExpressionDependencies(showIf).forEach(visit);
  return { roots, unknown };
}

function groupByRule(
  fields: VisaFormFieldRow[],
  rule: "block_group" | "inline_group" | "repeat_group",
): Map<string, VisaFormFieldRow[]> {
  const groups = new Map<string, VisaFormFieldRow[]>();
  for (const field of fields) {
    const group = rulesFor(field)[rule];
    if (typeof group !== "string" || !group.trim()) continue;
    const key = `${field.stepNumber}:${group}`;
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }
  return groups;
}

export function compileApplicationSchemaForUi(steps: WizardStep[]): CompiledApplicationSchemaUi {
  const fields = steps.flatMap((step) => step.fields);
  const visaType = fields[0]?.visaType ?? "UNKNOWN";
  const fieldsByName = new Map(fields.map((field) => [field.fieldName, field]));
  const issues: ApplicationSchemaUiIssue[] = [];
  const componentUsage = emptyComponentUsage();

  const compiledFields = new Map<string, VisaFormFieldRow>();
  for (const field of fields) {
    const siblingOptionSource = inferOptionsFromSibling(field, fields);
    const effectiveField = siblingOptionSource
      ? { ...field, options: siblingOptionSource.options }
      : field;
    const component = getApplicationFieldUiComponent(effectiveField);
    const inferredOptionSource = inferOptionSource(effectiveField);
    const declaredOptionSource = rulesFor(effectiveField).source;
    componentUsage[component] += 1;
    const nextRules: UiContractValidationRules = {
      ...rulesFor(effectiveField),
      ...(inferredOptionSource && !declaredOptionSource ? { source: inferredOptionSource } : {}),
      ...(siblingOptionSource ? { option_source_field: siblingOptionSource.sourceField.fieldName } : {}),
      ui_component: component,
    };

    if (inferredOptionSource && !declaredOptionSource) {
      addIssue(issues, {
        code: "inferred_option_source",
        severity: "guidance",
        visaType,
        fields: [field],
        component,
        message: `Option source ${inferredOptionSource} was inferred for "${field.fieldName}".`,
        guidance: `Persist validation_rules.source = "${inferredOptionSource}" in the master schema so the contract is explicit; runtime compilation already applies the safe adapter.`,
        designEdgeCase: false,
      });
    }

    if (siblingOptionSource) {
      addIssue(issues, {
        code: "inferred_option_source",
        severity: "guidance",
        visaType,
        fields: [field, siblingOptionSource.sourceField],
        component,
        message: `Options for "${field.fieldName}" were reused from sibling field "${siblingOptionSource.sourceField.fieldName}".`,
        guidance: `Persist validation_rules.option_source_field = "${siblingOptionSource.sourceField.fieldName}" in the master schema so the shared official option set is explicit.`,
        designEdgeCase: false,
      });
    }

    if (component === "unsupported") {
      addIssue(issues, {
        code: "unsupported_field_type",
        severity: "error",
        visaType,
        fields: [field],
        component,
        message: `Field type "${String(field.fieldType)}" has no canonical /ui-components renderer.`,
        guidance: "Keep the scraped official control in evidence, but do not launch it until a reviewed component or an explicit schema adapter exists.",
        designEdgeCase: true,
      });
    }

    if (
      OPTION_FIELD_TYPES.has(effectiveField.fieldType) &&
      (!effectiveField.options || effectiveField.options.length === 0) &&
      !hasDeclaredOptionSource(effectiveField)
    ) {
      addIssue(issues, {
        code: "missing_options",
        severity: "error",
        visaType,
        fields: [field],
        component,
        message: `${field.fieldType} field "${field.fieldName}" has no options.`,
        guidance: "Scrape the official option values and labels, or mark the field as remote_search with a documented option endpoint.",
        designEdgeCase: false,
      });
    }

    if (effectiveField.options && effectiveField.options.length > 0) {
      const values = effectiveField.options.map(optionValue).map((value) => value.trim().toLowerCase());
      const duplicates = values.filter((value, index) => value && values.indexOf(value) !== index);
      if (duplicates.length > 0) {
        addIssue(issues, {
          code: "duplicate_option_value",
          severity: "error",
          visaType,
          fields: [field],
          component,
          message: `Field "${field.fieldName}" has duplicate option values: ${[...new Set(duplicates)].join(", ")}.`,
          guidance: "Option values are persisted and must be unique even when the visible labels repeat.",
          designEdgeCase: false,
        });
      }
    }

    if (rulesFor(field).sensitive === true || field.fieldType === "password") {
      addIssue(issues, {
        code: "sensitive_answer_field",
        severity: "warning",
        visaType,
        fields: [field],
        component,
        message: `Sensitive field "${field.fieldName}" was excluded from the applicant-facing schema.`,
        guidance: "VIZA owns official-portal accounts and sessions. Never show or persist passwords, OTPs, or authenticator secrets as applicant answers.",
        designEdgeCase: false,
      });
    }

    const documentSlot = rulesFor(field).document_slot;
    if (field.fieldType === "file" && !(typeof documentSlot === "string" && documentSlot.trim())) {
      addIssue(issues, {
        code: "file_field_requires_document_contract",
        severity: "error",
        visaType,
        fields: [field],
        component,
        message: `File field "${field.fieldName}" does not declare validation_rules.document_slot.`,
        guidance: "Declare which application_documents slot owns the upload, then render the SupportingDocumentCard lifecycle instead of persisting a file path as a normal answer.",
        designEdgeCase: true,
      });
    }

    const showIf = showIfFor(field);
    if (showIf) {
      const directDependencies = getConditionalExpressionDependencies(showIf);
      if (directDependencies.length === 0) {
        nextRules.ui_conditional_panel_mode = "outer_only";
        addIssue(issues, {
          code: "unparseable_conditional_expression",
          severity: "error",
          visaType,
          fields: [field],
          component,
          message: `Conditional expression for "${field.fieldName}" is outside the supported equality/list grammar.`,
          guidance: "Use ===, !==, in, not in, or contains_any joined with &&/||. Model calculations as explicit derived fields.",
          designEdgeCase: true,
        });
      } else {
        const { roots, unknown } = terminalConditionalRoots(field, fieldsByName);
        if (unknown.size > 0) {
          nextRules.ui_conditional_panel_mode = "outer_only";
          addIssue(issues, {
            code: "unknown_conditional_controller",
            severity: "error",
            visaType,
            fields: [field],
            component,
            message: `Conditional field "${field.fieldName}" references missing controller(s): ${[...unknown].join(", ")}.`,
            guidance: "Add the controller to the schema or declare a documented derived-value adapter before rendering the branch.",
            designEdgeCase: true,
          });
        } else if (roots.size > 1) {
          nextRules.ui_conditional_panel_mode = "outer_only";
          addIssue(issues, {
            code: "multiple_conditional_roots",
            severity: "warning",
            visaType,
            fields: [field],
            component,
            message: `Conditional field "${field.fieldName}" resolves to multiple controllers: ${[...roots].join(", ")}.`,
            guidance: "Use the approved compound conditional group documented in /ui-components when runtime placement is enabled; outer-only remains the safe renderer fallback.",
            designEdgeCase: false,
          });
        } else if (roots.size === 1) {
          const controllerName = [...roots][0];
          const controller = fieldsByName.get(controllerName)!;
          if (controller.stepNumber > field.stepNumber) {
            nextRules.ui_conditional_panel_mode = "outer_only";
            addIssue(issues, {
              code: "forward_conditional_dependency",
              severity: "error",
              visaType,
              fields: [controller, field],
              component,
              message: `Field "${field.fieldName}" depends on later-step controller "${controllerName}".`,
              guidance: "Move the controller earlier or move the dependent branch after it; forward dependencies cannot be completed deterministically.",
              designEdgeCase: false,
            });
          } else if (controller.stepNumber !== field.stepNumber) {
            nextRules.ui_conditional_panel_mode = "outer_only";
            addIssue(issues, {
              code: "cross_step_conditional",
              severity: "guidance",
              visaType,
              fields: [controller, field],
              component,
              message: `Field "${field.fieldName}" is controlled from step ${controller.stepNumber}, not its own step ${field.stepNumber}.`,
              guidance: "The dependent field uses the outer step card. Section-level branches may also drive step and sidebar visibility from the earlier answer.",
              designEdgeCase: false,
            });
          } else if (!PANEL_CONTROLLER_TYPES.has(controller.fieldType)) {
            nextRules.ui_conditional_panel_mode = "outer_only";
            addIssue(issues, {
              code: "non_option_conditional_controller",
              severity: "warning",
              visaType,
              fields: [controller, field],
              component,
              message: `Controller "${controllerName}" uses ${controller.fieldType}, which has no canonical conditional-panel ownership pattern.`,
              guidance: "Add an explicit derived toggle or obtain design approval for a text/date/calculated controller pattern.",
              designEdgeCase: true,
            });
          } else {
            nextRules.ui_conditional_panel_controller = controllerName;
            nextRules.ui_conditional_panel_mode = "shared";
          }
        }
      }
    }

    compiledFields.set(field.fieldName, {
      ...effectiveField,
      validationRules: nextRules,
    });
  }

  for (const step of steps) {
    const orders = new Map<number, VisaFormFieldRow[]>();
    for (const field of step.fields) {
      orders.set(field.displayOrder, [...(orders.get(field.displayOrder) ?? []), field]);
    }
    for (const [displayOrder, duplicates] of orders) {
      if (duplicates.length < 2) continue;
      addIssue(issues, {
        code: "duplicate_display_order",
        severity: "warning",
        visaType,
        fields: duplicates,
        component: null,
        message: `Step ${step.stepNumber} uses display_order ${displayOrder} for multiple fields.`,
        guidance: "Assign unique display_order values so scraped official order is deterministic.",
        designEdgeCase: false,
      });
    }
  }

  const conditionalRoot = (field: VisaFormFieldRow) =>
    getCompiledConditionalPanelController(compiledFields.get(field.fieldName) ?? field) ?? "";

  for (const groupFields of groupByRule(fields, "repeat_group").values()) {
    if (groupFields.some((field) => rulesFor(field).repeatable !== true)) {
      addIssue(issues, {
        code: "repeat_group_missing_repeatable",
        severity: "warning",
        visaType,
        fields: groupFields,
        component: null,
        message: "A repeat_group contains fields without repeatable: true.",
        guidance: "Set repeatable: true on every field in the group so persistence and add/remove behavior agree.",
        designEdgeCase: false,
      });
    }
    const roots = new Set(groupFields.map(conditionalRoot).filter(Boolean));
    if (roots.size > 1) {
      addIssue(issues, {
        code: "repeat_group_mixed_controller",
        severity: "warning",
        visaType,
        fields: groupFields,
        component: null,
        message: `A repeat_group mixes conditional controllers: ${[...roots].join(", ")}.`,
        guidance: "Split the repeat group or define a reviewed nested-branch repeat component.",
        designEdgeCase: true,
      });
    }
    const maxItems = new Set(
      groupFields.map((field) => rulesFor(field).max_items).filter((value): value is number => typeof value === "number"),
    );
    if (maxItems.size > 1) {
      addIssue(issues, {
        code: "repeat_group_conflicting_max_items",
        severity: "error",
        visaType,
        fields: groupFields,
        component: null,
        message: `A repeat_group declares conflicting max_items values: ${[...maxItems].join(", ")}.`,
        guidance: "Declare max_items once on the first group field or use the same value everywhere.",
        designEdgeCase: false,
      });
    }
  }

  for (const groupFields of groupByRule(fields, "inline_group").values()) {
    if (groupFields.length > 2) {
      addIssue(issues, {
        code: "inline_group_too_large",
        severity: "guidance",
        visaType,
        fields: groupFields,
        component: null,
        message: `An inline_group contains ${groupFields.length} fields and uses the canonical equal-width row.`,
        guidance: "All fields stay on the same row; long labels wrap within their own column while controls remain aligned.",
        designEdgeCase: false,
      });
    }
    const roots = new Set(groupFields.map(conditionalRoot).filter(Boolean));
    if (roots.size > 1) {
      addIssue(issues, {
        code: "inline_group_mixed_controller",
        severity: "warning",
        visaType,
        fields: groupFields,
        component: null,
        message: `An inline_group mixes conditional controllers: ${[...roots].join(", ")}.`,
        guidance: "Keep inline fields in the same active branch or render them as separate rows.",
        designEdgeCase: true,
      });
    }
  }

  const compiledSteps = steps
    .map((step) => ({
      ...step,
      fields: step.fields
        .filter((field) => rulesFor(field).sensitive !== true && field.fieldType !== "password")
        .map((field) => compiledFields.get(field.fieldName) ?? field),
    }))
    .filter((step) => step.fields.length > 0);

  return {
    steps: compiledSteps,
    report: {
      visaType,
      fieldCount: fields.length,
      componentUsage,
      issues,
      summary: {
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
        guidance: issues.filter((issue) => issue.severity === "guidance").length,
        designEdgeCases: issues.filter((issue) => issue.designEdgeCase).length,
      },
    },
  };
}
