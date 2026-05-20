import {
  createBullMqVideoDigestQueue,
  createNoopVideoDigestQueue,
  type VideoDigestQueue,
} from "@repo/queue";

let videoDigestQueue: VideoDigestQueue | null = null;

export function getVideoDigestQueue(): VideoDigestQueue {
  if (videoDigestQueue) {
    return videoDigestQueue;
  }

  const redisUrl = process.env.REDIS_URL;

  videoDigestQueue = redisUrl
    ? createBullMqVideoDigestQueue({ redisUrl })
    : createNoopVideoDigestQueue();

  return videoDigestQueue;
}
