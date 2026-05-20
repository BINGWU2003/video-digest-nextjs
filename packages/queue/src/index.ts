import { Queue } from "bullmq";
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

export type VideoDigestQueue = {
  /** 投递一个视频摘要后台处理任务。 */
  enqueueVideoDigestJob(
    payload: VideoDigestQueuePayload,
  ): Promise<EnqueuedVideoDigestJob>;
};

export type BullMqVideoDigestQueueOptions = {
  /** Redis 连接地址，例如 redis://localhost:6379。 */
  redisUrl: string;
};

export function createNoopVideoDigestQueue(): VideoDigestQueue {
  return {
    async enqueueVideoDigestJob(payload) {
      return {
        queueName: videoDigestQueueName,
        jobName: videoDigestJobName,
        queueJobId: null,
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
    async enqueueVideoDigestJob(payload) {
      const job = await queue.add(videoDigestJobName, payload, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        jobId: payload.recordId,
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
