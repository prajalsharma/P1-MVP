-- ============================================================
-- 0017_auto_set_anchor_org_id.sql
-- Auto-set org_id on anchor insert from the user's profile.
-- This ensures ORG_ADMIN anchors are properly scoped to their org.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_anchor_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Only auto-set if org_id is not already provided
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM public.profiles
    WHERE id = NEW.user_id;

    NEW.org_id := v_org_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT to set org_id
DROP TRIGGER IF EXISTS anchors_set_org_id ON public.anchors;
CREATE TRIGGER anchors_set_org_id
  BEFORE INSERT ON public.anchors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_anchor_org_id();

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.set_anchor_org_id() TO authenticated;
