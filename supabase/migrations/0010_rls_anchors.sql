-- ============================================================
-- 0010_rls_anchors.sql
-- RLS policies for the anchors table.
-- Tenant isolation: users see only their own anchors.
-- Org admins see all anchors belonging to their org.
-- ============================================================

-- Individual users can see their own anchors
CREATE POLICY anchors_select_own
  ON public.anchors
  FOR SELECT
  USING (user_id = auth.uid());

-- Org admins can see all anchors in their org
CREATE POLICY anchors_select_org_admin
  ON public.anchors
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

-- Users can insert anchors for themselves only
CREATE POLICY anchors_insert_own
  ON public.anchors
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own anchors (status transitions, retain_until, legal_hold)
CREATE POLICY anchors_update_own
  ON public.anchors
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Org admins can update anchors in their org (e.g. set legal_hold)
CREATE POLICY anchors_update_org_admin
  ON public.anchors
  FOR UPDATE
  USING (
    org_id IS NOT NULL AND
    org_id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'ORG_ADMIN'
        AND org_id IS NOT NULL
    )
  );

-- No direct DELETE via RLS — soft delete via deleted_at only
-- Hard delete of legal_hold=true is also blocked by trigger in 0004
