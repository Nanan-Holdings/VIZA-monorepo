ALTER TABLE public.form_assistant_messages
  DROP CONSTRAINT IF EXISTS form_assistant_messages_input_mode_check;

ALTER TABLE public.form_assistant_messages
  ADD CONSTRAINT form_assistant_messages_input_mode_check
  CHECK (input_mode IN ('text', 'voice', 'system', 'confirmation'));
