/**
 * P6-S1: Public Verification Page
 *
 * Zero-friction verification landing page for third parties.
 * No authentication required.
 * Answers: Is the record valid and when was it anchored?
 */

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { VerificationClient } from "./VerificationClient";
import type { PublicVerificationResult } from "@/types/database.types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ public_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { public_id } = await params;
  return {
    title: `Verify ${public_id.slice(0, 8)}… — Arkova`,
    description: "Verify the authenticity of an anchored document on Arkova.",
  };
}

export default async function PublicVerificationPage({ params }: PageProps) {
  const { public_id } = await params;

  // Validate public_id format (32 hex chars)
  if (!/^[a-f0-9]{32}$/i.test(public_id)) {
    notFound();
  }

  const supabase = await createClient();

  // Call the public verification function (no auth required)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_public_verification", {
    p_public_id: public_id,
  }) as { data: PublicVerificationResult | null; error: unknown };

  if (error || !data || !data.found) {
    notFound();
  }

  return <VerificationClient data={data} />;
}
