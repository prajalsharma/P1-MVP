-- ============================================================
-- ARKOVA MVP - COMPLETE DATABASE SETUP
-- ============================================================
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor
-- This sets up all P1-P6 features in one go
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- P1-C: CANONICAL ENUMS
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('INDIVIDUAL', 'ORG_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.anchor_status AS ENUM ('PENDING', 'SECURED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════
-- P1-D: ORGANIZATIONS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name          TEXT NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 255),
  display_name        TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 255),
  domain              TEXT CHECK (domain IS NULL OR domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'),
  verification_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (char_length(verification_status) <= 32),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_domain_idx ON public.organizations (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizations_created_at_idx ON public.organizations (created_at);

-- ════════════════════════════════════════════════════════════
-- P1-E: PROFILES TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    TEXT NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role                     public.user_role,
  is_public                BOOLEAN NOT NULL DEFAULT false,
  org_id                   UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  requires_manual_review   BOOLEAN NOT NULL DEFAULT false,
  manual_review_reason     TEXT,
  role_set_at              TIMESTAMPTZ,
  onboarding_completed_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role) WHERE role IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- P1-F: ANCHORS TABLE (EVIDENCE PRIMITIVE)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.anchors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  org_id            UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  file_fingerprint  TEXT NOT NULL CHECK (file_fingerprint ~ '^[0-9a-f]{64}$'),
  file_name         TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255 AND file_name !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  file_size_bytes   BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5368709120),
  file_mime         TEXT NOT NULL CHECK (file_mime ~ '^[a-zA-Z0-9][a-zA-Z0-9!#$&^_-]{0,62}/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,62}'),
  status            public.anchor_status NOT NULL DEFAULT 'PENDING',
  retention_policy  TEXT NOT NULL DEFAULT 'STANDARD' CHECK (char_length(retention_policy) <= 64),
  retain_until      TIMESTAMPTZ NULL,
  legal_hold        BOOLEAN NOT NULL DEFAULT false,
  deleted_at        TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anchors_user_id_idx ON public.anchors (user_id);
CREATE INDEX IF NOT EXISTS anchors_org_id_idx ON public.anchors (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS anchors_file_fingerprint_idx ON public.anchors (file_fingerprint);
CREATE INDEX IF NOT EXISTS anchors_status_idx ON public.anchors (status);
CREATE INDEX IF NOT EXISTS anchors_legal_hold_idx ON public.anchors (legal_hold) WHERE legal_hold = true;
CREATE INDEX IF NOT EXISTS anchors_created_at_idx ON public.anchors (created_at);

-- Prevent hard deletion of anchors under legal hold
CREATE OR REPLACE FUNCTION public.prevent_legal_hold_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.legal_hold = true THEN
    RAISE EXCEPTION 'Cannot delete anchor % — legal hold is active', OLD.id USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anchors_no_delete_on_legal_hold ON public.anchors;
CREATE TRIGGER anchors_no_delete_on_legal_hold
  BEFORE DELETE ON public.anchors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_legal_hold_delete();

-- ════════════════════════════════════════════════════════════
-- P1-G: AUDIT EVENTS (IMMUTABLE)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role     public.user_role,
  action         TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 64),
  target_table   TEXT NOT NULL CHECK (char_length(target_table) BETWEEN 1 AND 64),
  target_id      UUID,
  org_id         UUID REFERENCES public.organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx ON public.audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_events_org_id_idx ON public.audit_events (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON public.audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON public.audit_events (action);

-- Block UPDATE/DELETE on audit_events
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only; UPDATE and DELETE are forbidden' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON public.audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_delete ON public.audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- ════════════════════════════════════════════════════════════
-- P1-I: ROLE IMMUTABILITY
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_role_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role is immutable once set' USING ERRCODE = '23514';
  END IF;
  IF NEW.role IS NOT NULL AND OLD.role IS NULL THEN
    NEW.role_set_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_role_immutability ON public.profiles;
CREATE TRIGGER profiles_role_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_immutability();

-- ════════════════════════════════════════════════════════════
-- P1-J: ENABLE RLS (DEFAULT DENY)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.organizations FROM anon, authenticated;
REVOKE ALL ON public.anchors FROM anon, authenticated;
REVOKE ALL ON public.audit_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.anchors TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

-- ════════════════════════════════════════════════════════════
-- P1-K: RLS — PROFILES
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- P1-L: RLS — ORGANIZATIONS
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'ORG_ADMIN' AND org_id IS NOT NULL)
  );

DROP POLICY IF EXISTS organizations_insert_via_onboarding ON public.organizations;
CREATE POLICY organizations_insert_via_onboarding ON public.organizations
  FOR INSERT WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- P1-M: RLS — ANCHORS
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS anchors_select_own ON public.anchors;
CREATE POLICY anchors_select_own ON public.anchors
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS anchors_select_org_admin ON public.anchors;
CREATE POLICY anchors_select_org_admin ON public.anchors
  FOR SELECT USING (
    org_id IS NOT NULL AND
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'ORG_ADMIN' AND org_id IS NOT NULL)
  );

