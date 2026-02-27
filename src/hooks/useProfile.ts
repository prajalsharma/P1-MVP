"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database.types";

export interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateIsPublic: (value: boolean) => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setError("Not authenticated");
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setProfile(data as Profile | null);
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateIsPublic = useCallback(async (value: boolean) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ is_public: value })
      .eq("id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    setProfile((prev) => (prev ? { ...prev, is_public: value } : prev));
  }, []);

  return { profile, loading, error, updateIsPublic };
}
