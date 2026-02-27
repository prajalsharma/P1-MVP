"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { inviteMember } from "@/lib/org/inviteMember";
import styles from "./InviteMemberModal.module.css";

interface InviteMemberModalProps {
  onClose: () => void;
}

type InviteState = "idle" | "loading" | "success" | "error";

export function InviteMemberModal({ onClose }: InviteMemberModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [inviteState, setInviteState] = useState<InviteState>("idle");
  const [resultMessage, setResultMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  // Handle Escape key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && inviteState !== "loading") {
        onClose();
      }
    },
    [onClose, inviteState]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    setInviteState("loading");
    setResultMessage("");

    startTransition(async () => {
      const result = await inviteMember(email);

      if (result.success) {
        setInviteState("success");
        setResultMessage(
          result.linked
            ? `${email} has been linked to your organisation.`
            : `Invitation sent to ${email}. They will be prompted to complete onboarding.`
        );
        setEmailInput("");
      } else {
        setInviteState("error");
        setResultMessage(result.error ?? "Failed to invite member.");
      }
    });
  }

  function handleReset() {
    setInviteState("idle");
    setResultMessage("");
    setEmailInput("");
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id="invite-modal-title" className={styles.title}>
            Invite member
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {inviteState === "success" ? (
            <div className={styles.successState}>
              <div className={styles.successIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M7.5 12l3 3 6-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className={styles.successMessage}>{resultMessage}</p>
              <div className={styles.successActions}>
                <button type="button" className={styles.inviteAnotherBtn} onClick={handleReset}>
                  Invite another
                </button>
                <button type="button" className={styles.doneBtn} onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <p className={styles.desc}>
                Enter a member&rsquo;s email address to invite them to your organisation. If they
                already have an Arkova account without a role, they will be linked immediately.
              </p>

              <label htmlFor="invite-email" className={styles.label}>
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                className={styles.input}
                placeholder="member@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                disabled={inviteState === "loading" || isPending}
                autoComplete="off"
              />

              {inviteState === "error" && (
                <p className={styles.errorMsg} role="alert">
                  {resultMessage}
                </p>
              )}

              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                  disabled={inviteState === "loading"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={inviteState === "loading" || isPending || !emailInput.trim()}
                >
                  {inviteState === "loading" ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
