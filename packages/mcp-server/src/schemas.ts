import { z } from "zod";

export const createVideoDigestJobInputSchema = z.object({
  fallbackToAudio: z
    .boolean()
    .default(false)
    .describe(
      "当视频没有公开字幕时，是否允许提取音频并使用本地 ASR 转写。开启后异步任务可能明显变慢，长视频尤其明显。",
    ),
  outputMode: z
    .enum(["transcript", "summary", "summary_and_email"])
    .default("summary")
    .describe(
      "异步任务的输出模式。transcript 只提取字幕，summary 生成 AI 摘要，summary_and_email 生成摘要后再通过邮件投递。",
    ),
  platform: z
    .enum(["auto", "youtube", "bilibili"])
    .default("auto")
    .describe("视频平台。除非用户明确指定，否则优先使用 auto。"),
  sendEmail: z
    .boolean()
    .default(false)
    .describe(
      "是否在摘要生成后请求邮件投递。用户必须已有默认的已验证邮箱。",
    ),
  url: z
    .url()
    .describe("需要异步处理的 YouTube 或 Bilibili 视频链接。"),
});

export const getVideoDigestRecordInputSchema = z.object({
  recordId: z
    .uuid()
    .describe("create_video_digest_job 返回的视频摘要记录 ID。"),
  segmentLimit: z
    .number()
    .int()
    .min(0)
    .max(200)
    .default(50)
    .describe(
      "本次快照最多返回的字幕分段数量。除非用户需要更多文本，否则建议使用 20 到 50 这样的小值。",
    ),
});

export type CreateVideoDigestJobInput = z.input<
  typeof createVideoDigestJobInputSchema
>;

export type CreateVideoDigestJobOutput = {
  created: boolean;
  recordId: string;
  status:
    | "queued"
    | "fetching_metadata"
    | "extracting_transcript"
    | "extracting_audio"
    | "transcribing_audio"
    | "summarizing"
    | "delivering"
    | "completed"
    | "failed"
    | "cancelled";
};

export type GetVideoDigestRecordInput = z.input<
  typeof getVideoDigestRecordInputSchema
>;

export type VideoDigestRecordOutput = unknown;
