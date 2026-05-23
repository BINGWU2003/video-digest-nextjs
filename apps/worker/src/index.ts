import {
  createSupabaseJobEventsRepository,
  createSupabaseSummariesRepository,
  createSupabaseTranscriptsRepository,
  createSupabaseVideoRecordsRepository,
  type JobEventsRepository,
  type SummariesRepository,
  type TranscriptsRepository,
  type VideoRecordsRepository,
} from "@repo/database";
import {
  createBullMqVideoDigestWorker,
  type VideoDigestQueuePayload,
  type VideoDigestWorkerContext,
  videoDigestJobName,
  videoDigestQueueName,
  type VideoDigestWorkerHandle,
} from "@repo/queue";
import {
  createBilibiliTranscriptProvider,
  createBilibiliVideoMetadataProvider,
  createOpenAICompatibleSummaryProvider,
  createTranscriptProviderRegistry,
  createVideoMetadataProviderRegistry,
  createYoutubeTranscriptProvider,
  createYoutubeVideoMetadataProvider,
  generateSummary,
  fetchTranscript,
  fetchVideoMetadata,
  persistSummary,
  persistTranscript,
  persistVideoMetadata,
  SummaryGenerationError,
  type SummaryProvider,
  TranscriptFetchError,
  TranscriptNotFoundError,
  TranscriptProviderUnavailableError,
  type TranscriptProviderRegistry,
  VideoMetadataFetchError,
  VideoMetadataProviderUnavailableError,
  type VideoMetadataProviderRegistry,
} from "@repo/video-digest-core";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnvFile } from "dotenv";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import WebSocket from "ws";

loadWorkerEnv();
configureLocalProxy();

type SupabaseClientOptions = NonNullable<Parameters<typeof createClient>[2]>;
type RealtimeTransport = NonNullable<
  NonNullable<SupabaseClientOptions["realtime"]>["transport"]
>;

const websocketTransport = WebSocket as unknown as RealtimeTransport;

type WorkerConfig = {
  redisUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

export function startWorker(config = readWorkerConfig()): VideoDigestWorkerHandle {
  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: websocketTransport,
      },
    },
  );

  const jobEventsRepository = createSupabaseJobEventsRepository(supabase);
  const summariesRepository = createSupabaseSummariesRepository(supabase);
  const transcriptsRepository = createSupabaseTranscriptsRepository(supabase);
  const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
  const metadataProviderRegistry = createVideoMetadataProviderRegistry([
    createYoutubeVideoMetadataProvider(),
    createBilibiliVideoMetadataProvider(),
  ]);
  const transcriptProviderRegistry = createTranscriptProviderRegistry([
    createYoutubeTranscriptProvider(),
    createBilibiliTranscriptProvider(),
  ]);
  const summaryProvider = createOpenAICompatibleSummaryProvider();

  const worker = createBullMqVideoDigestWorker({
    redisUrl: config.redisUrl,
    async processor(payload, context) {
      await processVideoDigestJob(
        {
          jobEventsRepository,
          metadataProviderRegistry,
          summariesRepository,
          summaryProvider,
          transcriptProviderRegistry,
          transcriptsRepository,
          videoRecordsRepository,
        },
        payload,
        context,
      );
    },
  });

  console.log(
    `Worker listening on queue: ${worker.queueName}, job: ${worker.jobName}`,
  );

  return worker;
}

type ProcessVideoDigestJobDependencies = {
  jobEventsRepository: JobEventsRepository;
  metadataProviderRegistry: VideoMetadataProviderRegistry;
  summariesRepository: SummariesRepository;
  summaryProvider: SummaryProvider;
  transcriptProviderRegistry: TranscriptProviderRegistry;
  transcriptsRepository: TranscriptsRepository;
  videoRecordsRepository: VideoRecordsRepository;
};

type VideoDigestJobFailureCode =
  | "metadata_fetch_failed"
  | "provider_unavailable"
  | "summary_generation_failed"
  | "transcript_fetch_failed"
  | "transcript_not_found"
  | "worker_processing_failed";

