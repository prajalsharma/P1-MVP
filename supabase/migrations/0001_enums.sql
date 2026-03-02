-- ============================================================
-- 0001_enums.sql
-- Canonical enum types for Arkova.
-- ============================================================

-- user_role: determines access level and product experience
CREATE TYPE public.user_role AS ENUM (
  'INDIVIDUAL',
  'ORG_ADMIN'
);

-- anchor_status: lifecycle state of a secured evidence record
CREATE TYPE public.anchor_status AS ENUM (
  'PENDING',
  'SECURED',
  'REVOKED'
);
