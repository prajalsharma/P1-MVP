-- ============================================================
-- 0009_rls_organizations.sql
-- RLS policies for the organizations table.
-- ============================================================

-- Org members (profiles with org_id = organization.id) can read their org
CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid() AND org_id IS NOT NULL
    )
  );

-- Org admins can update their own org record
CREATE POLICY organizations_update_admin
  ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'ORG_ADMIN'
        AND org_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'ORG_ADMIN'
        AND org_id IS NOT NULL
    )
  );

-- No anonymous enumeration — anonymous users get nothing
-- No INSERT via RLS (service role only for org creation)
