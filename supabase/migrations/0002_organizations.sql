-- ============================================================
-- 0002_organizations.sql
-- Organizations table.
-- ============================================================

CREATE TABLE public.organizations (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name          TEXT         NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 255),
  display_name        TEXT         NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 255),
  domain              TEXT         CHECK (
                                     domain IS NULL OR (
                                       char_length(domain) <= 253 AND
                                       domain ~ '^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
                                     )
                                   ),
  verification_status TEXT         NOT NULL DEFAULT 'UNVERIFIED'
                                   CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS
'
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE UNIQUE INDEX organizations_domain_idx ON public.organizations (domain)
  WHERE domain IS NOT NULL;

CREATE INDEX organizations_verification_status_idx ON public.organizations (verification_status);

CREATE INDEX organizations_created_at_idx ON public.organizations (created_at);
