-- ============================================================
-- 0007_enable_rls.sql
-- Enable Row Level Security on all application tables.
-- ============================================================

ALTER TABLE public.organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events    ENABLE ROW LEVEL SECURITY;

-- Deny all by default (no fallthrough policies)
-- Explicit policies in 0008–0011 grant specific access.
