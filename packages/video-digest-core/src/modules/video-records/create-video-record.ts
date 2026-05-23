import type {
  CreateVideoRecordInput,
  JobEventsRepository,
  UsageEventsRepository,
  VideoRecordRow,
  VideoRecordsRepository,
} from "@repo/database";
import type { RecordCreatorType, VideoRecordStatus } from "@repo/database";
import {
  type Actor,
  type CreateVideoDigestJobInput,
  createVideoDigestJobInputSchema,
} from "@repo/job-contracts";
import type { VideoDigestQueue } from "@repo/queue";

type CreateVideoRecordDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
  jobEventsRepository: JobEventsRepository;
  usageEventsRepository: UsageEventsRepository;
  videoDigestQueue: VideoDigestQueue;
};

export type CreateVideoRecordCommand = {
  actor: Actor;
  input: CreateVideoDigestJobInput;
};

export type CreateVideoRecordResult = {
  /** 最终返回的记录；可能是新建记录，也可能是复用的已有记录。 */
  record: VideoRecordRow;
  /** 本次调用是否真的创建并入队了新任务。 */
  created: boolean;
};

export async function createVideoRecord(
  dependencies: CreateVideoRecordDependencies,
  command: CreateVideoRecordCommand,
): Promise<CreateVideoRecordResult> {
  const input = createVideoDigestJobInputSchema.parse(command.input);
  const platform = resolvePlatform(input.url, input.platform);
  const normalizedUrl = normalizeVideoUrl(input.url);
  const existingRecord =
    await dependencies.videoRecordsRepository.findLatestByNormalizedUrlForUser({
      normalizedUrl,
      userId: command.actor.userId,
    });

  if (existingRecord && shouldReuseExistingRecord(existingRecord.status)) {
    return {
      created: false,
      record: existingRecord,
    };
  }

  const recordInput: CreateVideoRecordInput = {
    userId: command.actor.userId,
    sourceUrl: input.url,
    normalizedUrl,
    platform,
    outputMode: input.outputMode,
    fallbackToAudio: input.fallbackToAudio,
    sendEmail: input.sendEmail,
    createdByType: resolveCreatorType(command.actor),
    createdById: command.actor.id,
  };

  const record = await dependencies.videoRecordsRepository.create(recordInput);

  await dependencies.jobEventsRepository.create({
    recordId: record.id,
    userId: record.userId,
    status: "queued",
    message: "视频摘要任务已创建，等待后台处理。",
    metadata: {
      createdByType: record.createdByType,
      outputMode: record.outputMode,
      platform: record.platform,
    },
  });

  await dependencies.usageEventsRepository.create({
    userId: record.userId,
    recordId: record.id,
    eventType: "job_created",
    quantity: 1,
    unit: "count",
  });

  await dependencies.videoDigestQueue.enqueueVideoDigestJob({
    recordId: record.id,
    userId: record.userId,
  });

  return {
    created: true,
    record,
  };
}

function shouldReuseExistingRecord(status: VideoRecordStatus) {
  return status !== "cancelled" && status !== "failed";
}

function resolveCreatorType(actor: Actor): RecordCreatorType {
  if (actor.type === "agent") {
    return "mcp_agent";
  }

  if (actor.type === "system") {
    return "system";
  }

  return "web";
}

function resolvePlatform(
  url: string,
  requestedPlatform: "auto" | "youtube" | "bilibili",
) {
  if (requestedPlatform !== "auto") {
    return requestedPlatform;
  }

  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return "youtube";
  }

  if (hostname.includes("bilibili.com") || hostname.includes("b23.tv")) {
    return "bilibili";
  }

  throw new Error("Unsupported video platform.");
}

function normalizeVideoUrl(url: string) {
  const parsedUrl = new URL(url);
  parsedUrl.hash = "";
  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
  return parsedUrl.toString();
}
