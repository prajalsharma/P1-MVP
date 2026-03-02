"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./AuthForm.module.css";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupSchema = loginSchema.extend({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
});

type LoginInput = z.infer<typeof loginSchema>;

interface AuthFormProps {
  mode: "login" | "signup";
}


export function AuthForm({ mode }: AuthFormProps) {
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(mode === "login" ? loginSchema : signupSchema),
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setServerError(error.message);
        return;
      }
      setSuccess(true);
      return;
    }

    // Login
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    // Redirect to root — middleware will route based on profile state
    window.location.href = "/";
  }

  async function onGoogleOAuth() {
    setServerError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setServerError(error.message);
  }

  if (success) {
    return (
      <div className={styles.successBox}>
        <p className={styles.successHeading}>Check your email</p>
        <p className={styles.successBody}>
          We sent a confirmation link to your address. Open it to activate your
          account.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={styles.input}
          {...register("email")}
        />
        {errors.email && (
          <p className={styles.fieldError}>{errors.email.message}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={styles.input}
          {...register("password")}
        />
        {errors.password && (
          <p className={styles.fieldError}>{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className={styles.serverError} role="alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={styles.submitButton}
      >
        {isSubmitting
          ? "Please wait…"
          : mode === "login"
          ? "Sign in"
          : "Create account"}
      </button>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <button
        type="button"
        onClick={onGoogleOAuth}
        className={styles.oauthButton}
      >
        Continue with Google
      </button>
    </form>
  );
}
