# Taiwan Overseas-China Entry Permit Runner

Scope: `TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT` only, for Chinese mainland passport holders resident in Singapore applying for tourism.

- Keep this permit separate from arrival cards and generic Taiwan visitor-visa fallbacks.
- Use only the Taiwan NIA overseas-China portal and the VIZA-managed inbox alias for official email verification.
- The official post-verification form is session-gated. Until its selectors are captured with an authorized controlled test, return `official_form_recon`; do not infer fields or report submission.
- Do not store full payment card data, OTPs, CAPTCHA answers, portal cookies, or unredacted documents in logs or the repository.
