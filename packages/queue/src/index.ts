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
  /** 已投递给队列的任务 payload。 */
  payload: VideoDigestQueuePayload;
};

export type VideoDigestQueue = {
  /** 投递一个视频摘要后台处理任务。 */
  enqueueVideoDigestJob(
    payload: VideoDigestQueuePayload,
  ): Promise<EnqueuedVideoDigestJob>;
};

export function createNoopVideoDigestQueue(): VideoDigestQueue {
  return {
    async enqueueVideoDigestJob(payload) {
      return {
        queueName: videoDigestQueueName,
        jobName: videoDigestJobName,
        payload,
      };
    },
  };
}
