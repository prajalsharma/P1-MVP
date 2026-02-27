import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./pending-review.module.css";

export const metadata = {
  title: "Pending review — Arkova",
};

export default async function PendingReviewPage() {
  const supabase = await createClient();

  // ── Auth guard (defense-in-depth, middleware also protects) ─────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <LogoutButton />
      </div>
      <div className={styles.card}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Under review
        </div>
        <h1 className={styles.title}>Your account is under review</h1>
        <p className={styles.body}>
          Thank you for registering your organisation. Our team is conducting a
          KYB (Know Your Business) review to verify your details.
        </p>
        <p className={styles.body}>
          This typically takes 1–2 business days. You will receive an email at
          the address you signed up with when your account is approved.
        </p>
        <p className={styles.note}>
          Questions? Contact{" "}
          <a href="mailto:support@arkova.io" className={styles.link}>
            support@arkova.io
          </a>
        </p>
      </div>
    </main>
  );
}
