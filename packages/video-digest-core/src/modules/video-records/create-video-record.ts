import type { CreateVideoRecordInput, VideoRecordsRepository } from "@repo/database";
import type { RecordCreatorType } from "@repo/database";
import {
  type Actor,
  type CreateVideoDigestJobInput,
  createVideoDigestJobInputSchema,
} from "@repo/job-contracts";

type CreateVideoRecordDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
};

export type CreateVideoRecordCommand = {
  actor: Actor;
  input: CreateVideoDigestJobInput;
};

export async function createVideoRecord(
  dependencies: CreateVideoRecordDependencies,
  command: CreateVideoRecordCommand,
) {
  const input = createVideoDigestJobInputSchema.parse(command.input);
  const platform = resolvePlatform(input.url, input.platform);

  const recordInput: CreateVideoRecordInput = {
    userId: command.actor.userId,
    sourceUrl: input.url,
    normalizedUrl: normalizeVideoUrl(input.url),
    platform,
    outputMode: input.outputMode,
    fallbackToAudio: input.fallbackToAudio,
    sendEmail: input.sendEmail,
    createdByType: resolveCreatorType(command.actor),
    createdById: command.actor.id,
  };

  return dependencies.videoRecordsRepository.create(recordInput);
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
