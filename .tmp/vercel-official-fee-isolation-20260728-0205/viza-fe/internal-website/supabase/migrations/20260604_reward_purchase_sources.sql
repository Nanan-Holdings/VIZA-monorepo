ALTER TABLE public.reward_transactions
  DROP CONSTRAINT IF EXISTS reward_transactions_source_check;

ALTER TABLE public.reward_transactions
  ADD CONSTRAINT reward_transactions_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'checkin',
        'milestone',
        'goal_achieved',
        'treatment_completion',
        'referral',
        'campaign',
        'admin_adjustment',
        'purchase',
        'redemption'
      ]::text[]
    )
  );
