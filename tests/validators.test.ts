/**
 * Tests for src/lib/validators.ts
 *
 * Covers:
 *  - file_fingerprint: SHA-256 hex enforcement
 *  - file_name: PII rejection, length limits
 *  - file_mime: MIME format validation
 *  - role: canonical enum enforcement
 *  - AnchorInsertSchema happy path
 *  - ProfileInsertSchema happy path
 */

import { describe, it, expect } from "vitest";
import {
  AnchorInsertSchema,
  ProfileInsertSchema,
  ProfileUpdateSchema,
  OrganizationInsertSchema,
  AuditEventInsertSchema,
  UserRoleSchema,
  AnchorStatusSchema,
} from "../src/lib/validators";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SHA256 = "a".repeat(64); // 64 hex chars
const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_ANCHOR = {
  user_id: VALID_UUID,
  file_fingerprint: VALID_SHA256,
  file_name: "contract_2024.pdf",
  file_size_bytes: 1024,
  file_mime: "application/pdf",
};

// ─── Enums ────────────────────────────────────────────────────────────────────

describe("UserRoleSchema", () => {
  it("accepts INDIVIDUAL", () => {
    expect(UserRoleSchema.parse("INDIVIDUAL")).toBe("INDIVIDUAL");
  });
  it("accepts ORG_ADMIN", () => {
    expect(UserRoleSchema.parse("ORG_ADMIN")).toBe("ORG_ADMIN");
  });
  it("rejects unknown value", () => {
    expect(() => UserRoleSchema.parse("ADMIN")).toThrow();
  });
  it("rejects lowercase individual", () => {
    expect(() => UserRoleSchema.parse("individual")).toThrow();
  });
});

describe("AnchorStatusSchema", () => {
  it("accepts PENDING", () => {
    expect(AnchorStatusSchema.parse("PENDING")).toBe("PENDING");
  });
  it("accepts SECURED", () => {
    expect(AnchorStatusSchema.parse("SECURED")).toBe("SECURED");
  });
  it("accepts REVOKED", () => {
    expect(AnchorStatusSchema.parse("REVOKED")).toBe("REVOKED");
  });
  it("rejects invalid value", () => {
    expect(() => AnchorStatusSchema.parse("CONFIRMED")).toThrow();
  });
});

// ─── file_fingerprint ─────────────────────────────────────────────────────────

describe("AnchorInsertSchema — file_fingerprint", () => {
  it("accepts valid 64-char lowercase hex", () => {
    const result = AnchorInsertSchema.safeParse(VALID_ANCHOR);
    expect(result.success).toBe(true);
  });

  it("accepts mixed-case hex (case-insensitive regex)", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_fingerprint: "A".repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it("rejects 63-char fingerprint (too short)", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_fingerprint: "a".repeat(63),
    });
    expect(result.success).toBe(false);
  });

  it("rejects 65-char fingerprint (too long)", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_fingerprint: "a".repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-hex chars in fingerprint", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_fingerprint: "g".repeat(64), // 'g' is not hex
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fingerprint", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_fingerprint: "",
    });
    expect(result.success).toBe(false);
  });
});

// ─── file_name ────────────────────────────────────────────────────────────────

describe("AnchorInsertSchema — file_name", () => {
  it("accepts a normal filename", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_name: "annual_report_2024.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("rejects filename that looks like an email address", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_name: "john.doe@example.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("email"))).toBe(true);
    }
  });

  it("rejects filename that looks like an SSN", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_name: "123-45-6789",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("SSN"))).toBe(true);
    }
  });

  it("rejects empty filename", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects filename > 255 chars", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_name: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

// ─── file_mime ────────────────────────────────────────────────────────────────

describe("AnchorInsertSchema — file_mime", () => {
  it("accepts application/pdf", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_mime: "application/pdf" });
    expect(result.success).toBe(true);
  });

  it("accepts image/png", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_mime: "image/png" });
    expect(result.success).toBe(true);
  });

  it("accepts text/plain", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_mime: "text/plain" });
    expect(result.success).toBe(true);
  });

  it("rejects empty mime", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_mime: "" });
    expect(result.success).toBe(false);
  });

  it("rejects mime without subtype", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_mime: "application" });
    expect(result.success).toBe(false);
  });
});

