-- Referral System Migration
-- Adds referral_code to patients and creates the referrals tracking table

-- 1. Add referral_code column to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Index for fast lookups by referral code (partial, only non-null)
CREATE INDEX IF NOT EXISTS idx_patients_referral_code
  ON public.patients(referral_code)
  WHERE referral_code IS NOT NULL;

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_patient_id UUID NOT NULL REFERENCES public.patients(id),
  referred_email TEXT NOT NULL,
  referred_patient_id UUID REFERENCES public.patients(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed_up', 'completed', 'rewarded')),
  reward_amount INTEGER NOT NULL DEFAULT 9999,
  invite_method TEXT NOT NULL DEFAULT 'email'
    CHECK (invite_method IN ('email', 'link')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  referrer_transaction_id UUID REFERENCES public.reward_transactions(id),
  referred_transaction_id UUID REFERENCES public.reward_transactions(id),
  UNIQUE(referrer_patient_id, referred_email)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_patient_id
  ON public.referrals(referrer_patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email
  ON public.referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_patient_id
  ON public.referrals(referred_patient_id)
  WHERE referred_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_status
  ON public.referrals(status);

-- 3. RLS Policies
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view referrals (admin client bypasses RLS anyway)
CREATE POLICY "Authenticated users can view referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert referrals
CREATE POLICY "Authenticated users can insert referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role has full access (used by server actions via admin client)
CREATE POLICY "Service role has full access to referrals"
  ON public.referrals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
