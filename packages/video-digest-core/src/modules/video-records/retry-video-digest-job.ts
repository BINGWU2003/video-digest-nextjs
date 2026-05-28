import type {
  JobEventsRepository,
  VideoRecordRow,
  VideoRecordsRepository,
} from "@video-digest-nextjs/database";
import type { VideoRecordStatus } from "@video-digest-nextjs/database";
import type { VideoDigestQueue } from "@video-digest-nextjs/queue";

type RetryVideoDigestJobDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
  jobEventsRepository: JobEventsRepository;
  videoDigestQueue: VideoDigestQueue;
  now?: () => Date;
};

export type RetryVideoDigestJobCommand = {
  recordId: string;
  userId: string;
};

export type RetryVideoDigestJobResult = {
  retried: boolean;
  enqueued: boolean;
  record: VideoRecordRow | null;
};

export async function retryVideoDigestJob(
  dependencies: RetryVideoDigestJobDependencies,
  command: RetryVideoDigestJobCommand,
): Promise<RetryVideoDigestJobResult> {
  const record = await dependencies.videoRecordsRepository.findByIdForUser({
    id: command.recordId,
    userId: command.userId,
  });

  if (!record || !isRetryableStatus(record.status)) {
    return {
      enqueued: false,
      record,
      retried: false,
    };
  }

  const queuedRecord =
    await dependencies.videoRecordsRepository.updateStatusForUser({
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      expectedStatus: record.status,
      id: record.id,
      status: "queued",
      userId: command.userId,
    });

  const retryQueuedAt = dependencies.now?.() ?? new Date();

  try {
    await dependencies.jobEventsRepository.create({
      message: "用户重新处理任务，等待后台处理。",
      metadata: {
        previousErrorCode: record.errorCode,
        previousStatus: record.status,
        retriedAt: retryQueuedAt.toISOString(),
      },
      recordId: record.id,
      status: "queued",
      userId: command.userId,
    });

    await dependencies.videoDigestQueue.enqueueVideoDigestJob(
      {
        recordId: record.id,
        userId: command.userId,
      },
      {
        queueJobId: `${record.id}-retry-${retryQueuedAt.getTime()}`,
      },
    );

    return {
      enqueued: true,
      record: queuedRecord,
      retried: true,
    };
  } catch (caught) {
    const failedRecord =
      await dependencies.videoRecordsRepository.updateStatusForUser({
        completedAt: dependencies.now?.() ?? new Date(),
        errorCode: "retry_enqueue_failed",
        errorMessage:
          caught instanceof Error ? caught.message : "重试任务入队失败。",
        expectedStatus: "queued",
        id: record.id,
        status: "failed",
        userId: command.userId,
      });

    await dependencies.jobEventsRepository.create({
      message: caught instanceof Error ? caught.message : "重试任务入队失败。",
      metadata: {
        previousErrorCode: record.errorCode,
        previousStatus: record.status,
      },
      recordId: record.id,
      status: "failed",
      userId: command.userId,
    });

    return {
      enqueued: false,
      record: failedRecord,
      retried: true,
    };
  }
}

export function isRetryableStatus(
  status: VideoRecordStatus,
): status is "cancelled" | "completed" | "failed" {
  return status === "cancelled" || status === "completed" || status === "failed";
}
