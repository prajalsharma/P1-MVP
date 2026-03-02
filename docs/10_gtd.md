# Global Technical Directive (GTD)

## Section 6: UTC Time + Evidence Semantics

1. All timestamps stored in the database MUST use `TIMESTAMPTZ` and be normalized to UTC.
2. The UI MUST display UTC explicitly for all lifecycle events and anchor proofs to ensure global consistency.
3. **Jurisdiction Tags**:
   - Jurisdiction tags are informational metadata provided by the customer.
   - Arkova does NOT verify jurisdiction correctness.
   - The tag supports downstream compliance workflows and shared-responsibility documentation.
   - Engineering Decision: Treat jurisdiction as customer-asserted metadata. Do not build correctness validation beyond the specified format validation (`^[A-Z]{2}(-[A-Z0-9]{1,3})?$`).

## Section 7: Cryptographic Hashing Protocol

1.  **Client-side Hashing**: SHA-256 fingerprinting MUST occur entirely in the browser using native browser cryptography. No raw file bytes are ever transmitted over the network.
2. **UTC Inclusion**: EVERY anchor hash MUST include the ISO UTC creation timestamp as part of the hashed input.
3. **Uniqueness**: This ensures anchor uniqueness even for identical files anchored at different times.
4. **Verification**: Re-verification (public or private) MUST use the original `created_at` timestamp from the database record as the input to the hash function.
