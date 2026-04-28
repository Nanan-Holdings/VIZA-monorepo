-- Add Korea C-3-9 Short-Term General Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-kr-c39-short-term-visit-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'south_korea',
    'KR_C39_SHORT_TERM_VISIT',
    'Korea C-3-9 Short-Term General Visa',
    'Korea Short-Term General visit visa (C-3-9, ≤90 days, multi-purpose, single-entry), schema modeled on Annex 17 (별지 제17호서식) "사증발급신청서 / VISA APPLICATION FORM" rev 2022.2.7. Intended for mainland-China (PRC) residents who submit the completed form through the local Korea Visa Application Center (KVAC.com.cn-operated), since visa.go.kr self-service is not directly accessible to PRC residents. Other Tourism-eligible nationalities may also use the schema; their submission channel (visa.go.kr or embassy direct) is documented in the gap report.'
  )
ON CONFLICT DO NOTHING;
