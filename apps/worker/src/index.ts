import {
  createSupabaseJobEventsRepository,
  createSupabaseVideoRecordsRepository,
  type JobEventsRepository,
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
  createBilibiliVideoMetadataProvider,
  createVideoMetadataProviderRegistry,
  createYoutubeVideoMetadataProvider,
  fetchVideoMetadata,
  persistVideoMetadata,
  type VideoMetadataProviderRegistry,
} from "@repo/video-digest-core";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnvFile } from "dotenv";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";

loadWorkerEnv();

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
  const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
  const metadataProviderRegistry = createVideoMetadataProviderRegistry([
    createYoutubeVideoMetadataProvider(),
    createBilibiliVideoMetadataProvider(),
  ]);

  const worker = createBullMqVideoDigestWorker({
    redisUrl: config.redisUrl,
    async processor(payload, context) {
      await processVideoDigestJob(
        {
          jobEventsRepository,
          metadataProviderRegistry,
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
  videoRecordsRepository: VideoRecordsRepository;
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

    await persistVideoMetadata(dependencies, {
      metadata,
      recordId: record.id,
      userId: record.userId,
    });
  } catch (caught) {
    await markVideoDigestJobFailed(dependencies, payload, context, caught);
    throw caught;
  }
}

async function markVideoDigestJobFailed(
  dependencies: ProcessVideoDigestJobDependencies,
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
  caught: unknown,
) {
  const errorMessage = toErrorMessage(caught);

  try {
    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: payload.recordId,
      userId: payload.userId,
      status: "failed",
      errorCode: "worker_processing_failed",
      errorMessage,
      completedAt: new Date(),
    });

    await dependencies.jobEventsRepository.create({
      recordId: payload.recordId,
      userId: payload.userId,
      status: "failed",
      message: errorMessage,
      metadata: {
        attemptsMade: context.attemptsMade,
        errorCode: "worker_processing_failed",
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
