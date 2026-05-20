import { videoDigestQueueName } from "@repo/queue";

export function startWorker() {
  return {
    queueName: videoDigestQueueName,
    status: "idle",
  } as const;
}

const worker = startWorker();

console.log(`Worker template ready for queue: ${worker.queueName}`);