type VideoDigestJobFailure = {
  code: VideoDigestJobFailureCode;
  message: string;
  name: string | null;
};

async function processVideoDigestJob(
  dependencies: ProcessVideoDigestJobDependencies,
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
) {
  try {
    const record = await dependencies.videoRecordsRepository.updateStatusForUser({
      id: payload.recordId,
      userId: payload.userId,
      status: "fetching_metadata",
      expectedStatus: "queued",
      errorCode: null,
      errorMessage: null,
      completedAt: null,
    });

    await dependencies.jobEventsRepository.create({
      recordId: payload.recordId,
      userId: payload.userId,
      status: "fetching_metadata",
      message: "Worker 已接收视频摘要任务，开始准备读取视频元数据。",
      metadata: {
        attemptsMade: context.attemptsMade,
        queueJobId: context.queueJobId,
      },
    });

    console.log(
      `Accepted video digest job ${context.queueJobId ?? payload.recordId}`,
    );

    const metadata = await fetchVideoMetadata(
      {
        providerRegistry: dependencies.metadataProviderRegistry,
      },
      {
        platform: record.platform,
        sourceUrl: record.sourceUrl,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    await persistVideoMetadata(dependencies, {
      metadata,
      recordId: record.id,
      userId: record.userId,
    });

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: "extracting_transcript",
      expectedStatus: "fetching_metadata",
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: "extracting_transcript",
      message: "视频元数据已写回，开始准备提取字幕。",
      metadata: {
        attemptsMade: context.attemptsMade,
        queueJobId: context.queueJobId,
      },
    });

    const transcript = await fetchTranscript(
      {
        providerRegistry: dependencies.transcriptProviderRegistry,
      },
      {
        fallbackToAudio: record.fallbackToAudio,
        platform: record.platform,
        sourceUrl: record.sourceUrl,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const transcriptResult = await persistTranscript(dependencies, {
      recordId: record.id,
      transcript,
      userId: record.userId,
    });

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    if (record.outputMode === "transcript") {
      await dependencies.videoRecordsRepository.updateStatusForUser({
        id: record.id,
        userId: record.userId,
        status: "completed",
        expectedStatus: "extracting_transcript",
        completedAt: new Date(),
      });

      await dependencies.jobEventsRepository.create({
        recordId: record.id,
        userId: record.userId,
        status: "completed",
        message: "字幕已提取完成，任务已完成。",
        metadata: {
          attemptsMade: context.attemptsMade,
          language: transcript.language,
          queueJobId: context.queueJobId,
          segmentCount: transcriptResult.segments.length,
          source: transcript.source,
          transcriptId: transcriptResult.transcript.id,
        },
      });

      return;
    }

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: "summarizing",
      expectedStatus: "extracting_transcript",
      completedAt: null,
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: "summarizing",
      message: "字幕已提取完成，开始生成摘要。",
      metadata: {
        attemptsMade: context.attemptsMade,
        language: transcript.language,
        queueJobId: context.queueJobId,
        segmentCount: transcriptResult.segments.length,
        source: transcript.source,
        transcriptId: transcriptResult.transcript.id,
      },
    });

    const summary = await generateSummary(
      {
        summaryProvider: dependencies.summaryProvider,
      },
      {
        format:
          record.outputMode === "summary_and_email" ? "email_digest" : "brief",
        plainText: transcript.plainText,
        segments: transcript.segments,
        sourceUrl: record.sourceUrl,
        transcriptLanguage: transcript.language,
        videoAuthor: record.author,
        videoTitle: record.title,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const summaryResult = await persistSummary(dependencies, {
      recordId: record.id,
      summary,
      userId: record.userId,
    });

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const finalStatus = record.sendEmail ? "delivering" : "completed";

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: finalStatus,
      expectedStatus: "summarizing",
      completedAt: finalStatus === "completed" ? new Date() : null,
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: finalStatus,
      message:
        finalStatus === "completed"
          ? "摘要已生成，任务已完成。"
          : "摘要已生成，等待邮件投递模块处理。",
      metadata: {
        attemptsMade: context.attemptsMade,
        model: summary.model,
        promptVersion: summary.promptVersion,
        queueJobId: context.queueJobId,
        summaryId: summaryResult.id,
      },
    });
  } catch (caught) {
    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    await markVideoDigestJobFailed(dependencies, payload, context, caught);
  }
}