// ─── file_size_bytes ─────────────────────────────────────────────────────────

describe("AnchorInsertSchema — file_size_bytes", () => {
  it("accepts 1 byte", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_size_bytes: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts 5 GiB", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_size_bytes: 5_368_709_120,
    });
    expect(result.success).toBe(true);
  });

  it("rejects 0 bytes", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_size_bytes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative bytes", () => {
    const result = AnchorInsertSchema.safeParse({ ...VALID_ANCHOR, file_size_bytes: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects > 5 GiB", () => {
    const result = AnchorInsertSchema.safeParse({
      ...VALID_ANCHOR,
      file_size_bytes: 5_368_709_121,
    });
    expect(result.success).toBe(false);
  });
});

// ─── ProfileInsertSchema ─────────────────────────────────────────────────────

describe("ProfileInsertSchema", () => {
  const VALID_PROFILE = {
    id: VALID_UUID,
    email: "user@example.com",
  };

  it("accepts valid profile with no role", () => {
    const result = ProfileInsertSchema.safeParse(VALID_PROFILE);
    expect(result.success).toBe(true);
  });

  it("accepts INDIVIDUAL role", () => {
    const result = ProfileInsertSchema.safeParse({ ...VALID_PROFILE, role: "INDIVIDUAL" });
    expect(result.success).toBe(true);
  });

  it("accepts ORG_ADMIN role", () => {
    const result = ProfileInsertSchema.safeParse({ ...VALID_PROFILE, role: "ORG_ADMIN" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = ProfileInsertSchema.safeParse({ ...VALID_PROFILE, role: "SUPER_ADMIN" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = ProfileInsertSchema.safeParse({ ...VALID_PROFILE, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for id", () => {
    const result = ProfileInsertSchema.safeParse({ ...VALID_PROFILE, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ─── OrganizationInsertSchema ─────────────────────────────────────────────────

describe("OrganizationInsertSchema", () => {
  it("accepts valid org without domain", () => {
    const result = OrganizationInsertSchema.safeParse({
      legal_name: "Acme Corp Ltd.",
      display_name: "Acme",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid org with domain", () => {
    const result = OrganizationInsertSchema.safeParse({
      legal_name: "Acme Corp Ltd.",
      display_name: "Acme",
      domain: "acme.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid domain", () => {
    const result = OrganizationInsertSchema.safeParse({
      legal_name: "Acme",
      display_name: "Acme",
      domain: "not a domain!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty legal_name", () => {
    const result = OrganizationInsertSchema.safeParse({
      legal_name: "",
      display_name: "Acme",
    });
    expect(result.success).toBe(false);
  });
});

// ─── AuditEventInsertSchema ───────────────────────────────────────────────────

describe("AuditEventInsertSchema", () => {
  it("accepts minimal event", () => {
    const result = AuditEventInsertSchema.safeParse({
      action: "ANCHOR_CREATED",
      target_table: "anchors",
    });
    expect(result.success).toBe(true);
  });

  it("accepts event with all fields", () => {
    const result = AuditEventInsertSchema.safeParse({
      actor_user_id: VALID_UUID,
      actor_role: "INDIVIDUAL",
      action: "ANCHOR_SECURED",
      target_table: "anchors",
      target_id: VALID_UUID,
      org_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty action", () => {
    const result = AuditEventInsertSchema.safeParse({
      action: "",
      target_table: "anchors",
    });
    expect(result.success).toBe(false);
  });

  it("rejects action > 128 chars", () => {
    const result = AuditEventInsertSchema.safeParse({
      action: "x".repeat(129),
      target_table: "anchors",
    });
    expect(result.success).toBe(false);
  });
});
