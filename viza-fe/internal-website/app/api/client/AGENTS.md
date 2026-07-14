# Client Auth API

Routes here proxy applicant authentication requests to Supabase from the same
origin so local browser CORS settings never block login or email-code flows.
Do not log credentials, verification codes, or raw Supabase tokens.
