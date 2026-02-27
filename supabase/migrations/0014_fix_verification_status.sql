-- ============================================================
-- 0014_fix_verification_status.sql
-- Adds PENDING_REVIEW to the organizations.verification_status
-- CHECK constraint, which is required by complete_onboarding().
-- ============================================================

-- Drop the old constraint and replace with one that includes PENDING_REVIEW.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_verification_status_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_verification_status_check
  CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'));
