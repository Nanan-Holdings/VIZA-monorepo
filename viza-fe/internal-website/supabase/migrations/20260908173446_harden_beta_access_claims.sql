-- One participant belongs to exactly one experiment cell in a campaign. This
-- prevents a social tester from redeeming multiple 50%-off codes and prevents
-- cross-contamination between the promo/link and social/friends cohorts.
CREATE UNIQUE INDEX beta_access_grants_one_participant_per_campaign_idx
  ON public.beta_access_grants(campaign, applicant_id);
