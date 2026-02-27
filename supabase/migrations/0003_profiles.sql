-- ============================================================
-- 0003_profiles.sql
-- User profiles — auth-linked, one row per auth.users entry.
-- ============================================================

CREATE TABLE public.profiles (
  -- Must match auth.users.id exactly
  id                       UUID         PRIMARY KEY,

  -- Email normalized to lowercase trimmed form
  email                    TEXT         NOT NULL
                                        CHECK (
                                          email = lower(trim(email)) AND
                                          char_length(email) <= 254 AND
                                          email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                                        ),

  -- role is nullable; once set it becomes immutable (enforced in 0005)
  role                     public.user_role  NULL,

  -- Public profile visibility flag
  is_public                BOOLEAN      NOT NULL DEFAULT false,

  -- Optional org association (set only for ORG_ADMIN)
  org_id                   UUID         REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Manual review flags
  requires_manual_review   BOOLEAN      NOT NULL DEFAULT false,
  manual_review_reason     TEXT         CHECK (
                                          manual_review_reason IS NULL OR
                                          char_length(manual_review_reason) <= 1000
                                        ),

  -- Timestamps
  role_set_at              TIMESTAMPTZ  NULL,
  onboarding_completed_at  TIMESTAMPTZ  NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE UNIQUE INDEX profiles_email_idx ON public.profiles (email);

CREATE INDEX profiles_org_id_idx ON public.profiles (org_id)
  WHERE org_id IS NOT NULL;

CREATE INDEX profiles_role_idx ON public.profiles (role)
  WHERE role IS NOT NULL;
