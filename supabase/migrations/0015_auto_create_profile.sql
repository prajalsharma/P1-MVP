-- ============================================================
-- 0015_auto_create_profile.sql
-- Auto-create a profile row when a new user signs up
--
-- This trigger fires AFTER INSERT on auth.users and creates
-- a corresponding row in public.profiles with:
--   - id = auth user id
--   - email = auth user email (normalized)
--   - role = NULL (set during onboarding)
-- ============================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (
    NEW.id,
    LOWER(TRIM(COALESCE(NEW.email, '')))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant execute to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