async function isVideoDigestJobCancelled(
  dependencies: Pick<ProcessVideoDigestJobDependencies, "videoRecordsRepository">,
  payload: VideoDigestQueuePayload,
) {
  const record = await dependencies.videoRecordsRepository.findByIdForUser({
    id: payload.recordId,
    userId: payload.userId,
  });

  return record?.status === "cancelled";
}

async function markVideoDigestJobFailed(
  dependencies: ProcessVideoDigestJobDependencies,
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
  caught: unknown,
) {
  const failure = resolveVideoDigestJobFailure(caught);

  try {
    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: payload.recordId,
      userId: payload.userId,
      status: "failed",
      errorCode: failure.code,
      errorMessage: failure.message,
      completedAt: new Date(),
    });

    await dependencies.jobEventsRepository.create({
      recordId: payload.recordId,
      userId: payload.userId,
      status: "failed",
      message: failure.message,
      metadata: {
        attemptsMade: context.attemptsMade,
        errorCode: failure.code,
        errorName: failure.name,
        queueJobId: context.queueJobId,
      },
    });
  } catch (failureUpdateError) {
    console.error(
      "Failed to persist video digest job failure state.",
      failureUpdateError,
    );
  }
}

function resolveVideoDigestJobFailure(caught: unknown): VideoDigestJobFailure {
  const message = toErrorMessage(caught);
  const name = caught instanceof Error ? caught.name : null;

  if (
    caught instanceof VideoMetadataProviderUnavailableError ||
    caught instanceof TranscriptProviderUnavailableError
  ) {
    return {
      code: "provider_unavailable",
      message,
      name,
    };
  }

  if (caught instanceof VideoMetadataFetchError) {
    return {
      code: "metadata_fetch_failed",
      message,
      name,
    };
  }

  if (caught instanceof TranscriptNotFoundError) {
    return {
      code: "transcript_not_found",
      message,
      name,
    };
  }

  if (caught instanceof TranscriptFetchError) {
    return {
      code: "transcript_fetch_failed",
      message,
      name,
    };
  }

  if (caught instanceof SummaryGenerationError) {
    return {
      code: "summary_generation_failed",
      message,
      name,
    };
  }

  return {
    code: "worker_processing_failed",
    message,
    name,
  };
}

function toErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function readWorkerConfig(): WorkerConfig {
  const redisUrl = process.env.REDIS_URL;
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    ["REDIS_URL", redisUrl],
    ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Worker 缺少环境变量：${missing.join(", ")}`);
  }

  return {
    redisUrl: redisUrl!,
    supabaseUrl: supabaseUrl!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
  };
}

function loadWorkerEnv() {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const appDirectory =
    currentDirectory.endsWith(`${sep}src`) ||
    currentDirectory.endsWith(`${sep}dist`)
      ? resolve(currentDirectory, "..")
      : currentDirectory;

  for (const envFileName of [".env.local", "env.local"]) {
    loadEnvFile({
      path: resolve(appDirectory, envFileName),
      quiet: true,
    });
  }
}

function configureLocalProxy() {
  const proxyUrl = process.env.LOCAL_PROXY_URL;

  if (!proxyUrl) {
    return;
  }

  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`Worker fetch proxy enabled: ${proxyUrl}`);
}

if (isEntryPoint()) {
  try {
    const worker = startWorker();

    process.once("SIGINT", () => {
      void closeWorker(worker, "SIGINT");
    });

    process.once("SIGTERM", () => {
      void closeWorker(worker, "SIGTERM");
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(message);
    process.exitCode = 1;
  }
}

function isEntryPoint() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

async function closeWorker(worker: VideoDigestWorkerHandle, signal: string) {
  console.log(`Worker received ${signal}, closing...`);
  await worker.close();
  process.exitCode = 0;
}

export { videoDigestJobName, videoDigestQueueName };
