-- =============================================================================
-- Guest-checkout flag on `order`
--
-- Marks orders that originated from an *unauthenticated* marketing-funnel
-- checkout (the visitor pays first, then receives a magic-link sign-in
-- email). Used by `provisionAccountAndMagicLink` as the guard that decides
-- whether to mail a login link: guest orders → mail; authenticated
-- `/client` purchases (guest_checkout = false) → never mail a login link.
--
-- Both the WeChat Pay Native rail and the new guest card (Stripe) rail set
-- this true; the authenticated Stripe flow in app/actions/payments.ts leaves
-- it false.
-- =============================================================================

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS guest_checkout BOOLEAN NOT NULL DEFAULT false;
