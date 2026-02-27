/**
 * Database types for Arkova — hand-generated from live Supabase schema.
 * Project: vrgzaodsvutrfathchkm
 */

export type UserRole = "INDIVIDUAL" | "ORG_ADMIN";
export type AnchorStatus = "PENDING" | "SECURED" | "REVOKED";

export interface Database {
  public: {
    Functions: {
      update_profile_onboarding: {
        Args: {
          p_role: string;
          p_org_legal_name?: string | null;
          p_org_display_name?: string | null;
          p_org_domain?: string | null;
        };
        Returns: {
          status: string;
          role: UserRole | null;
          org_id: string | null;
          requires_review: boolean;
        };
      };
      complete_onboarding: {
        Args: {
          p_role: string;
          p_org_legal_name?: string | null;
          p_org_display_name?: string | null;
          p_org_domain?: string | null;
        };
        Returns: {
          status: string;
          role: UserRole | null;
          org_id: string | null;
          requires_review: boolean;
        };
      };
      get_public_verification: {
        Args: {
          p_public_id: string;
        };
        Returns: PublicVerificationResult;
      };
    };
    Tables: {
      organizations: {
        Row: Organization;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
      };
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      anchors: {
        Row: Anchor;
        Insert: AnchorInsert;
        Update: AnchorUpdate;
      };
      anchor_events: {
        Row: AnchorEvent;
        Insert: AnchorEventInsert;
        Update: never;
      };
      audit_events: {
        Row: AuditEvent;
        Insert: AuditEventInsert;
        Update: never; // immutable
      };
    };
    Enums: {
      user_role: UserRole;
      anchor_status: AnchorStatus;
    };
  };
}

// ─── organizations ────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  legal_name: string;
  display_name: string;
  domain: string | null;
  verification_status: string;
  created_at: string;
  updated_at: string;
}

export type OrganizationInsert = Omit<Organization, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  verification_status?: string;
};

export type OrganizationUpdate = Partial<Omit<Organization, "id" | "created_at">>;

// ─── profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string; // = auth.users.id
  email: string;
  role: UserRole | null;
  is_public: boolean;
  org_id: string | null;
  requires_manual_review: boolean;
  manual_review_reason: string | null;
  role_set_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = {
  id: string;
  email: string;
  role?: UserRole | null;
  is_public?: boolean;
  org_id?: string | null;
  requires_manual_review?: boolean;
  manual_review_reason?: string | null;
  role_set_at?: string | null;
  onboarding_completed_at?: string | null;
};

/** Users may only update non-privileged fields via RLS. */
export type ProfileUpdate = {
  is_public?: boolean;
  onboarding_completed_at?: string | null;
};

// ─── anchors ──────────────────────────────────────────────────────────────────

export interface Anchor {
  id: string;
  public_id: string; // Non-guessable ID for public verification
  user_id: string;
  org_id: string | null;
  file_fingerprint: string; // SHA-256 hex
  file_name: string;
  file_size_bytes: number;
  file_mime: string;
  status: AnchorStatus;
  jurisdiction: string | null; // ISO 3166-1 alpha-2 with optional subdivision (e.g., US, GB, US-CA)
  retention_policy: string;
  retain_until: string | null;
  legal_hold: boolean;
  deleted_at: string | null;
  created_at: string;
  // Blockchain attestation fields
  chain_tx_id: string | null;
  chain_timestamp: string | null;
  chain_block_height: number | null;
  chain_network: string | null;
}

export type AnchorInsert = {
  user_id: string;
  org_id?: string | null;
  file_fingerprint: string;
  file_name: string;
  file_size_bytes: number;
  file_mime: string;
  status?: AnchorStatus;
  jurisdiction?: string | null;
  retention_policy?: string;
  retain_until?: string | null;
  legal_hold?: boolean;
};

export type AnchorUpdate = Partial<
  Pick<Anchor, "status" | "retain_until" | "legal_hold" | "deleted_at" | "retention_policy" | "jurisdiction" | "chain_tx_id" | "chain_timestamp" | "chain_block_height">
>;

// ─── anchor_events (lifecycle timeline) ───────────────────────────────────────

export interface AnchorEvent {
  id: string;
  anchor_id: string;
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
}

export type AnchorEventInsert = {
  anchor_id: string;
  event_type: string;
  occurred_at?: string;
  actor_user_id?: string | null;
  metadata?: Record<string, unknown>;
};

// ─── audit_events ─────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_role: UserRole | null;
  action: string;
  target_table: string;
  target_id: string | null;
  org_id: string | null;
}

export type AuditEventInsert = {
  actor_user_id?: string | null;
  actor_role?: UserRole | null;
  action: string;
  target_table: string;
  target_id?: string | null;
  org_id?: string | null;
};

// ─── public verification ──────────────────────────────────────────────────────

export interface PublicVerificationEvent {
  event_type: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface PublicVerificationResult {
  found: boolean;
  public_id?: string;
  status?: AnchorStatus;
  file_fingerprint?: string;
  file_name?: string;
  created_at?: string;
  jurisdiction?: string | null;
  issuer_name?: string;
  chain_tx_id?: string | null;
  chain_timestamp?: string | null;
  chain_block_height?: number | null;
  chain_network?: string | null;
  events?: PublicVerificationEvent[];
}
