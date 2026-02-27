-- ============================================================
-- 0020_fix_public_verification_rpc.sql
-- Fix: record "v_org" is not assigned yet error
-- ============================================================

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
