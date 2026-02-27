-- ============================================================
-- 0019_fix_bypass_flag_in_complete_onboarding.sql
-- The live complete_onboarding function is missing the
-- arkova.bypass_privileged_check set_config call, so the
-- block_privileged_profile_update trigger rejects its UPDATE.
-- This migration redeploys the function with the bypass flag.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_role             text,
  p_org_legal_name   text DEFAULT NULL,
  p_org_display_name text DEFAULT NULL,
  p_org_domain       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_org_id       uuid;
  v_user_role    public.user_role;
BEGIN
  -- Auth guard
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Validate role
  BEGIN
    v_user_role := p_role::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid role: %', p_role USING ERRCODE = '22023';
  END;

  -- Load profile (row-level lock)
  SELECT id, role
  INTO   v_profile
  FROM   public.profiles
  WHERE  id = v_uid
  FOR    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: already onboarded
  IF v_profile.role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_set',
      'role',   v_profile.role
    );
  END IF;

  -- ORG_ADMIN path: create organization
  IF v_user_role = 'ORG_ADMIN' THEN
    IF p_org_legal_name IS NULL OR trim(p_org_legal_name) = '' THEN
      RAISE EXCEPTION 'org_legal_name required' USING ERRCODE = '22023';
    END IF;
    IF p_org_display_name IS NULL OR trim(p_org_display_name) = '' THEN
      RAISE EXCEPTION 'org_display_name required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.organizations (legal_name, display_name, domain, verification_status)
    VALUES (
      trim(p_org_legal_name),
      trim(p_org_display_name),
      NULLIF(trim(coalesce(p_org_domain, '')), ''),
      'VERIFIED'
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id)
    VALUES (v_uid, 'ORG_ADMIN', 'ORG_CREATED', 'organizations', v_org_id);
  END IF;

  -- Set bypass flag so block_privileged_profile_update trigger allows this write
  PERFORM set_config('arkova.bypass_privileged_check', '1', true);

  UPDATE public.profiles
  SET
    role                    = v_user_role,
    org_id                  = v_org_id,
    requires_manual_review  = false,
    manual_review_reason    = NULL,
    onboarding_completed_at = now(),
    updated_at              = now()
  WHERE id = v_uid;

  -- Clear bypass flag
  PERFORM set_config('arkova.bypass_privileged_check', '0', true);

  -- Audit: ROLE_SET
  INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id, org_id)
  VALUES (v_uid, v_user_role, 'ROLE_SET', 'profiles', v_uid, v_org_id);

  RETURN jsonb_build_object(
    'status',          'ok',
    'role',            v_user_role,
    'org_id',          v_org_id,
    'requires_review', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;
