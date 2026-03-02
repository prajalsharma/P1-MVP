-- ============================================================
-- 0018_public_verification.sql
-- P5-S5: Issue Credential with public_id
-- P6-S1: Public Verification Page support
-- Data Model: Add jurisdiction field
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- Add public_id for public verification URLs
-- Non-guessable, not derived from internal ID
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE;

-- Generate public_id for existing anchors
UPDATE public.anchors
SET public_id = replace(gen_random_uuid()::text, '-', '')
WHERE public_id IS NULL;

-- Make public_id NOT NULL going forward
ALTER TABLE public.anchors
ALTER COLUMN public_id SET NOT NULL;

-- Add default for new rows
ALTER TABLE public.anchors
ALTER COLUMN public_id SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Index for fast public_id lookups
CREATE INDEX IF NOT EXISTS anchors_public_id_idx ON public.anchors (public_id);

-- ══════════════════════════════════════════════════════════════
-- Add jurisdiction field (informational, customer-asserted)
-- Format: ISO 3166-1 alpha-2 with optional subdivision
-- Example: US, GB, DE, US-CA, GB-ENG
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS jurisdiction TEXT
CHECK (
  jurisdiction IS NULL OR
  jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
);

-- ══════════════════════════════════════════════════════════════
-- Add lifecycle events table for timeline display
-- ══════════════════════════════════════════════════════════════
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
CREATE POLICY anchor_events_select_own ON public.anchor_events
  FOR SELECT USING (
    anchor_id IN (SELECT id FROM public.anchors WHERE user_id = auth.uid())
  );

-- Org admins can read events for org anchors
CREATE POLICY anchor_events_select_org ON public.anchor_events
  FOR SELECT USING (
    anchor_id IN (
      SELECT a.id FROM public.anchors a
      JOIN public.profiles p ON p.org_id = a.org_id
      WHERE p.id = auth.uid() AND p.role = 'ORG_ADMIN'
    )
  );

-- Public can read events for public verification (no auth required)
CREATE POLICY anchor_events_select_public ON public.anchor_events
  FOR SELECT USING (true);

-- Insert allowed for authenticated users
CREATE POLICY anchor_events_insert ON public.anchor_events
  FOR INSERT WITH CHECK (true);

GRANT SELECT ON public.anchor_events TO anon;
GRANT SELECT, INSERT ON public.anchor_events TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Add anchor proof fields for blockchain attestation
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.anchors
ADD COLUMN IF NOT EXISTS chain_tx_id TEXT,
ADD COLUMN IF NOT EXISTS chain_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chain_block_height BIGINT,
ADD COLUMN IF NOT EXISTS chain_network TEXT DEFAULT 'ethereum';

-- ══════════════════════════════════════════════════════════════
-- Function to create lifecycle event on anchor insert
-- ══════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════
-- Function to create lifecycle event on status change
-- ══════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════
-- Public verification function (no auth required)
-- Returns public-safe fields only
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_public_verification(p_public_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
    v_anchor record;
    v_events jsonb;
    v_issuer_name TEXT := 'Individual';
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
      SELECT display_name INTO v_issuer_name
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
      'issuer_name', v_issuer_name,
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
