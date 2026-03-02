/**
 * RLS test helpers for Arkova.
 *
 * Provides:
 *  - withUser(email, role): runs a callback as a specific user identity
 *  - anonClient(): returns a Supabase client with no auth (anonymous)
 *  - adminClient(): returns a service-role client that bypasses RLS
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import type { UserRole } from "../../types/database.types";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export type RlsClient = SupabaseClient<Database>;

/**
 * Returns a Supabase client with no authentication token.
 * Simulates an anonymous / unauthenticated user.
 */
export function anonClient(): RlsClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns a Supabase client using the service role key.
 * Bypasses all RLS policies — use only for seed/teardown helpers.
 */
export function adminClient(): RlsClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface UserContext {
  client: RlsClient;
  userId: string;
  email: string;
  role: UserRole | null;
}

/**
 * withUser(email, role, callback)
 *
 * Creates a test user via admin API, signs in, runs the callback with the
 * authenticated client, then deletes the test user.
 *
 * Example:
 *   await withUser("alice@test.com", "INDIVIDUAL", async ({ client, userId }) => {
 *     const { data, error } = await client.from("profiles").select("*");
 *     expect(error).toBeNull();
 *   });
 */
export async function withUser<T>(
  email: string,
  role: UserRole | null,
  callback: (ctx: UserContext) => Promise<T>
): Promise<T> {
  const admin = adminClient();
  const password = `test-pw-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Create the user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`withUser: failed to create user ${email}: ${createErr?.message}`);
  }
  const userId = created.user.id;

    // Optionally set the role in the profiles table (requires profile row to exist)
    if (role !== null) {
      // Use `as any` because ProfileInsert accepts id+email+role but the
      // generated DB type exposes Update as a restricted partial.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("profiles") as any).upsert({
        id: userId,
        email: email.toLowerCase().trim(),
        role,
      });
    }

  // Sign in as the user
  const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`withUser: failed to sign in as ${email}: ${signInErr.message}`);
  }

  try {
    return await callback({ client: userClient, userId, email, role });
  } finally {
    // Cleanup
    await admin.auth.admin.deleteUser(userId);
  }
}

/**
 * expectRlsDenied(promise)
 *
 * Asserts that the given Supabase query is either blocked (error) or returns
 * empty results — both are acceptable evidence of RLS enforcement.
 */
export async function expectRlsDenied(
  promise: Promise<{ data: unknown; error: unknown }>
): Promise<void> {
  const { data, error } = await promise;
  const isEmpty =
    data === null ||
    data === undefined ||
    (Array.isArray(data) && data.length === 0);

  if (!isEmpty && !error) {
    throw new Error(
      `RLS violation: expected empty/denied result but got data: ${JSON.stringify(data)}`
    );
  }
}
