-- Application Translations
-- Stores Chinese→English translations of user-submitted application fields
-- Used for official visa processing downstream

CREATE TABLE IF NOT EXISTS application_translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_key       TEXT NOT NULL,
  source_text     TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang     TEXT NOT NULL DEFAULT 'zh',
  target_lang     TEXT NOT NULL DEFAULT 'en',
  translated_by   TEXT NOT NULL DEFAULT 'google',
  user_edited     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (application_id, field_key, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_app_translations_app_id
  ON application_translations (application_id);
