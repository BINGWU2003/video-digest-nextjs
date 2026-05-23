import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

export const videoDigestQueueName = "video-digest";
export const videoDigestJobName = "process-video-digest";

export type VideoDigestQueuePayload = {
  /** 需要后台处理的视频记录 ID。 */
  recordId: string;
  /** 任务所属用户 ID，worker 用它校验数据归属和写回边界。 */
  userId: string;
};

export type EnqueuedVideoDigestJob = {
  /** 队列名称，后续 BullMQ 实现会使用同一个名称。 */
  queueName: typeof videoDigestQueueName;
  /** 队列中的 job 名称，用于区分后续可能增加的任务类型。 */
  jobName: typeof videoDigestJobName;
  /** 队列系统返回的 job ID；no-op 实现为空。 */
  queueJobId: string | null;
  /** 已投递给队列的任务 payload。 */
  payload: VideoDigestQueuePayload;
};

export type EnqueueVideoDigestJobOptions = {
  /** BullMQ job ID，用于重试时避开旧失败 job 的 ID 冲突。 */
  queueJobId?: string;
};

export type VideoDigestQueue = {
  /** 投递一个视频摘要后台处理任务。 */
  enqueueVideoDigestJob(
    payload: VideoDigestQueuePayload,
    options?: EnqueueVideoDigestJobOptions,
  ): Promise<EnqueuedVideoDigestJob>;
};

export type BullMqVideoDigestQueueOptions = {
  /** Redis 连接地址，例如 redis://localhost:6379。 */
  redisUrl: string;
};

export type VideoDigestWorkerContext = {
  /** BullMQ 返回的 job ID。 */
  queueJobId: string | null;
  /** 当前 job 已经尝试执行的次数。 */
  attemptsMade: number;
};

export type VideoDigestJobProcessor = (
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
) => Promise<void>;

export type VideoDigestWorkerHandle = {
  /** 正在监听的队列名称。 */
  queueName: typeof videoDigestQueueName;
  /** 正在消费的 job 名称。 */
  jobName: typeof videoDigestJobName;
  /** 关闭 worker 和 Redis 连接。 */
  close(): Promise<void>;
};

export type BullMqVideoDigestWorkerOptions = {
  /** Redis 连接地址，例如 redis://localhost:6379。 */
  redisUrl: string;
  /** 单个 worker 进程内并发处理的 job 数。 */
  concurrency?: number;
  /** 实际处理视频摘要 job 的回调。 */
  processor: VideoDigestJobProcessor;
};

export function createNoopVideoDigestQueue(): VideoDigestQueue {
  return {
    async enqueueVideoDigestJob(payload, options) {
      return {
        queueName: videoDigestQueueName,
        jobName: videoDigestJobName,
        queueJobId: options?.queueJobId ?? null,
        payload,
      };
    },
  };
}

export function createBullMqVideoDigestQueue(
  options: BullMqVideoDigestQueueOptions,
): VideoDigestQueue {
  const connection = new Redis(options.redisUrl);
  const queue = new Queue<VideoDigestQueuePayload>(videoDigestQueueName, {
    connection,
  });

  return {
    async enqueueVideoDigestJob(payload, options) {
      const job = await queue.add(videoDigestJobName, payload, {
        attempts: 1,
        jobId: options?.queueJobId ?? payload.recordId,
        removeOnComplete: {
          age: 60 * 60 * 24 * 7,
          count: 1_000,
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 30,
        },
      });

      return {
        queueName: videoDigestQueueName,
        jobName: videoDigestJobName,
        queueJobId: job.id ?? null,
        payload,
      };
    },
  };
}

export function createBullMqVideoDigestWorker(
  options: BullMqVideoDigestWorkerOptions,
): VideoDigestWorkerHandle {
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<VideoDigestQueuePayload>(
    videoDigestQueueName,
    async (job) => {
      if (job.name !== videoDigestJobName) {
        throw new Error(`Unsupported video digest job: ${job.name}`);
      }

      await options.processor(job.data, {
        queueJobId: job.id ?? null,
        attemptsMade: job.attemptsMade,
      });
    },
    {
      concurrency: options.concurrency ?? 1,
      connection,
    },
  );

  return {
    queueName: videoDigestQueueName,
    jobName: videoDigestJobName,
    async close() {
      await worker.close();
      await connection.quit();
    },
  };
}
