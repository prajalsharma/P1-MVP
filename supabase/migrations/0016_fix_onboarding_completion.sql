-- ============================================================
-- 0016_fix_onboarding_completion.sql
-- Fix complete_onboarding to set onboarding_completed_at
-- For MVP: auto-approve all organizations (no manual review gate)
-- In production: set v_needs_review := true for KYB review
-- ============================================================

-- ── Fix complete_onboarding ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_role            text,             -- "INDIVIDUAL" | "ORG_ADMIN"
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
  v_needs_review boolean := false;  -- MVP: auto-approve all orgs
  v_completed_at timestamptz := now();  -- MVP: complete immediately for all
BEGIN
  -- ── Auth guard ────────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION ''Not authenticated'' USING ERRCODE = ''28000'';
  END IF;

  -- ── Validate role input ───────────────────────────────────────────────────
  BEGIN
    v_user_role := p_role::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION ''Invalid role: %'', p_role USING ERRCODE = ''22023'';
  END;

  -- ── Load profile ──────────────────────────────────────────────────────────
  SELECT id, role, email
  INTO   v_profile
  FROM   public.profiles
  WHERE  id = v_uid
  FOR    UPDATE;  -- row-level lock for the transaction

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Profile not found for uid %'', v_uid USING ERRCODE = ''P0002'';
  END IF;

  -- ── Idempotency: role already set → no-op ─────────────────────────────────
  IF v_profile.role IS NOT NULL THEN
    RETURN jsonb_build_object(
      ''status'',   ''already_set'',
      ''role'',     v_profile.role,
      ''org_id'',   NULL
    );
  END IF;

  -- ── ORG_ADMIN path ────────────────────────────────────────────────────────
  IF v_user_role = ''ORG_ADMIN'' THEN
    -- Required fields
    IF p_org_legal_name IS NULL OR trim(p_org_legal_name) = '''' THEN
      RAISE EXCEPTION ''org_legal_name is required for ORG_ADMIN'' USING ERRCODE = ''22023'';
    END IF;
    IF p_org_display_name IS NULL OR trim(p_org_display_name) = '''' THEN
      RAISE EXCEPTION ''org_display_name is required for ORG_ADMIN'' USING ERRCODE = ''22023'';
    END IF;

    -- Create organization (auto-verified for MVP)
    INSERT INTO public.organizations (legal_name, display_name, domain, verification_status)
    VALUES (
      trim(p_org_legal_name),
      trim(p_org_display_name),
      NULLIF(trim(coalesce(p_org_domain, '''')), ''''),
      ''VERIFIED''  -- MVP: auto-verify
    )
    RETURNING id INTO v_org_id;

    -- Audit: ORG_CREATED
    INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id)
    VALUES (v_uid, ''ORG_ADMIN'', ''ORG_CREATED'', ''organizations'', v_org_id);
  END IF;

  -- ── Set role + org_id (privileged write via SECURITY DEFINER) ─────────────
  UPDATE public.profiles
  SET
    role                     = v_user_role,
    org_id                   = v_org_id,
    requires_manual_review   = v_needs_review,
    manual_review_reason     = NULL,
    onboarding_completed_at  = v_completed_at,
    updated_at               = now()
  WHERE id = v_uid;

  -- ── Audit: ROLE_SET ───────────────────────────────────────────────────────
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

-- ── Admin RPC to approve an organization ────────────────────────────────────
-- For P1 MVP, this is called manually via Supabase Dashboard
-- In production, this would be behind an admin API

CREATE OR REPLACE FUNCTION public.approve_organization(
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS '
DECLARE
  v_profile record;
BEGIN
  -- Load profile
  SELECT id, role, org_id, requires_manual_review
  INTO   v_profile
  FROM   public.profiles
  WHERE  id = p_profile_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Profile not found'' USING ERRCODE = ''P0002'';
  END IF;

  IF v_profile.role != ''ORG_ADMIN'' THEN
    RAISE EXCEPTION ''Profile is not an ORG_ADMIN'' USING ERRCODE = ''22023'';
  END IF;

  IF NOT v_profile.requires_manual_review THEN
    RETURN jsonb_build_object(''status'', ''already_approved'');
  END IF;

  -- Update profile: clear review flag, set completed timestamp
  UPDATE public.profiles
  SET
    requires_manual_review  = false,
    manual_review_reason    = NULL,
    onboarding_completed_at = now(),
    updated_at              = now()
  WHERE id = p_profile_id;

  -- Update organization status
  UPDATE public.organizations
  SET verification_status = ''VERIFIED''
  WHERE id = v_profile.org_id;

  -- Audit event
  INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id, org_id)
  VALUES (p_profile_id, ''ORG_ADMIN'', ''ORG_APPROVED'', ''profiles'', p_profile_id, v_profile.org_id);

  RETURN jsonb_build_object(
    ''status'',   ''approved'',
    ''org_id'',   v_profile.org_id
  );
END;
';

-- Grant execute to service_role (for admin operations)
GRANT EXECUTE ON FUNCTION public.approve_organization(uuid) TO service_role;
