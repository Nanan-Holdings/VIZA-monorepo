-- =============================================================================
-- WeChat Pay (Native v3) fields on `order`
--
-- Adds columns to track a WeChat Pay Native transaction alongside the
-- existing Stripe fields. WeChat Pay is the Mainland-China-merchant
-- direct integration (not the Stripe `wechat_pay` PaymentMethod).
--
-- - wechat_out_trade_no: merchant-side unique id (we send this to WeChat
--   when calling /v3/pay/transactions/native; WeChat echoes it back on
--   the notify callback). Acts as the idempotency key for replays.
-- - wechat_prepay_id: returned by WeChat for the QR session.
-- - wechat_transaction_id: WeChat's own settlement id, populated when
--   the notify callback fires with trade_state=SUCCESS.
-- - wechat_payer_openid: the buyer's openid under our app_id.
--
-- All columns are NULL for orders paid via Stripe — both payment paths
-- coexist on the same `order` row.
-- =============================================================================

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS wechat_out_trade_no   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS wechat_prepay_id      TEXT,
  ADD COLUMN IF NOT EXISTS wechat_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS wechat_payer_openid   TEXT;

CREATE INDEX IF NOT EXISTS idx_order_wechat_out_trade_no
  ON "order"(wechat_out_trade_no)
  WHERE wechat_out_trade_no IS NOT NULL;
