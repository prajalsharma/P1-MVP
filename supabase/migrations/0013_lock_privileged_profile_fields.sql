-- ============================================================
-- 0013_lock_privileged_profile_fields.sql
-- P2-S4: Prevent direct mutation of role, org_id, requires_manual_review
-- via RLS CHECK. The only allowed writer is SECURITY DEFINER functions.
-- ============================================================

-- Drop the generic update policy created in P1
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Replace with a policy that blocks privileged fields at column level.
-- Users may update ONLY is_public and onboarding_completed_at.
-- The CHECK condition ensures the privileged fields are unchanged.
-- SECURITY DEFINER functions bypass RLS entirely, so the RPC still works.

CREATE POLICY profiles_update_non_privileged
  ON public.profiles
  FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Privileged fields must not change via direct client UPDATE
    AND role                   IS NOT DISTINCT FROM (SELECT p.role                   FROM public.profiles p WHERE p.id = auth.uid())
    AND org_id                 IS NOT DISTINCT FROM (SELECT p.org_id                 FROM public.profiles p WHERE p.id = auth.uid())
    AND requires_manual_review IS NOT DISTINCT FROM (SELECT p.requires_manual_review FROM public.profiles p WHERE p.id = auth.uid())
    AND manual_review_reason   IS NOT DISTINCT FROM (SELECT p.manual_review_reason   FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Helper trigger function to block direct writes to privileged columns
-- (belt-and-suspenders on top of RLS, applied before RLS for service-role callers too)
CREATE OR REPLACE FUNCTION public.block_privileged_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
BEGIN
  -- Detect attempts to change privileged fields directly (non-RPC path)
  -- SECURITY DEFINER functions set local variable to bypass this check
  IF current_setting(''arkova.bypass_privileged_check'', true) = ''1'' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION ''Direct update of profiles.role is not permitted. Use complete_onboarding().''
      USING ERRCODE = ''42501'';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION ''Direct update of profiles.org_id is not permitted. Use complete_onboarding().''
      USING ERRCODE = ''42501'';
  END IF;

  IF NEW.requires_manual_review IS DISTINCT FROM OLD.requires_manual_review THEN
    RAISE EXCEPTION ''Direct update of profiles.requires_manual_review is not permitted.''
      USING ERRCODE = ''42501'';
  END IF;

  RETURN NEW;
END;
';

CREATE TRIGGER profiles_block_privileged_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_privileged_profile_update();

-- Patch complete_onboarding to set bypass flag before privileged UPDATE
-- Re-declare with bypass flag set/unset around the privileged UPDATE
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_role            text,
  p_org_legal_name  text  DEFAULT NULL,
  p_org_display_name text DEFAULT NULL,
  p_org_domain      text  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS '
DECLARE
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_org_id       uuid;
  v_user_role    public.user_role;
  v_needs_review boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION ''Not authenticated'' USING ERRCODE = ''28000'';
  END IF;

  BEGIN
    v_user_role := p_role::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION ''Invalid role: %'', p_role USING ERRCODE = ''22023'';
  END;

  SELECT id, role, email
  INTO   v_profile
  FROM   public.profiles
  WHERE  id = v_uid
  FOR    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Profile not found for uid %'', v_uid USING ERRCODE = ''P0002'';
  END IF;

  IF v_profile.role IS NOT NULL THEN
    RETURN jsonb_build_object(
      ''status'', ''already_set'',
      ''role'',   v_profile.role,
      ''org_id'', NULL
    );
  END IF;

  IF v_user_role = ''ORG_ADMIN'' THEN
    IF p_org_legal_name IS NULL OR trim(p_org_legal_name) = '''' THEN
      RAISE EXCEPTION ''org_legal_name is required for ORG_ADMIN'' USING ERRCODE = ''22023'';
    END IF;
    IF p_org_display_name IS NULL OR trim(p_org_display_name) = '''' THEN
      RAISE EXCEPTION ''org_display_name is required for ORG_ADMIN'' USING ERRCODE = ''22023'';
    END IF;

    v_needs_review := true;

    INSERT INTO public.organizations (legal_name, display_name, domain, verification_status)
    VALUES (
      trim(p_org_legal_name),
      trim(p_org_display_name),
      NULLIF(trim(coalesce(p_org_domain, '''')), ''''),
      ''PENDING_REVIEW''
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id)
    VALUES (v_uid, ''ORG_ADMIN'', ''ORG_CREATED'', ''organizations'', v_org_id);
  END IF;

  -- Set bypass flag so trigger allows this privileged write
  PERFORM set_config(''arkova.bypass_privileged_check'', ''1'', true);

  UPDATE public.profiles
  SET
    role                   = v_user_role,
    org_id                 = v_org_id,
    requires_manual_review = v_needs_review,
    manual_review_reason   = CASE
                               WHEN v_needs_review
                               THEN ''ORG_ADMIN registration requires KYB review''
                               ELSE NULL
                             END,
    updated_at             = now()
  WHERE id = v_uid;

  PERFORM set_config(''arkova.bypass_privileged_check'', ''0'', true);

  INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id, org_id)
  VALUES (v_uid, v_user_role, ''ROLE_SET'', ''profiles'', v_uid, v_org_id);

  RETURN jsonb_build_object(
    ''status'',          ''ok'',
    ''role'',            v_user_role,
    ''org_id'',          v_org_id,
    ''requires_review'', v_needs_review
  );
END;
';

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;
