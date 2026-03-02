-- ============================================================
-- 0012_complete_onboarding_rpc.sql
-- Transactional onboarding function — P2-S3
--
-- complete_onboarding(role, org_legal_name?, org_display_name?, org_domain?)
--
-- Rules enforced server-side:
--   1. Caller must be authenticated (auth.uid() IS NOT NULL)
--   2. Role may only be set if profile.role IS NULL  (idempotent guard)
--   3. ORG_ADMIN path creates/links an organization atomically
--   4. Emits ROLE_SET audit event always
--   5. Emits ORG_CREATED audit event if org was created
--   6. Client NEVER writes role / org_id / requires_manual_review directly
-- ============================================================

-- Helper: enforce caller is authenticated
CREATE OR REPLACE FUNCTION public.assert_authenticated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS '
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION ''Not authenticated''
      USING ERRCODE = ''28000'';
  END IF;
END;
';

-- ── Main RPC ─────────────────────────────────────────────────────────────────

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
  v_needs_review boolean := false;
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

    -- Manual review required: always flag org admins for KYB review
    v_needs_review := true;

    -- Create organization
    INSERT INTO public.organizations (legal_name, display_name, domain, verification_status)
    VALUES (
      trim(p_org_legal_name),
      trim(p_org_display_name),
      NULLIF(trim(coalesce(p_org_domain, '''')), ''''),
      ''PENDING_REVIEW''
    )
    RETURNING id INTO v_org_id;

    -- Audit: ORG_CREATED
    INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id)
    VALUES (v_uid, ''ORG_ADMIN'', ''ORG_CREATED'', ''organizations'', v_org_id);
  END IF;

  -- ── Set role + org_id + review flag (privileged write via SECURITY DEFINER) ─
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

-- Revoke direct execution from anon; only authenticated callers via SECURITY DEFINER
REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;
