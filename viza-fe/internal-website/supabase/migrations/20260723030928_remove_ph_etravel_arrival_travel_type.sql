-- PH_ETRAVEL_ARRIVAL_CARD is intrinsically an arrival declaration.
-- Remove the redundant fixed ARRIVAL question from the applicant form; the
-- submission runner derives ARRIVAL from the package identity.
delete from public.visa_form_fields
where visa_type = 'PH_ETRAVEL_ARRIVAL_CARD'
  and field_name = 'travel_type';
