-- ============================================================
-- 0006_audit_events.sql
-- Append-only audit log. UPDATE and DELETE are blocked at DB level.
-- ============================================================

CREATE TABLE public.audit_events (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Actor (nullable for system-generated events)
  actor_user_id  UUID          REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_role     public.user_role  NULL,

  -- Event identity
  action         TEXT          NOT NULL CHECK (char_length(action) BETWEEN 1 AND 128),
  target_table   TEXT          NOT NULL CHECK (char_length(target_table) BETWEEN 1 AND 64),
  target_id      UUID          NULL,

  -- Org scoping
  org_id         UUID          REFERENCES public.organizations(id) ON DELETE RESTRICT
);

-- Block UPDATE on audit_events
CREATE OR REPLACE FUNCTION public.deny_audit_update()
RETURNS TRIGGER AS
'
BEGIN
  RAISE EXCEPTION ''audit_events rows are immutable — UPDATE is not permitted''
    USING ERRCODE = ''42501'';
  RETURN NULL;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_audit_update();

-- Block DELETE on audit_events
CREATE OR REPLACE FUNCTION public.deny_audit_delete()
RETURNS TRIGGER AS
'
BEGIN
  RAISE EXCEPTION ''audit_events rows are immutable — DELETE is not permitted''
    USING ERRCODE = ''42501'';
  RETURN NULL;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_audit_delete();

-- Indexes
CREATE INDEX audit_events_occurred_at_idx    ON public.audit_events (occurred_at);
CREATE INDEX audit_events_actor_user_id_idx  ON public.audit_events (actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_events_target_table_idx   ON public.audit_events (target_table);
CREATE INDEX audit_events_target_id_idx      ON public.audit_events (target_id) WHERE target_id IS NOT NULL;
CREATE INDEX audit_events_org_id_idx         ON public.audit_events (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX audit_events_action_idx         ON public.audit_events (action);
