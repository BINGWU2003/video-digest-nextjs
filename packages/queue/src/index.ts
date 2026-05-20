export const videoDigestQueueName = "video-digest";

export type VideoDigestQueuePayload = {
  recordId: string;
  userId: string;
};
