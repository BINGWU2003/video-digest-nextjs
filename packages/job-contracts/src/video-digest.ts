import { z } from "zod";

export const actorTypeSchema = z.enum(["user", "agent", "system"]);

export const actorSchema = z.object({
  type: actorTypeSchema,
  id: z.string().min(1),
  userId: z.string().uuid(),
  scopes: z.array(z.string()).default([]),
});

export const videoPlatformSchema = z.enum(["auto", "youtube", "bilibili"]);

export const createVideoDigestJobInputSchema = z.object({
  url: z.url(),
  platform: videoPlatformSchema.default("auto"),
  outputMode: z
    .enum(["transcript", "summary", "summary_and_email"])
    .default("summary"),
  fallbackToAudio: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
});

export const createVideoDigestJobOutputSchema = z.object({
  created: z.boolean().default(true),
  recordId: z.string().uuid(),
  status: z.enum([
    "queued",
    "fetching_metadata",
    "extracting_transcript",
    "extracting_audio",
    "transcribing_audio",
    "summarizing",
    "delivering",
    "completed",
    "failed",
    "cancelled",
  ]),
});

export const getVideoDigestRecordInputSchema = z.object({
  recordId: z.uuid(),
  segmentLimit: z.number().int().min(0).max(200).default(50),
});

export const videoDigestRecordOutputSchema = z.object({
  record: z.object({
    id: z.uuid(),
    sourceUrl: z.url(),
    normalizedUrl: z.url(),
    platform: z.enum(["youtube", "bilibili"]),
    title: z.string().nullable(),
    author: z.string().nullable(),
    durationSeconds: z.number().nullable(),
    thumbnailUrl: z.url().nullable(),
    status: z.enum([
      "queued",
      "fetching_metadata",
      "extracting_transcript",
      "extracting_audio",
      "transcribing_audio",
      "summarizing",
      "delivering",
      "completed",
      "failed",
      "cancelled",
    ]),
    transcriptSource: z
      .enum(["manual_subtitle", "auto_subtitle", "asr"])
      .nullable(),
    outputMode: z.enum(["transcript", "summary", "summary_and_email"]),
    fallbackToAudio: z.boolean(),
    sendEmail: z.boolean(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  }),
  transcript: z
    .object({
      id: z.uuid(),
      language: z.string().nullable(),
      source: z.enum(["manual_subtitle", "auto_subtitle", "asr"]),
      plainText: z.string().nullable(),
      segmentCount: z.number().int(),
      createdAt: z.iso.datetime(),
      segments: z.array(
        z.object({
          id: z.uuid(),
          startSeconds: z.number().nullable(),
          endSeconds: z.number().nullable(),
          text: z.string(),
          sortOrder: z.number().int(),
        }),
      ),
    })
    .nullable(),
  summary: z
    .object({
      id: z.uuid(),
      language: z.string(),
      format: z.enum(["brief", "detailed", "email_digest"]),
      title: z.string().nullable(),
      shortSummary: z.string().nullable(),
      keyPoints: z.array(z.unknown()),
      timeline: z.array(z.unknown()),
      takeaways: z.array(z.unknown()),
      markdown: z.string().nullable(),
      model: z.string().nullable(),
      promptVersion: z.string().nullable(),
      createdAt: z.iso.datetime(),
    })
    .nullable(),
  delivery: z
    .object({
      latest: z
        .object({
          id: z.uuid(),
          type: z.enum(["email", "webhook"]),
          status: z.enum([
            "queued",
            "sent",
            "delivered",
            "delivery_delayed",
            "bounced",
            "complained",
            "failed",
            "cancelled",
          ]),
          subject: z.string().nullable(),
          providerMessageId: z.string().nullable(),
          providerEventType: z.string().nullable(),
          providerEventAt: z.iso.datetime().nullable(),
          errorMessage: z.string().nullable(),
          createdAt: z.iso.datetime(),
          sentAt: z.iso.datetime().nullable(),
        })
        .nullable(),
      history: z.array(
        z.object({
          id: z.uuid(),
          type: z.enum(["email", "webhook"]),
          status: z.enum([
            "queued",
            "sent",
            "delivered",
            "delivery_delayed",
            "bounced",
            "complained",
            "failed",
            "cancelled",
          ]),
          subject: z.string().nullable(),
          providerMessageId: z.string().nullable(),
          providerEventType: z.string().nullable(),
          providerEventAt: z.iso.datetime().nullable(),
          errorMessage: z.string().nullable(),
          createdAt: z.iso.datetime(),
          sentAt: z.iso.datetime().nullable(),
        }),
      ),
    })
    .nullable(),
});

export type Actor = z.infer<typeof actorSchema>;
export type VideoPlatform = z.infer<typeof videoPlatformSchema>;
export type CreateVideoDigestJobInput = z.input<
  typeof createVideoDigestJobInputSchema
>;
export type ParsedCreateVideoDigestJobInput = z.output<
  typeof createVideoDigestJobInputSchema
>;
export type CreateVideoDigestJobOutput = z.infer<
  typeof createVideoDigestJobOutputSchema
>;
export type GetVideoDigestRecordInput = z.input<
  typeof getVideoDigestRecordInputSchema
>;
export type ParsedGetVideoDigestRecordInput = z.output<
  typeof getVideoDigestRecordInputSchema
>;
export type VideoDigestRecordOutput = z.infer<
  typeof videoDigestRecordOutputSchema
>;
