-- Repair the France-Visas industry option on the field name used by the live
-- Schengen schema. Stored option values and official English text are unchanged.

WITH rewritten AS (
  SELECT
    field.id,
    jsonb_agg(
      CASE
        WHEN option_item ->> 'value' = 'Q'
          THEN option_item || jsonb_build_object('label_zh', '医疗卫生和社会工作')
        ELSE option_item
      END
      ORDER BY option_order
    ) AS options
  FROM public.visa_form_fields AS field
  CROSS JOIN LATERAL jsonb_array_elements(field.options) WITH ORDINALITY
    AS option_rows(option_item, option_order)
  WHERE field.visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
    AND field.field_name = 'fv_business_segment'
  GROUP BY field.id
  HAVING bool_or(option_item ->> 'value' = 'Q')
)
UPDATE public.visa_form_fields AS field
SET options = rewritten.options,
    updated_at = now()
FROM rewritten
WHERE field.id = rewritten.id;
