import type {
  DeliveryRecordsRepository,
  EmailAddressesRepository,
  JobEventsRepository,
  SummariesRepository,
  TranscriptsRepository,
  UsageEventsRepository,
  SummaryRow,
  VideoRecordRow,
  VideoRecordsRepository,
} from "@video-digest-nextjs/database";
import type {
  VideoDigestQueuePayload,
  VideoDigestWorkerContext,
} from "@video-digest-nextjs/queue";
import {
  fetchTranscript,
  fetchVideoMetadata,
  generateSummary,
  persistSummary,
  persistTranscript,
  persistVideoMetadata,
  createSummaryEmailHtml,
  createSummaryEmailLinks,
  createSummaryEmailSubject,
  createSummaryEmailText,
  EmailDeliveryError,
  EmailRecipientNotFoundError,
  SummaryGenerationError,
  type SummaryProvider,
  TranscriptFetchError,
  TranscriptNotFoundError,
  TranscriptProviderUnavailableError,
  type TranscriptProviderRegistry,
  VideoMetadataFetchError,
  VideoMetadataProviderUnavailableError,
  type VideoMetadataProviderRegistry,
  type EmailDeliveryProvider,
} from "@video-digest-nextjs/video-digest-core";

export type ProcessVideoDigestJobDependencies = {
  deliveryRecordsRepository: DeliveryRecordsRepository;
  emailAddressesRepository: EmailAddressesRepository;
  emailDeliveryProvider: EmailDeliveryProvider;
  jobEventsRepository: JobEventsRepository;
  metadataProviderRegistry: VideoMetadataProviderRegistry;
  summariesRepository: SummariesRepository;
  summaryProvider: SummaryProvider;
  transcriptProviderRegistry: TranscriptProviderRegistry;
  transcriptsRepository: TranscriptsRepository;
  usageEventsRepository: UsageEventsRepository;
  videoRecordsRepository: VideoRecordsRepository;
  webAppUrl?: string;
  now?: () => Date;
};

type VideoDigestJobFailureCode =
  | "email_delivery_failed"
  | "email_recipient_not_found"
  | "metadata_fetch_failed"
  | "provider_unavailable"
  | "summary_generation_failed"
  | "transcript_fetch_failed"
  | "transcript_not_found"
  | "worker_processing_failed";

type VideoDigestJobFailure = {
  code: VideoDigestJobFailureCode;
  message: string;
  name: string | null;
};

