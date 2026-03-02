import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import styles from "./login.module.css";

export const metadata = {
  title: "Sign in — Arkova",
};

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "Sign-in failed. Please try again.",
  missing_code: "Sign-in link was invalid. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "An error occurred. Please try again.") : null;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkDot} />
          <span className={styles.wordmarkText}>Arkova</span>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Welcome back</p>
        {errorMessage && (
          <p className={styles.errorBanner} role="alert">
            {errorMessage}
          </p>
        )}
        <AuthForm mode="login" />
        <p className={styles.switchLink}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className={styles.link}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
