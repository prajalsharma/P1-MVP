-- ============================================================
-- supabase/seed.sql
-- Arkova development seed data.
--
-- Creates:
--   1 Admin Org      (Arkova Internal)
--   1 Individual User profile
--   1 Org Admin User profile
--
-- NOTE: auth.users rows must be inserted via Supabase auth admin API
-- or manually. These profiles reference pre-known UUIDs for
-- deterministic local development.
-- ============================================================

-- Deterministic UUIDs for repeatability
-- Admin Org
INSERT INTO public.organizations (id, legal_name, display_name, domain, verification_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Arkova Internal Ltd.',
  'Arkova',
  'arkova.com',
  'VERIFIED'
)
ON CONFLICT (id) DO NOTHING;

-- Individual user profile (no org)
-- Corresponds to a hypothetical auth.users entry with the same UUID
INSERT INTO public.profiles (id, email, role, is_public, org_id)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  'individual@test.arkova.com',
  'INDIVIDUAL',
  false,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Org admin user profile (linked to Admin Org)
INSERT INTO public.profiles (id, email, role, is_public, org_id)
VALUES (
  '00000000-0000-0000-0001-000000000002',
  'orgadmin@test.arkova.com',
  'ORG_ADMIN',
  false,
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;
