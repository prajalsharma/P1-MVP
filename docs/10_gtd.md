# Global Technical Directive (GTD)

## Section 6: UTC Time + Evidence Semantics

1. All timestamps stored in the database MUST use `TIMESTAMPTZ` and be normalized to UTC.
2. The UI MUST display UTC explicitly for all lifecycle events and anchor proofs to ensure global consistency.
3. **Jurisdiction Tags**:
   - Jurisdiction tags are informational metadata provided by the customer.
   - Arkova does NOT verify jurisdiction correctness.
   - The tag supports downstream compliance workflows and shared-responsibility documentation.
   - Engineering Decision: Treat jurisdiction as customer-asserted metadata. Do not build correctness validation beyond the specified format validation (`^[A-Z]{2}(-[A-Z0-9]{1,3})?$`).
