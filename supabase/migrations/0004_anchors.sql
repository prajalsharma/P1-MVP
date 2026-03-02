-- ============================================================
-- 0004_anchors.sql
-- Anchors table — fingerprint-only evidence records.
-- NO raw file content is stored. Only the SHA-256 hash.
-- ============================================================

CREATE TABLE public.anchors (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owning user (required)
  user_id           UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Optional org association
  org_id            UUID          REFERENCES public.organizations(id) ON DELETE RESTRICT,

  -- SHA-256 hex fingerprint — 64 lowercase hex chars, no raw content
  file_fingerprint  TEXT          NOT NULL
                                  CHECK (file_fingerprint ~ '^[0-9a-f]{64}$'),

  -- Metadata only — no content or PII
  file_name         TEXT          NOT NULL
                                  CHECK (
                                    char_length(file_name) BETWEEN 1 AND 255 AND
                                    -- Reject anything that looks like an email (simple guard)
                                    file_name !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
                                  ),
  file_size_bytes   BIGINT        NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5368709120),
  file_mime         TEXT          NOT NULL
                                  CHECK (file_mime ~ '^[a-zA-Z0-9][a-zA-Z0-9!#$&^_-]{0,62}/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,62}'),

  -- Lifecycle
  status            public.anchor_status  NOT NULL DEFAULT 'PENDING',

  -- Retention
  retention_policy  TEXT          NOT NULL DEFAULT 'STANDARD'
                                  CHECK (char_length(retention_policy) <= 64),
  retain_until      TIMESTAMPTZ   NULL,

  -- Legal hold: when true, row CANNOT be hard-deleted (enforced by trigger below)
  legal_hold        BOOLEAN       NOT NULL DEFAULT false,

  -- Soft-delete marker
  deleted_at        TIMESTAMPTZ   NULL,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Prevent hard deletion of anchors under legal hold
CREATE OR REPLACE FUNCTION public.prevent_legal_hold_delete()
RETURNS TRIGGER AS
'
BEGIN
  IF OLD.legal_hold = true THEN
    RAISE EXCEPTION ''Cannot delete anchor % — legal hold is active'', OLD.id
      USING ERRCODE = ''23514'';
  END IF;
  RETURN OLD;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER anchors_no_delete_on_legal_hold
  BEFORE DELETE ON public.anchors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_legal_hold_delete();

-- Indexes
CREATE INDEX anchors_user_id_idx         ON public.anchors (user_id);
CREATE INDEX anchors_org_id_idx          ON public.anchors (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX anchors_file_fingerprint_idx ON public.anchors (file_fingerprint);
CREATE INDEX anchors_status_idx          ON public.anchors (status);
CREATE INDEX anchors_legal_hold_idx      ON public.anchors (legal_hold) WHERE legal_hold = true;
CREATE INDEX anchors_created_at_idx      ON public.anchors (created_at);
