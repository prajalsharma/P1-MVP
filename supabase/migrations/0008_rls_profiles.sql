-- ============================================================
-- 0008_rls_profiles.sql
-- RLS policies for the profiles table.
-- ============================================================

-- Users can read their own profile only
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can insert their own profile row only
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update only non-privileged fields on their own row
-- (role field immutability is enforced by trigger 0005)
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No delete allowed via RLS (soft-delete pattern only)
-- (No DELETE policy = DELETE is blocked for all non-service-role callers)
