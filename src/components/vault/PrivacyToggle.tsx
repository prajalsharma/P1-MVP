"use client";

import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import styles from "./PrivacyToggle.module.css";

export function PrivacyToggle() {
  const { profile, loading, updateIsPublic } = useProfile();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading || !profile) return null;

  const isPublic = profile.is_public;

  async function handleToggle() {
    const next = !isPublic;

    // Optimistic update handled inside useProfile — updateIsPublic sets state before awaiting
    setSaving(true);
    setSaveError(null);
    try {
      await updateIsPublic(next);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>
        <span className={styles.labelText}>Profile visibility</span>
        <span className={styles.labelSub}>
          {isPublic
            ? "Your profile is visible to verified organizations."
            : "Your profile is private. Only you can see it."}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        aria-label={isPublic ? "Set profile to private" : "Set profile to public"}
        disabled={saving}
        onClick={handleToggle}
        className={styles.toggle}
        data-checked={isPublic}
      >
        <span className={styles.toggleThumb} />
      </button>

      {saveError && (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
