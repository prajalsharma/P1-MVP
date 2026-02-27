"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./org.module.css";

const orgSchema = z.object({
  legal_name: z.string().min(1, "Legal name is required").max(255),
  display_name: z.string().min(1, "Display name is required").max(255),
  domain: z
    .string()
    .max(253)
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i,
      "Enter a valid domain (e.g. acme.com)"
    )
    .optional()
    .or(z.literal("")),
});

type OrgInput = z.infer<typeof orgSchema>;

export function OrgOnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrgInput>({
    resolver: zodResolver(orgSchema),
  });

  async function onSubmit(values: OrgInput) {
    setServerError(null);
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error } = await (supabase.rpc as any)("complete_onboarding", {
        p_role: "ORG_ADMIN",
        p_org_legal_name: values.legal_name,
        p_org_display_name: values.display_name,
        p_org_domain: values.domain || null,
      });

      if (error) {
        console.error("Org onboarding error:", error);
        if (error.message?.includes("already_set")) {
          setServerError("Your organisation has already been registered.");
        } else if (error.message?.includes("Profile not found")) {
          setServerError("Profile not found. Please sign out and sign in again.");
        } else {
          setServerError(`Could not save: ${error.message || "Unknown error"}`);
        }
        return;
      }

      console.log("Org onboarding completed:", rpcData);

      // Refresh Next.js router cache so the middleware re-reads the updated
      // profile (role + onboarding_completed_at) on the next navigation.
      router.refresh();

      if (rpcData?.requires_review) {
        router.push("/org/pending-review");
        return;
      }

      router.push("/vault");
    } catch (err) {
      console.error("Unexpected onboarding error:", err);
      setServerError("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <LogoutButton />
      </div>
      <div className={styles.card}>
        <h1 className={styles.title}>Register your organisation</h1>
        <p className={styles.subtitle}>Provide your organisation details to get started.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="legal_name" className={styles.label}>
              Legal name <span className={styles.required}>*</span>
            </label>
            <input
              id="legal_name"
              type="text"
              autoComplete="organization"
              className={styles.input}
              placeholder="Acme Corporation Ltd."
              {...register("legal_name")}
            />
            {errors.legal_name && <p className={styles.fieldError}>{errors.legal_name.message}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="display_name" className={styles.label}>
              Display name <span className={styles.required}>*</span>
            </label>
            <input
              id="display_name"
              type="text"
              className={styles.input}
              placeholder="Acme"
              {...register("display_name")}
            />
            {errors.display_name && <p className={styles.fieldError}>{errors.display_name.message}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="domain" className={styles.label}>
              Domain <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="domain"
              type="text"
              className={styles.input}
              placeholder="acme.com"
              {...register("domain")}
            />
            {errors.domain && <p className={styles.fieldError}>{errors.domain.message}</p>}
            <p className={styles.hint}>Used to verify employee email addresses.</p>
          </div>

          {serverError && (
            <p className={styles.serverError} role="alert">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
            {isSubmitting ? "Submitting…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
