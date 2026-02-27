-- ============================================================
-- 0011_rls_audit.sql
-- RLS policies for the audit_events table.
-- Append-only: users may insert but never update or delete.
-- Anonymous users cannot enumerate audit logs.
-- ============================================================

-- Authenticated users can insert audit events for themselves
CREATE POLICY audit_events_insert_own
  ON public.audit_events
  FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid() OR
    actor_user_id IS NULL  -- system-generated events
  );

-- Individual users can read their own audit events
CREATE POLICY audit_events_select_own
  ON public.audit_events
  FOR SELECT
  USING (actor_user_id = auth.uid());

-- Org admins can read all audit events scoped to their org
CREATE POLICY audit_events_select_org_admin
  ON public.audit_events
  FOR SELECT
  USING (
    org_id IS NOT NULL AND
    org_id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'ORG_ADMIN'
        AND org_id IS NOT NULL
    )
  );

-- UPDATE and DELETE are blocked by triggers (0006) and by having no permissive policies.
-- RLS provides a second layer: no UPDATE/DELETE policy = denied for all JWT callers.
