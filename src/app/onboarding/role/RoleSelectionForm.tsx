"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./role.module.css";

type Role = "INDIVIDUAL" | "ORG_ADMIN";

export function RoleSelectionForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

    async function handleContinue() {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsSubmitting(false);
        router.push("/login");
        return;
      }

      // ORG_ADMIN requires org metadata, collected on the next screen.
      if (selected === "ORG_ADMIN") {
        setIsSubmitting(false);
        router.push("/onboarding/org");
        return;
      }

      // INDIVIDUAL onboarding — call the transactional function directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("complete_onboarding", {
        p_role: selected,
        p_org_legal_name: null,
        p_org_display_name: null,
        p_org_domain: null,
      });

      if (rpcError) {
        console.error("Onboarding RPC error:", rpcError);
        if (rpcError.message?.includes("Profile not found")) {
          setError("Profile not found. Please sign out and sign in again.");
        } else {
          setError(`Could not save: ${rpcError.message || "Unknown error"}`);
        }
        setIsSubmitting(false);
        return;
      }

        console.log("Onboarding completed:", rpcData);
        // Refresh router cache so middleware reads the updated profile
        router.refresh();
        router.push("/vault");
    } catch (err) {
      console.error("Unexpected onboarding error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <LogoutButton />
      </div>
      <div className={styles.card}>
        <h1 className={styles.title}>How will you use Arkova?</h1>
        <p className={styles.subtitle}>Choose the account type that best describes you.</p>

        <div className={styles.options}>
          <button
            type="button"
            className={`${styles.option} ${selected === "INDIVIDUAL" ? styles.selected : ""}`}
            onClick={() => setSelected("INDIVIDUAL")}
          >
            <span className={styles.optionTitle}>Individual</span>
            <span className={styles.optionDesc}>Anchor and verify your own documents</span>
          </button>

          <button
            type="button"
            className={`${styles.option} ${selected === "ORG_ADMIN" ? styles.selected : ""}`}
            onClick={() => setSelected("ORG_ADMIN")}
          >
            <span className={styles.optionTitle}>Organisation</span>
            <span className={styles.optionDesc}>Manage credentials across a team or company</span>
          </button>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!selected || isSubmitting}
          onClick={handleContinue}
          className={styles.continueButton}
        >
          {isSubmitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </main>
  );
}
