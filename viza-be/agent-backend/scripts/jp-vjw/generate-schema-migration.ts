import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bilingualJpVjwRows } from "./form-fields";

export function buildJpVjwSchemaMigration(): string {
  const rows = JSON.stringify(bilingualJpVjwRows());
  return `-- Align the DB-driven Japan Visit Japan Web form with the controls observed
-- in the reviewed VJW 3.16 official bundle. This is a data-only schema publish:
-- it does not enqueue or submit an application.

WITH canonical AS (
  SELECT *
  FROM jsonb_to_recordset($jp_vjw_fields$${rows}$jp_vjw_fields$::jsonb) AS row(
    visa_type text,
    field_name text,
    label text,
    field_type text,
    required boolean,
    step_number integer,
    step_name text,
    display_order integer,
    placeholder text,
    validation_rules jsonb,
    options jsonb,
    conditional_logic jsonb
  )
)
INSERT INTO public.visa_form_fields (
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic,
  updated_at
)
SELECT
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic,
  now()
FROM canonical
ON CONFLICT (visa_type, field_name) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  required = EXCLUDED.required,
  step_number = EXCLUDED.step_number,
  step_name = EXCLUDED.step_name,
  display_order = EXCLUDED.display_order,
  placeholder = EXCLUDED.placeholder,
  validation_rules = EXCLUDED.validation_rules,
  options = EXCLUDED.options,
  conditional_logic = EXCLUDED.conditional_logic,
  updated_at = now();

-- Preserve saved answers while canonicalizing values that previously stored
-- English labels instead of the exact official option codes.
UPDATE public.visa_application_answers AS answer
SET value_text = 'CHN', updated_at = now()
FROM public.applications AS application
WHERE application.id = answer.application_id
  AND upper(trim(application.visa_type)) = 'JP_VISIT_JAPAN_WEB'
  AND answer.field_name = 'nationality'
  AND upper(trim(COALESCE(answer.value_text, ''))) IN ('CHN', 'CHINA', '中国', '中华人民共和国');

UPDATE public.visa_application_answers AS answer
SET value_text = '0', updated_at = now()
FROM public.applications AS application
WHERE application.id = answer.application_id
  AND upper(trim(application.visa_type)) = 'JP_VISIT_JAPAN_WEB'
  AND answer.field_name = 'purpose_of_visit'
  AND upper(trim(COALESCE(answer.value_text, ''))) IN ('0', 'TOURISM', '旅游', '観光');

WITH prefecture_options AS (
  SELECT option ->> 'value' AS official_value, option ->> 'official_label' AS official_label
  FROM public.visa_form_fields AS field,
       LATERAL jsonb_array_elements(COALESCE(field.options, '[]'::jsonb)) AS option
  WHERE field.visa_type = 'JP_VISIT_JAPAN_WEB'
    AND field.field_name = 'accommodation_prefecture'
)
UPDATE public.visa_application_answers AS answer
SET value_text = prefecture.official_value, updated_at = now()
FROM public.applications AS application, prefecture_options AS prefecture
WHERE application.id = answer.application_id
  AND upper(trim(application.visa_type)) = 'JP_VISIT_JAPAN_WEB'
  AND answer.field_name = 'accommodation_prefecture'
  AND (
    upper(trim(COALESCE(answer.value_text, ''))) = upper(prefecture.official_value)
    OR regexp_replace(upper(trim(COALESCE(answer.value_text, ''))), ' (TO|FU|KEN|DO)$', '')
       = regexp_replace(upper(prefecture.official_label), ' (TO|FU|KEN|DO)$', '')
  );
`;
}

async function main(): Promise<void> {
  const outputs = process.argv.slice(2);
  if (outputs.length === 0) throw new Error("Provide at least one migration output path.");
  const sql = buildJpVjwSchemaMigration();
  await Promise.all(outputs.map((output) => writeFile(resolve(output), sql, "utf8")));
  console.log(`Wrote ${outputs.length} byte-identical Japan VJW schema migration file(s).`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown Japan VJW migration generation failure");
    process.exitCode = 1;
  });
}
