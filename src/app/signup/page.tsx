import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import styles from "./signup.module.css";

export const metadata = {
  title: "Create account — Arkova",
};

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkDot} />
          <span className={styles.wordmarkText}>Arkova</span>
        </div>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Start anchoring documents securely</p>
        <AuthForm mode="signup" />
        <p className={styles.switchLink}>
          Already have an account?{" "}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
