import {
  createSupabaseDeliveryRecordsRepository,
  createSupabaseEmailAddressesRepository,
  createSupabaseJobEventsRepository,
  createSupabaseSummariesRepository,
  createSupabaseTranscriptsRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
} from "@repo/database";
import {
  createBullMqVideoDigestWorker,
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
} from "@repo/video-digest-core";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnvFile } from "dotenv";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import WebSocket from "ws";

import { createResendEmailDeliveryProvider } from "./email-delivery.js";
import { processVideoDigestJob } from "./process-video-digest-job.js";

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

  const deliveryRecordsRepository = createSupabaseDeliveryRecordsRepository(supabase);
  const emailAddressesRepository = createSupabaseEmailAddressesRepository(supabase);
  const jobEventsRepository = createSupabaseJobEventsRepository(supabase);
  const summariesRepository = createSupabaseSummariesRepository(supabase);
  const transcriptsRepository = createSupabaseTranscriptsRepository(supabase);
  const usageEventsRepository = createSupabaseUsageEventsRepository(supabase);
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
  const emailDeliveryProvider = createResendEmailDeliveryProvider({
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  });

  const worker = createBullMqVideoDigestWorker({
    redisUrl: config.redisUrl,
    async processor(payload, context) {
      await processVideoDigestJob(
        {
          deliveryRecordsRepository,
          emailAddressesRepository,
          emailDeliveryProvider,
          jobEventsRepository,
          metadataProviderRegistry,
          summariesRepository,
          summaryProvider,
          transcriptProviderRegistry,
          transcriptsRepository,
          usageEventsRepository,
          videoRecordsRepository,
          webAppUrl: process.env.WEB_APP_URL,
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
