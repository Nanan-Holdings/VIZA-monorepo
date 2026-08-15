import {
  compileApplicationSchemaForUi,
  getApplicationFieldUiComponent,
  type ApplicationSchemaUiIssueCode,
  type ApplicationSchemaUiSeverity,
} from "@/lib/application-schema-ui-contract";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type WizardStep,
} from "@/types/visa-form-fields";

export interface EdgeCaseFieldReference {
  fieldName: string;
  label: string;
  fieldType: string;
  component: string;
  stepNumber: number;
  stepName: string;
}

export interface ApplicationSchemaEdgeCase {
  id: string;
  code: ApplicationSchemaUiIssueCode;
  severity: ApplicationSchemaUiSeverity;
  visaType: string;
  component: string | null;
  message: string;
  guidance: string;
  fields: EdgeCaseFieldReference[];
}

export interface EdgeCaseVisaTypeSummary {
  visaType: string;
  fieldCount: number;
  edgeCaseCount: number;
  errors: number;
  warnings: number;
  guidance: number;
}

export interface ApplicationSchemaEdgeCaseCatalog {
  fieldCount: number;
  edgeCaseCount: number;
  affectedVisaTypeCount: number;
  visaTypes: EdgeCaseVisaTypeSummary[];
  edgeCases: ApplicationSchemaEdgeCase[];
}

function buildSteps(rows: VisaFormFieldDbRow[]): WizardStep[] {
  const steps = new Map<number, WizardStep>();

  for (const row of rows) {
    const step = steps.get(row.step_number) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(dbRowToFormField(row));
    steps.set(row.step_number, step);
  }

  return [...steps.values()]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((step) => ({
      ...step,
      fields: [...step.fields].sort((left, right) => left.displayOrder - right.displayOrder),
    }));
}

export function buildApplicationSchemaEdgeCaseCatalog(
  rows: VisaFormFieldDbRow[],
): ApplicationSchemaEdgeCaseCatalog {
  const rowsByVisaType = new Map<string, VisaFormFieldDbRow[]>();
  for (const row of rows) {
    rowsByVisaType.set(row.visa_type, [...(rowsByVisaType.get(row.visa_type) ?? []), row]);
  }

  const compiledByVisaType = [...rowsByVisaType.entries()]
    .map(([visaType, visaRows]) => {
      const compiled = compileApplicationSchemaForUi(buildSteps(visaRows));
      const fieldsByName = new Map(
        compiled.steps.flatMap((step) => step.fields).map((field) => [field.fieldName, field]),
      );
      const designEdgeCases = compiled.report.issues.filter((issue) => issue.designEdgeCase);
      return { visaType, compiled, fieldsByName, designEdgeCases };
    })
    .sort((left, right) => left.visaType.localeCompare(right.visaType));

  const edgeCases = compiledByVisaType.flatMap(({ visaType, fieldsByName, designEdgeCases }) =>
    designEdgeCases.map((issue, issueIndex): ApplicationSchemaEdgeCase => ({
      id: `${visaType}:${issue.code}:${issueIndex}`,
      code: issue.code,
      severity: issue.severity,
      visaType,
      component: issue.component,
      message: issue.message,
      guidance: issue.guidance,
      fields: issue.fieldNames.map((fieldName) => {
        const field = fieldsByName.get(fieldName);
        return {
          fieldName,
          label: field?.label ?? fieldName,
          fieldType: field?.fieldType ?? "unknown",
          component: field ? getApplicationFieldUiComponent(field) : "unknown",
          stepNumber: field?.stepNumber ?? 0,
          stepName: field?.stepName ?? "Unknown step",
        };
      }),
    })),
  );

  const visaTypes = compiledByVisaType.map(({ visaType, compiled, designEdgeCases }) => ({
    visaType,
    fieldCount: compiled.report.fieldCount,
    edgeCaseCount: designEdgeCases.length,
    errors: compiled.report.summary.errors,
    warnings: compiled.report.summary.warnings,
    guidance: compiled.report.summary.guidance,
  }));

  return {
    fieldCount: visaTypes.reduce((sum, report) => sum + report.fieldCount, 0),
    edgeCaseCount: edgeCases.length,
    affectedVisaTypeCount: visaTypes.filter((report) => report.edgeCaseCount > 0).length,
    visaTypes,
    edgeCases,
  };
}
