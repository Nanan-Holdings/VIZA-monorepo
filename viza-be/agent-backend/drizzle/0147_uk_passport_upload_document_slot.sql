-- Keep the UK passport upload in the document lifecycle rather than the
-- ordinary string-valued application answer contract.
update public.visa_form_fields
set validation_rules = coalesce(validation_rules, '{}'::jsonb)
  || jsonb_build_object('document_slot', 'passport_bio_page')
where visa_type = 'UK_STANDARD_VISITOR'
  and field_name = 'passport_upload'
  and coalesce(validation_rules ->> 'document_slot', '') <> 'passport_bio_page';
