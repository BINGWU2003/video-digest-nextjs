import type {
  DeliveryRecordsRepository,
  SummariesRepository,
  TranscriptsRepository,
  VideoRecordsRepository,
  DeliveryRecordRow,
} from "@video-digest-nextjs/database";
import {
  type GetVideoDigestRecordInput,
  type VideoDigestRecordOutput,
  videoDigestRecordOutputSchema,
} from "@video-digest-nextjs/job-contracts";

import type { ToolDefinition } from "../tool-definition.js";

type GetVideoDigestRecordDependencies = {
  deliveryRecordsRepository: DeliveryRecordsRepository;
  summariesRepository: SummariesRepository;
  transcriptsRepository: TranscriptsRepository;
  videoRecordsRepository: VideoRecordsRepository;
};

export const getVideoDigestRecordTool: ToolDefinition<
  GetVideoDigestRecordInput,
  VideoDigestRecordOutput,
  GetVideoDigestRecordDependencies
> = {
  name: "get_video_digest_record",
  description:
    "Read a video digest record with transcript, summary and delivery status for the current actor.",
  requiredScopes: ["digest:read"],
  createHandler:
    (dependencies) =>
    async (input, context): Promise<VideoDigestRecordOutput> => {
      const record = await dependencies.videoRecordsRepository.findByIdForUser({
        id: input.recordId,
        userId: context.actor.userId,
      });

      if (!record) {
        throw new Error("视频摘要记录不存在。");
      }

      const [transcript, summary, deliveryHistory] = await Promise.all([
        dependencies.transcriptsRepository.findLatestForRecord({
          recordId: record.id,
          segmentLimit: input.segmentLimit,
          userId: context.actor.userId,
        }),
        dependencies.summariesRepository.findLatestForRecord({
          recordId: record.id,
          userId: context.actor.userId,
        }),
        dependencies.deliveryRecordsRepository.listForRecord({
          limit: 5,
          recordId: record.id,
          userId: context.actor.userId,
        }),
      ]);

      return videoDigestRecordOutputSchema.parse({
        delivery: {
          history: deliveryHistory.map(mapDeliveryRecord),
          latest: deliveryHistory[0] ? mapDeliveryRecord(deliveryHistory[0]) : null,
        },
        record: {
          author: record.author,
          completedAt: record.completedAt?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
          durationSeconds: record.durationSeconds,
          errorCode: record.errorCode,
          errorMessage: record.errorMessage,
          fallbackToAudio: record.fallbackToAudio,
          id: record.id,
          normalizedUrl: record.normalizedUrl,
          outputMode: record.outputMode,
          platform: record.platform,
          sendEmail: record.sendEmail,
          sourceUrl: record.sourceUrl,
          status: record.status,
          thumbnailUrl: record.thumbnailUrl,
          title: record.title,
          transcriptSource: record.transcriptSource,
          updatedAt: record.updatedAt.toISOString(),
        },
        summary: summary
          ? {
              createdAt: summary.createdAt.toISOString(),
              format: summary.format,
              id: summary.id,
              keyPoints: summary.keyPoints,
              language: summary.language,
              markdown: summary.markdown,
              model: summary.model,
              promptVersion: summary.promptVersion,
              shortSummary: summary.shortSummary,
              takeaways: summary.takeaways,
              timeline: summary.timeline,
              title: summary.title,
            }
          : null,
        transcript: transcript
          ? {
              createdAt: transcript.transcript.createdAt.toISOString(),
              id: transcript.transcript.id,
              language: transcript.transcript.language,
              plainText: transcript.transcript.plainText,
              segmentCount: transcript.transcript.segmentCount,
              segments: transcript.segments.map((segment) => ({
                endSeconds: segment.endSeconds,
                id: segment.id,
                sortOrder: segment.sortOrder,
                startSeconds: segment.startSeconds,
                text: segment.text,
              })),
              source: transcript.transcript.source,
            }
          : null,
      });
    },
};

function mapDeliveryRecord(deliveryRecord: DeliveryRecordRow) {
  return {
    createdAt: deliveryRecord.createdAt.toISOString(),
    errorMessage: deliveryRecord.errorMessage,
    id: deliveryRecord.id,
    providerEventAt: deliveryRecord.providerEventAt?.toISOString() ?? null,
    providerEventType: deliveryRecord.providerEventType,
    providerMessageId: deliveryRecord.providerMessageId,
    sentAt: deliveryRecord.sentAt?.toISOString() ?? null,
    status: deliveryRecord.status,
    subject: deliveryRecord.subject,
    type: deliveryRecord.type,
  };
}
