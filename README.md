# Arkova — Immutable Evidence Platform

Arkova is a high-assurance platform for anchoring and verifying digital evidence. It provides a non-custodial, privacy-first way to secure documents using blockchain attestations.

## Core Value Proposition
- **Privacy-First**: No raw document bytes ever leave the user's device. Arkova only stores cryptographic fingerprints.
- **Compliance-Ready**: Built for European eIDAS and global technical standards, including mandatory UTC inclusion in every hash.
- **Evidence Lifecycle**: Full tracking from creation to revocation, with publicly shareable verification links.

---

## 🏗️ Project Status (MVP Progress)

Arkova is currently in its **MVP phase**, with Priorities 1 through 6 fully implemented.

### ✅ Completed (P1–P6)
- **Priority 1: Bedrock**: Schema, RLS policies, append-only audit logs, and UTC timestamp enforcement.
- **Priority 2: Identity**: Forked onboarding for Individuals and Organizations with manual review gates.
- **Priority 3: Vault**: Personal evidence storage and privacy controls.
- **Priority 4: Anchor Engine**: Client-side SHA-256 hashing with ISO UTC timestamp injection.
- **Priority 5: Organization Admin**: Registry management, anchor revocation, and team isolation.
- **Priority 6: Bulk Operations**: CSV-based bulk verification wizard.
- **Public Verification**: Non-guessable `public_id` URLs for third-party verification without account creation.

### 🚀 Upcoming (P7–P8)
- **Priority 7: Go-Live Operations**:
  - Stripe payments & entitlement management.
  - Dedicated anchoring worker (Node.js service) for blockchain publishing.
  - Outbound webhooks for enterprise integration.
- **Priority 8: AI Intelligence**:
  - Google Gemini integration for smart document extraction and fraud detection.
  - Semantic search across metadata.
  - AI-assisted batch processing.

---

## 🛠️ Technical Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn/UI.
- **Backend**: Supabase (PostgreSQL, Auth, RLS).
- **Validation**: Zod (strict schema enforcement).
- **Cryptography**: Web Crypto API (SHA-256).

---

## 🔒 Security & Compliance (GTD Highlights)
- **Hashing Protocol**: Every fingerprint is computed as `SHA-256(file_bytes + ISO_UTC_timestamp)`.
- **Zero-Trust**: Row Level Security (RLS) is enabled on all tables.
- **Terminology**: The UI strictly uses approved terms like "Vault", "Anchor", and "Fingerprint" instead of crypto-jargon.
- **UTC Enforcement**: All internal and external timestamps are UTC-only.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ or Bun 1.1+
- Supabase CLI

### Setup
1. **Clone & Install**:
   ```bash
   bun install
   ```
2. **Environment**:
   Copy `.env.local.example` to `.env.local` and fill in your Supabase and Google OAuth credentials.
3. **Database**:
   ```bash
   supabase db reset
   ```
4. **Development**:
   ```bash
   bun run dev
   ```

---

## 📖 Documentation
Detailed technical documentation is available in the `/docs` folder:
- `docs/10_gtd.md`: Global Technical Directives (The Constitution).
- `docs/confluence/02_data_model.md`: Comprehensive Data Model.
- `docs/confluence/08_identity_onboarding.md`: Auth & Onboarding Flows.
