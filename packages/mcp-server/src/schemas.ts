import { z } from "zod";

export const createVideoDigestJobInputSchema = z.object({
  fallbackToAudio: z
    .boolean()
    .default(false)
    .describe(
      "Allow audio extraction and local ASR when no public subtitle is available. This can make the async job much slower, especially for long videos.",
    ),
  outputMode: z
    .enum(["transcript", "summary", "summary_and_email"])
    .default("summary")
    .describe(
      "Requested async output. Use transcript for subtitle extraction only, summary to generate an AI summary, or summary_and_email to also deliver the generated summary by email.",
    ),
  platform: z
    .enum(["auto", "youtube", "bilibili"])
    .default("auto")
    .describe("Video platform. Prefer auto unless the user explicitly specifies one."),
  sendEmail: z
    .boolean()
    .default(false)
    .describe(
      "Request email delivery after summary generation. The user must have a default verified email address.",
    ),
  url: z
    .url()
    .describe("YouTube or Bilibili video URL to process asynchronously."),
});

export const getVideoDigestRecordInputSchema = z.object({
  recordId: z
    .uuid()
    .describe("Record ID returned by create_video_digest_job."),
  segmentLimit: z
    .number()
    .int()
    .min(0)
    .max(200)
    .default(50)
    .describe(
      "Maximum transcript segments to include in this snapshot. Use a small value such as 20-50 unless the user needs more text.",
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