export async function processVideoDigestJob(
  dependencies: ProcessVideoDigestJobDependencies,
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
) {
  try {
    const record = await dependencies.videoRecordsRepository.updateStatusForUser({
      id: payload.recordId,
      userId: payload.userId,
      status: "fetching_metadata",
      expectedStatus: "queued",
      errorCode: null,
      errorMessage: null,
      completedAt: null,
    });

    await dependencies.jobEventsRepository.create({
      recordId: payload.recordId,
      userId: payload.userId,
      status: "fetching_metadata",
      message: "Worker 已接收视频摘要任务，开始准备读取视频元数据。",
      metadata: {
        attemptsMade: context.attemptsMade,
        queueJobId: context.queueJobId,
      },
    });

    console.log(
      `Accepted video digest job ${context.queueJobId ?? payload.recordId}`,
    );

    const metadata = await fetchVideoMetadata(
      {
        providerRegistry: dependencies.metadataProviderRegistry,
      },
      {
        platform: record.platform,
        sourceUrl: record.sourceUrl,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    await persistVideoMetadata(dependencies, {
      metadata,
      recordId: record.id,
      userId: record.userId,
    });

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: "extracting_transcript",
      expectedStatus: "fetching_metadata",
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: "extracting_transcript",
      message: "视频元数据已写回，开始准备提取字幕。",
      metadata: {
        attemptsMade: context.attemptsMade,
        queueJobId: context.queueJobId,
      },
    });

    const transcript = await fetchTranscript(
      {
        providerRegistry: dependencies.transcriptProviderRegistry,
      },
      {
        fallbackToAudio: record.fallbackToAudio,
        platform: record.platform,
        sourceUrl: record.sourceUrl,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const transcriptResult = await persistTranscript(dependencies, {
      recordId: record.id,
      transcript,
      userId: record.userId,
    });

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    if (record.outputMode === "transcript") {
      await dependencies.videoRecordsRepository.updateStatusForUser({
        id: record.id,
        userId: record.userId,
        status: "completed",
        expectedStatus: "extracting_transcript",
        completedAt: getNow(dependencies),
      });

      await dependencies.jobEventsRepository.create({
        recordId: record.id,
        userId: record.userId,
        status: "completed",
        message: "字幕已提取完成，任务已完成。",
        metadata: {
          attemptsMade: context.attemptsMade,
          language: transcript.language,
          queueJobId: context.queueJobId,
          segmentCount: transcriptResult.segments.length,
          source: transcript.source,
          transcriptId: transcriptResult.transcript.id,
        },
      });

      return;
    }

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: "summarizing",
      expectedStatus: "extracting_transcript",
      completedAt: null,
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: "summarizing",
      message: "字幕已提取完成，开始生成摘要。",
      metadata: {
        attemptsMade: context.attemptsMade,
        language: transcript.language,
        queueJobId: context.queueJobId,
        segmentCount: transcriptResult.segments.length,
        source: transcript.source,
        transcriptId: transcriptResult.transcript.id,
      },
    });

    const summary = await generateSummary(
      {
        summaryProvider: dependencies.summaryProvider,
      },
      {
        format:
          record.outputMode === "summary_and_email" ? "email_digest" : "brief",
        plainText: transcript.plainText,
        segments: transcript.segments,
        sourceUrl: record.sourceUrl,
        transcriptLanguage: transcript.language,
        videoAuthor: record.author,
        videoTitle: record.title,
      },
    );

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const summaryResult = await persistSummary(dependencies, {
      recordId: record.id,
      summary,
      userId: record.userId,
    });

    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    const shouldDeliverEmail =
      record.sendEmail || record.outputMode === "summary_and_email";

    if (shouldDeliverEmail) {
      await dependencies.videoRecordsRepository.updateStatusForUser({
        id: record.id,
        userId: record.userId,
        status: "delivering",
        expectedStatus: "summarizing",
        completedAt: null,
      });

      await dependencies.jobEventsRepository.create({
        recordId: record.id,
        userId: record.userId,
        status: "delivering",
        message: "摘要已生成，开始投递邮件。",
        metadata: {
          attemptsMade: context.attemptsMade,
          model: summary.model,
          promptVersion: summary.promptVersion,
          queueJobId: context.queueJobId,
          summaryId: summaryResult.id,
        },
      });

      if (await isVideoDigestJobCancelled(dependencies, payload)) {
        return;
      }

      await deliverSummaryEmail(dependencies, {
        context,
        record,
        summary: summaryResult,
      });

      return;
    }

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: record.id,
      userId: record.userId,
      status: "completed",
      expectedStatus: "summarizing",
      completedAt: getNow(dependencies),
    });

    await dependencies.jobEventsRepository.create({
      recordId: record.id,
      userId: record.userId,
      status: "completed",
      message: "摘要已生成，任务已完成。",
      metadata: {
        attemptsMade: context.attemptsMade,
        model: summary.model,
        promptVersion: summary.promptVersion,
        queueJobId: context.queueJobId,
        summaryId: summaryResult.id,
      },
    });
  } catch (caught) {
    if (await isVideoDigestJobCancelled(dependencies, payload)) {
      return;
    }

    await markVideoDigestJobFailed(dependencies, payload, context, caught);
  }
}

