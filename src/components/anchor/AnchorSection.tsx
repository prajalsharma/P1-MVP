"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/anchor/FileDropzone";
import { ConfirmAnchorModal } from "@/components/anchor/ConfirmAnchorModal";
import type { FileFingerprint } from "@/lib/fileHasher";

export function AnchorSection() {
  const router = useRouter();
  const [pending, setPending] = useState<FileFingerprint | null>(null);

  function handleFingerprinted(result: FileFingerprint) {
    setPending(result);
  }

  function handleSuccess(anchorId: string) {
    setPending(null);
    router.push(`/anchors/${anchorId}`);
  }

  function handleCancel() {
    setPending(null);
  }

  return (
    <>
      <FileDropzone onFingerprinted={handleFingerprinted} />
      {pending && (
        <ConfirmAnchorModal
          data={pending}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
