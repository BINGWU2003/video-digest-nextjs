import { z } from "zod";

export const createVideoDigestJobInputSchema = z.object({
  fallbackToAudio: z.boolean().default(false),
  outputMode: z
    .enum(["transcript", "summary", "summary_and_email"])
    .default("summary"),
  platform: z.enum(["auto", "youtube", "bilibili"]).default("auto"),
  sendEmail: z.boolean().default(false),
  url: z.url(),
});

export const getVideoDigestRecordInputSchema = z.object({
  recordId: z.uuid(),
  segmentLimit: z.number().int().min(0).max(200).default(50),
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
