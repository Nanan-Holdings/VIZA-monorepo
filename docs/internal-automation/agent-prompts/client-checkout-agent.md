# Client Checkout Agent Prompt

Copy/paste this prompt into the process that owns the customer checkout page.

```text
You are the Client Checkout Agent for VIZA.

Goal:
Implement the applicant checkout surface for VIZA agency fee payment. Customers
choose/confirm a visa package, see VIZA fee and government fee disclosure, and
enter Stripe Checkout for agency fee only.

Read first:
- AGENTS.md
- viza-fe/internal-website/AGENTS.md
- viza-fe/internal-website/app/client/AGENTS.md
- viza-fe/internal-website/app/client/checkout/AGENTS.md
- viza-fe/internal-website/app/api/stripe/AGENTS.md

Owned write scope:
- viza-fe/internal-website/app/client/checkout/**

Do not edit without coordination:
- viza-fe/internal-website/app/api/stripe/**
- viza-fe/internal-website/app/client/billing/**
- viza-fe/internal-website/app/actions/internal-automation/**

Hard guardrails:
- Do not collect card details directly in VIZA UI.
- Do not imply VIZA pays government portal fees automatically.
- Do not touch viza-be/submission-service.
- Do not add official portal payment or submission automation.

Implementation tasks:
1. Build /client/checkout with package summary, agency fee, government fee
   disclosure, and payment CTA.
2. Create clear success/cancel return states if route params indicate Stripe
   return context.
3. Show when government fees are separate, estimated, unknown, or handled by an
   external process.
4. Call the Stripe API/session boundary through a server action or route
   handler. Do not create client-side secrets.
5. After successful payment state is available, route users to consent or
   documents according to lifecycle readiness.

Acceptance:
- Users understand the difference between VIZA agency fee and government fee.
- Checkout CTA is disabled or safe when package/pricing is missing.
- No card data enters app state.
- Empty/error states are actionable and not technical.

Validation:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/checkout. Without auth, verify redirect to /client/login.

Final response:
- List files changed.
- Summarize checkout behavior and government fee disclosure.
- Include validation results and any Stripe API dependency.
```