DROP POLICY IF EXISTS anchors_insert_own ON public.anchors;
CREATE POLICY anchors_insert_own ON public.anchors
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS anchors_update_own ON public.anchors;
CREATE POLICY anchors_update_own ON public.anchors
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS anchors_update_org_admin ON public.anchors;
CREATE POLICY anchors_update_org_admin ON public.anchors
  FOR UPDATE USING (
    org_id IS NOT NULL AND
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'ORG_ADMIN' AND org_id IS NOT NULL)
  );

-- ════════════════════════════════════════════════════════════
-- P1-N: RLS — AUDIT EVENTS
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS audit_events_select_own ON public.audit_events;
CREATE POLICY audit_events_select_own ON public.audit_events
  FOR SELECT USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS audit_events_select_org_admin ON public.audit_events;
CREATE POLICY audit_events_select_org_admin ON public.audit_events
  FOR SELECT USING (
    org_id IS NOT NULL AND
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'ORG_ADMIN' AND org_id IS NOT NULL)
  );

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- P2-S3: AUTO-CREATE PROFILE ON SIGNUP
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, LOWER(TRIM(COALESCE(NEW.email, ''))))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Backfill existing users
INSERT INTO public.profiles (id, email)
SELECT id, LOWER(TRIM(COALESCE(email, '')))
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- P2-S3: COMPLETE ONBOARDING RPC (TRANSACTIONAL)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_role             text,
  p_org_legal_name   text DEFAULT NULL,
  p_org_display_name text DEFAULT NULL,
  p_org_domain       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Load profile
  SELECT id, role, email INTO v_profile
  FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check
  IF v_profile.role IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_set', 'role', v_profile.role);
  END IF;

  -- ORG_ADMIN path
  IF v_user_role = 'ORG_ADMIN' THEN
    IF p_org_legal_name IS NULL OR trim(p_org_legal_name) = '' THEN
      RAISE EXCEPTION 'org_legal_name required' USING ERRCODE = '22023';
    END IF;
    IF p_org_display_name IS NULL OR trim(p_org_display_name) = '' THEN
      RAISE EXCEPTION 'org_display_name required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.organizations (legal_name, display_name, domain, verification_status)
    VALUES (trim(p_org_legal_name), trim(p_org_display_name),
            NULLIF(trim(coalesce(p_org_domain, '')), ''), 'VERIFIED')
    RETURNING id INTO v_org_id;

    INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id)
    VALUES (v_uid, 'ORG_ADMIN', 'ORG_CREATED', 'organizations', v_org_id);
  END IF;

  -- Update profile
  UPDATE public.profiles SET
    role = v_user_role,
    org_id = v_org_id,
    requires_manual_review = false,
    manual_review_reason = NULL,
    onboarding_completed_at = now(),
    updated_at = now()
  WHERE id = v_uid;

  -- Audit event
  INSERT INTO public.audit_events (actor_user_id, actor_role, action, target_table, target_id, org_id)
  VALUES (v_uid, v_user_role, 'ROLE_SET', 'profiles', v_uid, v_org_id);

  RETURN jsonb_build_object('status', 'ok', 'role', v_user_role, 'org_id', v_org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- P4: AUTO-SET ORG_ID ON ANCHOR INSERT
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_anchor_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anchors_set_org_id ON public.anchors;
CREATE TRIGGER anchors_set_org_id
  BEFORE INSERT ON public.anchors
  FOR EACH ROW EXECUTE FUNCTION public.set_anchor_org_id();

GRANT EXECUTE ON FUNCTION public.set_anchor_org_id() TO authenticated;

-- ════════════════════════════════════════════════════════════
-- P5-S5 & P6-S1: PUBLIC VERIFICATION SUPPORT
-- ════════════════════════════════════════════════════════════

-- Add public_id for public verification URLs
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE;

-- Generate public_id for existing anchors
UPDATE public.anchors
SET public_id = encode(gen_random_bytes(16), 'hex')
WHERE public_id IS NULL;

-- Make public_id NOT NULL going forward
DO $$ BEGIN
  ALTER TABLE public.anchors ALTER COLUMN public_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add default for new rows
ALTER TABLE public.anchors
ALTER COLUMN public_id SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- Index for fast public_id lookups
CREATE INDEX IF NOT EXISTS anchors_public_id_idx ON public.anchors (public_id);

-- Add jurisdiction field (informational, customer-asserted)
-- Format: ISO 3166-1 alpha-2 with optional subdivision (US, GB, US-CA, GB-ENG)
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS jurisdiction TEXT
CHECK (
  jurisdiction IS NULL OR
  jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
);

-- Add blockchain attestation fields
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS chain_tx_id TEXT,
ADD COLUMN IF NOT EXISTS chain_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chain_block_height BIGINT,
ADD COLUMN IF NOT EXISTS chain_network TEXT DEFAULT 'ethereum';

-- ════════════════════════════════════════════════════════════
-- ANCHOR_EVENTS TABLE (LIFECYCLE TIMELINE)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.anchor_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id     UUID NOT NULL REFERENCES public.anchors(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 32),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata      JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS anchor_events_anchor_id_idx ON public.anchor_events (anchor_id);
CREATE INDEX IF NOT EXISTS anchor_events_occurred_at_idx ON public.anchor_events (occurred_at);

-- Enable RLS on anchor_events
ALTER TABLE public.anchor_events ENABLE ROW LEVEL SECURITY;

-- Users can read events for their own anchors
DROP POLICY IF EXISTS anchor_events_select_own ON public.anchor_events;
CREATE POLICY anchor_events_select_own ON public.anchor_events
  FOR SELECT USING (
    anchor_id IN (SELECT id FROM public.anchors WHERE user_id = auth.uid())
  );

-- Org admins can read events for org anchors
DROP POLICY IF EXISTS anchor_events_select_org ON public.anchor_events;
CREATE POLICY anchor_events_select_org ON public.anchor_events
  FOR SELECT USING (
    anchor_id IN (
      SELECT a.id FROM public.anchors a
      JOIN public.profiles p ON p.org_id = a.org_id
      WHERE p.id = auth.uid() AND p.role = 'ORG_ADMIN'
    )
  );

-- Public can read events for public verification (no auth required)
DROP POLICY IF EXISTS anchor_events_select_public ON public.anchor_events;
CREATE POLICY anchor_events_select_public ON public.anchor_events
  FOR SELECT USING (true);

-- Insert allowed for authenticated users
DROP POLICY IF EXISTS anchor_events_insert ON public.anchor_events;
CREATE POLICY anchor_events_insert ON public.anchor_events
  FOR INSERT WITH CHECK (true);

GRANT SELECT ON public.anchor_events TO anon;
GRANT SELECT, INSERT ON public.anchor_events TO authenticated;

-- ════════════════════════════════════════════════════════════
-- LIFECYCLE EVENT TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Create lifecycle event on anchor insert
CREATE OR REPLACE FUNCTION public.create_anchor_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.anchor_events (anchor_id, event_type, actor_user_id)
  VALUES (NEW.id, 'CREATED', NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anchors_create_event ON public.anchors;
CREATE TRIGGER anchors_create_event
  AFTER INSERT ON public.anchors
  FOR EACH ROW EXECUTE FUNCTION public.create_anchor_created_event();

-- Create lifecycle event on status change
CREATE OR REPLACE FUNCTION public.create_anchor_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.anchor_events (anchor_id, event_type, metadata)
    VALUES (
      NEW.id,
      'STATUS_CHANGED',
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anchors_status_event ON public.anchors;
CREATE TRIGGER anchors_status_event
  AFTER UPDATE ON public.anchors
  FOR EACH ROW EXECUTE FUNCTION public.create_anchor_status_event();

-- ════════════════════════════════════════════════════════════
-- PUBLIC VERIFICATION FUNCTION (NO AUTH REQUIRED)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_public_verification(p_public_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_anchor record;
  v_events jsonb;
  v_org record;
BEGIN
  -- Fetch anchor by public_id
  SELECT * INTO v_anchor
  FROM public.anchors
  WHERE public_id = p_public_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Fetch org info if present
  IF v_anchor.org_id IS NOT NULL THEN
    SELECT display_name INTO v_org
    FROM public.organizations
    WHERE id = v_anchor.org_id;
  END IF;

  -- Fetch lifecycle events
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_type', event_type,
      'occurred_at', occurred_at,
      'metadata', metadata
    ) ORDER BY occurred_at ASC
  ), '[]'::jsonb) INTO v_events
  FROM public.anchor_events
  WHERE anchor_id = v_anchor.id;

  RETURN jsonb_build_object(
    'found', true,
    'public_id', v_anchor.public_id,
    'status', v_anchor.status,
    'file_fingerprint', v_anchor.file_fingerprint,
    'file_name', v_anchor.file_name,
    'created_at', v_anchor.created_at,
    'jurisdiction', v_anchor.jurisdiction,
    'issuer_name', COALESCE(v_org.display_name, 'Individual'),
    'chain_tx_id', v_anchor.chain_tx_id,
    'chain_timestamp', v_anchor.chain_timestamp,
    'chain_block_height', v_anchor.chain_block_height,
    'chain_network', v_anchor.chain_network,
    'events', v_events
  );
END;
$$;

-- Allow anon to call this function (public verification)
GRANT EXECUTE ON FUNCTION public.get_public_verification(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_verification(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- SETUP COMPLETE
-- ════════════════════════════════════════════════════════════
-- All P1-P6 database features are now configured.
--
-- Features enabled:
-- ✓ P1: Enums, Tables, RLS, Audit Events, Role Immutability
-- ✓ P2: Auto-profile creation, complete_onboarding RPC
-- ✓ P3: Profile visibility (is_public field)
-- ✓ P4: Anchor creation with auto org_id
-- ✓ P5: Org-scoped RLS, public_id for verification URLs
-- ✓ P6: Bulk operations, public verification page support
-- ✓ Lifecycle timeline (anchor_events)
-- ✓ Blockchain attestation fields
-- ════════════════════════════════════════════════════════════
