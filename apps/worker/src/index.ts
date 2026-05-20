import { createSupabaseJobEventsRepository } from "@repo/database";
import {
  createBullMqVideoDigestWorker,
  videoDigestJobName,
  videoDigestQueueName,
  type VideoDigestWorkerHandle,
} from "@repo/queue";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

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
    },
  );

  const jobEventsRepository = createSupabaseJobEventsRepository(supabase);

  const worker = createBullMqVideoDigestWorker({
    redisUrl: config.redisUrl,
    async processor(payload, context) {
      await jobEventsRepository.create({
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