async function deliverSummaryEmail(
  dependencies: ProcessVideoDigestJobDependencies,
  input: {
    context: VideoDigestWorkerContext;
    record: VideoRecordRow;
    summary: SummaryRow;
  },
) {
  const emailAddress =
    await dependencies.emailAddressesRepository.findDefaultVerifiedForUser({
      userId: input.record.userId,
    });

  if (!emailAddress) {
    throw new EmailRecipientNotFoundError();
  }

  const subject = createSummaryEmailSubject();
  const deliveryRecord = await dependencies.deliveryRecordsRepository.create({
    recordId: input.record.id,
    userId: input.record.userId,
    summaryId: input.summary.id,
    type: "email",
    targetId: emailAddress.id,
    subject,
  });
  const emailLinks = createSummaryEmailLinks(input.record, dependencies.webAppUrl);
  const text = createSummaryEmailText(input.record, input.summary, emailLinks);
  const html = createSummaryEmailHtml(input.record, input.summary, emailLinks);

  try {
    const deliveryResult = await dependencies.emailDeliveryProvider.sendEmail({
      html,
      subject,
      text,
      to: emailAddress.email,
    });
    const sentAt = getNow(dependencies);

    await dependencies.deliveryRecordsRepository.updateStatusForUser({
      id: deliveryRecord.id,
      userId: input.record.userId,
      status: "sent",
      errorMessage: null,
      providerEventAt: sentAt,
      providerEventType: "email.sent",
      providerMessageId: deliveryResult.providerMessageId,
      sentAt,
    });

    await dependencies.emailAddressesRepository.updateLastSentAt({
      id: emailAddress.id,
      userId: input.record.userId,
      lastSentAt: sentAt,
    });

    await dependencies.usageEventsRepository.create({
      userId: input.record.userId,
      recordId: input.record.id,
      eventType: "email_sent",
      quantity: 1,
      unit: "count",
    });

    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: input.record.id,
      userId: input.record.userId,
      status: "completed",
      expectedStatus: "delivering",
      completedAt: sentAt,
    });

    await dependencies.jobEventsRepository.create({
      recordId: input.record.id,
      userId: input.record.userId,
      status: "completed",
      message: "摘要邮件已投递，任务已完成。",
      metadata: {
        attemptsMade: input.context.attemptsMade,
        deliveryId: deliveryRecord.id,
        emailAddressId: emailAddress.id,
        providerMessageId: deliveryResult.providerMessageId,
        queueJobId: input.context.queueJobId,
        summaryId: input.summary.id,
      },
    });
  } catch (caught) {
    await dependencies.deliveryRecordsRepository.updateStatusForUser({
      id: deliveryRecord.id,
      userId: input.record.userId,
      status: "failed",
      errorMessage: toErrorMessage(caught),
      providerEventAt: getNow(dependencies),
      providerEventType: "email.failed",
      sentAt: null,
    });

    throw caught;
  }
}

async function isVideoDigestJobCancelled(
  dependencies: Pick<ProcessVideoDigestJobDependencies, "videoRecordsRepository">,
  payload: VideoDigestQueuePayload,
) {
  const record = await dependencies.videoRecordsRepository.findByIdForUser({
    id: payload.recordId,
    userId: payload.userId,
  });

  return record?.status === "cancelled";
}

async function markVideoDigestJobFailed(
  dependencies: ProcessVideoDigestJobDependencies,
  payload: VideoDigestQueuePayload,
  context: VideoDigestWorkerContext,
  caught: unknown,
) {
  const failure = resolveVideoDigestJobFailure(caught);

  try {
    await dependencies.videoRecordsRepository.updateStatusForUser({
      id: payload.recordId,
      userId: payload.userId,
      status: "failed",
      errorCode: failure.code,
      errorMessage: failure.message,
      completedAt: getNow(dependencies),
    });

    await dependencies.jobEventsRepository.create({
      recordId: payload.recordId,
      userId: payload.userId,
      status: "failed",
      message: failure.message,
      metadata: {
        attemptsMade: context.attemptsMade,
        errorCode: failure.code,
        errorName: failure.name,
        queueJobId: context.queueJobId,
      },
    });
  } catch (failureUpdateError) {
    console.error(
      "Failed to persist video digest job failure state.",
      failureUpdateError,
    );
  }
}

function resolveVideoDigestJobFailure(caught: unknown): VideoDigestJobFailure {
  const message = toErrorMessage(caught);
  const name = caught instanceof Error ? caught.name : null;

  if (
    caught instanceof VideoMetadataProviderUnavailableError ||
    caught instanceof TranscriptProviderUnavailableError
  ) {
    return {
      code: "provider_unavailable",
      message,
      name,
    };
  }

  if (caught instanceof VideoMetadataFetchError) {
    return {
      code: "metadata_fetch_failed",
      message,
      name,
    };
  }

  if (caught instanceof TranscriptNotFoundError) {
    return {
      code: "transcript_not_found",
      message,
      name,
    };
  }

  if (caught instanceof TranscriptFetchError) {
    return {
      code: "transcript_fetch_failed",
      message,
      name,
    };
  }

  if (caught instanceof SummaryGenerationError) {
    return {
      code: "summary_generation_failed",
      message,
      name,
    };
  }

  if (caught instanceof EmailRecipientNotFoundError) {
    return {
      code: "email_recipient_not_found",
      message,
      name,
    };
  }

  if (caught instanceof EmailDeliveryError) {
    return {
      code: "email_delivery_failed",
      message,
      name,
    };
  }

  return {
    code: "worker_processing_failed",
    message,
    name,
  };
}

function toErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function getNow(dependencies: Pick<ProcessVideoDigestJobDependencies, "now">) {
  return dependencies.now?.() ?? new Date();
}
