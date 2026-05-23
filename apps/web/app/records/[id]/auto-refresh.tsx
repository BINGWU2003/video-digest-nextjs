"use client";

import type { VideoRecordStatus } from "@repo/database";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const activeStatuses: VideoRecordStatus[] = [
  "queued",
  "fetching_metadata",
  "extracting_transcript",
  "extracting_audio",
  "transcribing_audio",
  "summarizing",
  "delivering",
];

export function RecordAutoRefresh({
  intervalMs = 4_000,
  status,
}: {
  intervalMs?: number;
  status: VideoRecordStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!activeStatuses.includes(status)) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [intervalMs, router, status]);

  return null;
}
