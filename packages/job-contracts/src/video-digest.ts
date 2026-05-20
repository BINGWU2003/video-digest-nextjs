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
  recordId: z.string().uuid(),
  status: z.literal("queued"),
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
