import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Anchor } from "@/types/database.types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;

  // ── Auth + role guard ────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role" | "org_id"> | null };

  if (!profile || profile.role !== "ORG_ADMIN" || !profile.org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Build query — all anchors for this org (no pagination) ───────────────
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("anchors")
    .select("id, file_name, file_fingerprint, status, created_at, org_id")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (status && ["PENDING", "SECURED", "REVOKED"].includes(status)) {
    query = query.eq("status", status);
  }
  if (search) {
    // Sanitize search input to prevent SQL injection
    const sanitized = search.replace(/[%_'"\\]/g, "");
    if (sanitized.length > 0) {
      query = query.or(`file_name.ilike.%${sanitized}%,id.ilike.${sanitized}%`);
    }
  }

  const { data: anchors, error } = await query as {
    data: Anchor[] | null;
    error: unknown;
  };

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json(anchors ?? []);
}
