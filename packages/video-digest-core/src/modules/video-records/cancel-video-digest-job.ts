import type {
  JobEventsRepository,
  VideoRecordRow,
  VideoRecordsRepository,
} from "@video-digest-nextjs/database";
import type { VideoRecordStatus } from "@video-digest-nextjs/database";

type CancelVideoDigestJobDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
  jobEventsRepository: JobEventsRepository;
  now?: () => Date;
  onJobEventCreateError?: (error: unknown) => void;
};

export type CancelVideoDigestJobCommand = {
  recordId: string;
  userId: string;
};

export type CancelVideoDigestJobResult = {
  cancelled: boolean;
  record: VideoRecordRow | null;
};

export async function cancelVideoDigestJob(
  dependencies: CancelVideoDigestJobDependencies,
  command: CancelVideoDigestJobCommand,
): Promise<CancelVideoDigestJobResult> {
  const record = await dependencies.videoRecordsRepository.findByIdForUser({
    id: command.recordId,
    userId: command.userId,
  });

  if (!record || !isCancellableStatus(record.status)) {
    return {
      cancelled: false,
      record,
    };
  }

  const cancelledAt = dependencies.now?.() ?? new Date();
  const cancelledRecord =
    await dependencies.videoRecordsRepository.updateStatusForUser({
      completedAt: cancelledAt,
      errorCode: null,
      errorMessage: null,
      expectedStatus: record.status,
      id: record.id,
      status: "cancelled",
      userId: command.userId,
    });

  try {
    await dependencies.jobEventsRepository.create({
      message: "用户取消任务，后续 worker 阶段会停止处理。",
      metadata: {
        cancelledAt: cancelledAt.toISOString(),
        previousStatus: record.status,
      },
      recordId: record.id,
      status: "cancelled",
      userId: command.userId,
    });
  } catch (eventCreateError) {
    dependencies.onJobEventCreateError?.(eventCreateError);
  }

  return {
    cancelled: true,
    record: cancelledRecord,
  };
}

export function isCancellableStatus(
  status: VideoRecordStatus,
): status is
  | "delivering"
  | "extracting_audio"
  | "extracting_transcript"
  | "fetching_metadata"
  | "queued"
  | "summarizing"
  | "transcribing_audio" {
  return (
    status === "queued" ||
    status === "fetching_metadata" ||
    status === "extracting_transcript" ||
    status === "extracting_audio" ||
    status === "transcribing_audio" ||
    status === "summarizing" ||
    status === "delivering"
  );
}
