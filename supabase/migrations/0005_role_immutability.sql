-- ============================================================
-- 0005_role_immutability.sql
-- Enforces that profile.role can only transition NULL → value.
-- Once set, further updates to role are blocked at DB level.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_role_immutability()
RETURNS TRIGGER AS
'
BEGIN
  -- Allow only NULL → non-NULL transition
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION
      ''Role immutability violation: role is already set to "%" and cannot be changed'',
      OLD.role
      USING ERRCODE = ''23514'',
            DETAIL  = ''Profile id: '' || OLD.id::text,
            HINT    = ''Role can only be set once (NULL → value). Contact support for corrections.'';
  END IF;

  -- Record when role was first assigned
  IF OLD.role IS NULL AND NEW.role IS NOT NULL THEN
    NEW.role_set_at = now();
  END IF;

  RETURN NEW;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER profiles_role_immutability
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_immutability();
