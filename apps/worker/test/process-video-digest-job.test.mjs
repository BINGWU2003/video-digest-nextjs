import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";

import {
  SummaryGenerationError,
  TranscriptNotFoundError,
  VideoMetadataFetchError,
} from "../../../packages/video-digest-core/dist/index.js";
import { EmailDeliveryError } from "../dist/email-delivery.js";
import { processVideoDigestJob } from "../dist/process-video-digest-job.js";

const userId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const fixedDate = new Date("2026-05-23T09:00:00.000Z");
const payload = { recordId, userId };
const context = { attemptsMade: 1, queueJobId: "queue-job-1" };

mock.method(globalThis.console, "log", () => {});

describe("processVideoDigestJob", () => {
  test("processes metadata, transcript and summary to completion", async () => {
    const dependencies = createDependencies();

    await processVideoDigestJob(dependencies, payload, context);

    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata", "extracting_transcript", "summarizing", "completed"],
    );
    assert.deepEqual(
      dependencies.createdJobEvents.map((event) => event.status),
      ["fetching_metadata", "extracting_transcript", "summarizing", "completed"],
    );
    assert.equal(dependencies.createdTranscripts.length, 1);
    assert.equal(dependencies.createdSummaries.length, 1);
    assert.equal(dependencies.records[0].status, "completed");
    assert.equal(dependencies.records[0].completedAt, fixedDate);
  });

  test("completes transcript-only jobs without generating a summary", async () => {
    const dependencies = createDependencies({
      record: createVideoRecordRow({ outputMode: "transcript" }),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata", "extracting_transcript", "completed"],
    );
    assert.deepEqual(
      dependencies.createdJobEvents.map((event) => event.status),
      ["fetching_metadata", "extracting_transcript", "completed"],
    );
    assert.equal(dependencies.summaryCalls.length, 0);
    assert.equal(dependencies.createdSummaries.length, 0);
  });

  test("delivers summary emails and completes summary_and_email jobs", async () => {
    const dependencies = createDependencies({
      record: createVideoRecordRow({
        outputMode: "summary_and_email",
        sendEmail: true,
      }),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      [
        "fetching_metadata",
        "extracting_transcript",
        "summarizing",
        "delivering",
        "completed",
      ],
    );
    assert.deepEqual(
      dependencies.createdJobEvents.map((event) => event.status),
      [
        "fetching_metadata",
        "extracting_transcript",
        "summarizing",
        "delivering",
        "completed",
      ],
    );
    assert.equal(dependencies.createdDeliveries.length, 1);
    assert.equal(dependencies.deliveryStatusUpdates[0].status, "sent");
    assert.equal(
      dependencies.deliveryStatusUpdates[0].providerMessageId,
      "resend-message-1",
    );
    assert.equal(
      dependencies.deliveryStatusUpdates[0].providerEventType,
      "email.sent",
    );
    assert.equal(dependencies.updatedEmailLastSentAt.length, 1);
    assert.equal(dependencies.createdUsageEvents.length, 1);
    assert.equal(dependencies.emailSends.length, 1);
    assert.equal(dependencies.records[0].status, "completed");
  });

  test("marks metadata fetch failures with metadata_fetch_failed", async () => {
    const dependencies = createDependencies({
      metadataError: new VideoMetadataFetchError("youtube", "yt-dlp failed"),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.equal(dependencies.records[0].status, "failed");
    assert.equal(dependencies.records[0].errorCode, "metadata_fetch_failed");
    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata", "failed"],
    );
    assert.equal(dependencies.createdJobEvents.at(-1).status, "failed");
    assert.equal(
      dependencies.createdJobEvents.at(-1).metadata.errorCode,
      "metadata_fetch_failed",
    );
  });

  test("marks transcript failures with transcript_not_found", async () => {
    const dependencies = createDependencies({
      transcriptError: new TranscriptNotFoundError("youtube", "字幕轨道为空。"),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.equal(dependencies.records[0].status, "failed");
    assert.equal(dependencies.records[0].errorCode, "transcript_not_found");
    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata", "extracting_transcript", "failed"],
    );
    assert.equal(dependencies.createdJobEvents.at(-1).status, "failed");
    assert.equal(
      dependencies.createdJobEvents.at(-1).metadata.errorCode,
      "transcript_not_found",
    );
  });

  test("marks summary failures with summary_generation_failed", async () => {
    const dependencies = createDependencies({
      summaryError: new SummaryGenerationError("model timeout"),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.equal(dependencies.records[0].status, "failed");
    assert.equal(dependencies.records[0].errorCode, "summary_generation_failed");
    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata", "extracting_transcript", "summarizing", "failed"],
    );
    assert.equal(dependencies.createdJobEvents.at(-1).status, "failed");
    assert.equal(
      dependencies.createdJobEvents.at(-1).metadata.errorCode,
      "summary_generation_failed",
    );
  });

  test("marks delivery failures with email_delivery_failed", async () => {
    const dependencies = createDependencies({
      emailDeliveryError: new EmailDeliveryError("Resend unavailable"),
      record: createVideoRecordRow({
        outputMode: "summary_and_email",
        sendEmail: true,
      }),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.equal(dependencies.records[0].status, "failed");
    assert.equal(dependencies.records[0].errorCode, "email_delivery_failed");
    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      [
        "fetching_metadata",
        "extracting_transcript",
        "summarizing",
        "delivering",
        "failed",
      ],
    );
    assert.deepEqual(
      dependencies.deliveryStatusUpdates.map((update) => update.status),
      ["failed"],
    );
    assert.equal(
      dependencies.createdJobEvents.at(-1).metadata.errorCode,
      "email_delivery_failed",
    );
  });

  test("marks missing recipients with email_recipient_not_found", async () => {
    const dependencies = createDependencies({
      defaultEmailAddress: null,
      record: createVideoRecordRow({
        outputMode: "summary_and_email",
        sendEmail: true,
      }),
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.equal(dependencies.records[0].status, "failed");
    assert.equal(dependencies.records[0].errorCode, "email_recipient_not_found");
    assert.equal(dependencies.createdDeliveries.length, 0);
    assert.equal(
      dependencies.createdJobEvents.at(-1).metadata.errorCode,
      "email_recipient_not_found",
    );
  });

  test("stops without overriding status when cancellation is detected", async () => {
    const dependencies = createDependencies({
      onFetchMetadata: ({ records }) => {
        records[0] = {
          ...records[0],
          status: "cancelled",
        };
      },
    });

    await processVideoDigestJob(dependencies, payload, context);

    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["fetching_metadata"],
    );
    assert.deepEqual(
      dependencies.createdJobEvents.map((event) => event.status),
      ["fetching_metadata"],
    );
    assert.equal(dependencies.records[0].status, "cancelled");
    assert.equal(dependencies.createdTranscripts.length, 0);
    assert.equal(dependencies.createdSummaries.length, 0);
  });
});

function createDependencies(options = {}) {
  const records = [options.record ?? createVideoRecordRow()];
  const createdDeliveries = [];
  const createdJobEvents = [];
  const createdSummaries = [];
  const createdTranscripts = [];
  const createdUsageEvents = [];
  const defaultEmailAddress =
    options.defaultEmailAddress === undefined
      ? createEmailAddressRow()
      : options.defaultEmailAddress;
  const deliveryStatusUpdates = [];
  const emailSends = [];
  const metadataCalls = [];
  const statusUpdates = [];
  const summaryCalls = [];
  const transcriptCalls = [];
  const updatedEmailLastSentAt = [];

  return {
    createdDeliveries,
    createdJobEvents,
    createdSummaries,
    createdTranscripts,
    createdUsageEvents,
    deliveryRecordsRepository: {
      async create(input) {
        const delivery = {
          ...input,
          createdAt: fixedDate,
          errorMessage: null,
          id: `delivery-${createdDeliveries.length + 1}`,
          providerEventAt: null,
          providerEventType: null,
          providerMessageId: null,
          sentAt: null,
          status: "queued",
        };
        createdDeliveries.push(delivery);
        return delivery;
      },
      async findLatestForRecord() {
        throw new Error("findLatestForRecord is not used in these tests.");
      },
      async updateStatusForUser(input) {
        deliveryStatusUpdates.push(input);
        const delivery = createdDeliveries.find(
          (candidate) =>
            candidate.id === input.id && candidate.userId === input.userId,
        );

        if (!delivery) {
          throw new Error("delivery not found");
        }

        const nextDelivery = {
          ...delivery,
          errorMessage:
            input.errorMessage === undefined
              ? delivery.errorMessage
              : input.errorMessage,
          providerEventAt:
            input.providerEventAt === undefined
              ? delivery.providerEventAt
              : input.providerEventAt,
          providerEventType:
            input.providerEventType === undefined
              ? delivery.providerEventType
              : input.providerEventType,
          providerMessageId:
            input.providerMessageId === undefined
              ? delivery.providerMessageId
              : input.providerMessageId,
          sentAt: input.sentAt ?? null,
          status: input.status,
        };
        createdDeliveries.splice(
          createdDeliveries.indexOf(delivery),
          1,
          nextDelivery,
        );
        return nextDelivery;
      },
      async updateStatusByProviderMessageId() {
        throw new Error(
          "updateStatusByProviderMessageId is not used in these tests.",
        );
      },
    },
    deliveryStatusUpdates,
    emailAddressesRepository: {
      async findDefaultVerifiedForUser(input) {
        return defaultEmailAddress?.userId === input.userId
          ? defaultEmailAddress
          : null;
      },
      async updateLastSentAt(input) {
        updatedEmailLastSentAt.push(input);

        return {
          ...defaultEmailAddress,
          lastSentAt: input.lastSentAt,
        };
      },
    },
    emailDeliveryProvider: {
      async sendEmail(input) {
        emailSends.push(input);

        if (options.emailDeliveryError) {
          throw options.emailDeliveryError;
        }

        return {
          providerMessageId: "resend-message-1",
        };
      },
    },
    emailSends,
    jobEventsRepository: {
      async create(input) {
        createdJobEvents.push(input);
        return {
          ...input,
          createdAt: fixedDate,
          id: `job-event-${createdJobEvents.length}`,
          metadata: input.metadata ?? {},
        };
      },
    },
    metadataCalls,
    metadataProviderRegistry: {
      getProvider(platform) {
        return {
          platform,
          async fetchMetadata(input) {
            metadataCalls.push(input);
            options.onFetchMetadata?.({ records });

            if (options.metadataError) {
              throw options.metadataError;
            }

            return {
              author: "Demo Author",
              durationSeconds: 120,
              fetchedAt: fixedDate,
              platform,
              thumbnailUrl: "https://example.com/thumb.jpg",
              title: "Demo Video",
            };
          },
        };
      },
    },
    now: () => fixedDate,
    records,
    statusUpdates,
    summariesRepository: {
      async create(input) {
        createdSummaries.push(input);
        return {
          ...input,
          createdAt: fixedDate,
          id: `summary-${createdSummaries.length}`,
        };
      },
      async findLatestForRecord() {
        throw new Error("findLatestForRecord is not used in these tests.");
      },
    },
    summaryCalls,
    summaryProvider: {
      async generateSummary(input) {
        summaryCalls.push(input);

        if (options.summaryError) {
          throw options.summaryError;
        }

        return {
          format: input.format,
          keyPoints: ["Point"],
          language: "zh-CN",
          markdown: "## Summary",
          model: "test-model",
          promptVersion: "test-v1",
          shortSummary: "Short summary",
          takeaways: ["Takeaway"],
          timeline: [],
          title: "Summary title",
        };
      },
    },
    transcriptCalls,
    transcriptProviderRegistry: {
      getProvider(platform) {
        return {
          platform,
          async fetchTranscript(input) {
            transcriptCalls.push(input);

            if (options.transcriptError) {
              throw options.transcriptError;
            }

            return createTranscriptResult();
          },
        };
      },
    },
    transcriptsRepository: {
      async create(input) {
        createdTranscripts.push(input);
        return {
          segments: input.segments.map((segment, index) => ({
            ...segment,
            id: `segment-${index + 1}`,
            recordId: input.recordId,
            transcriptId: `transcript-${createdTranscripts.length}`,
            userId: input.userId,
          })),
          transcript: {
            createdAt: fixedDate,
            id: `transcript-${createdTranscripts.length}`,
            language: input.language,
            plainText: input.plainText,
            recordId: input.recordId,
            segmentCount: input.segments.length,
            source: input.source,
            storageKey: input.storageKey,
            userId: input.userId,
          },
        };
      },
      async findLatestForRecord() {
        throw new Error("findLatestForRecord is not used in these tests.");
      },
    },
    updatedEmailLastSentAt,
    usageEventsRepository: {
      async create(input) {
        createdUsageEvents.push(input);
        return {
          ...input,
          createdAt: fixedDate,
          id: `usage-event-${createdUsageEvents.length}`,
          quantity: input.quantity ?? 1,
          recordId: input.recordId ?? null,
          unit: input.unit ?? "count",
        };
      },
    },
    videoRecordsRepository: {
      async create() {
        throw new Error("create is not used in these tests.");
      },
      async findByIdForUser(input) {
        return (
          records.find(
            (record) =>
              record.id === input.id &&
              record.userId === input.userId &&
              record.deletedAt === null,
          ) ?? null
        );
      },
      async findLatestByNormalizedUrlForUser() {
        throw new Error(
          "findLatestByNormalizedUrlForUser is not used in these tests.",
        );
      },
      async listForUser() {
        throw new Error("listForUser is not used in these tests.");
      },
      async listPageForUser() {
        throw new Error("listPageForUser is not used in these tests.");
      },
      async updateMetadataForUser(input) {
        const record = findRecord(records, input.id, input.userId);
        const nextRecord = {
          ...record,
          author: input.author,
          durationSeconds: input.durationSeconds,
          thumbnailUrl: input.thumbnailUrl,
          title: input.title,
          updatedAt: fixedDate,
        };
        records.splice(records.indexOf(record), 1, nextRecord);
        return nextRecord;
      },
      async updateStatusForUser(input) {
        statusUpdates.push(input);
        const record = findRecord(records, input.id, input.userId);

        if (input.expectedStatus && record.status !== input.expectedStatus) {
          throw new Error("record not found or status mismatch");
        }

        const nextRecord = {
          ...record,
          completedAt: input.completedAt ?? record.completedAt,
          errorCode:
            input.errorCode === undefined ? record.errorCode : input.errorCode,
          errorMessage:
            input.errorMessage === undefined
              ? record.errorMessage
              : input.errorMessage,
          status: input.status,
          updatedAt: fixedDate,
        };
        records.splice(records.indexOf(record), 1, nextRecord);
        return nextRecord;
      },
    },
  };
}

function createEmailAddressRow(overrides = {}) {
  return {
    createdAt: fixedDate,
    email: "user@example.com",
    id: "33333333-3333-4333-8333-333333333333",
    isDefault: true,
    lastSentAt: null,
    status: "verified",
    userId,
    verificationSentAt: fixedDate,
    verificationTokenHash: null,
    verifiedAt: fixedDate,
    ...overrides,
  };
}

function findRecord(records, id, ownerId) {
  const record = records.find(
    (candidate) => candidate.id === id && candidate.userId === ownerId,
  );

  if (!record) {
    throw new Error("record not found");
  }

  return record;
}

function createTranscriptResult() {
  return {
    language: "zh-CN",
    plainText: "第一段\n第二段",
    segments: [
      {
        endSeconds: 4,
        startSeconds: 0,
        text: "第一段",
      },
      {
        endSeconds: 8,
        startSeconds: 4,
        text: "第二段",
      },
    ],
    source: "manual_subtitle",
  };
}

function createVideoRecordRow(overrides = {}) {
  const createdAt = new Date("2026-05-23T00:00:00.000Z");

  return {
    author: null,
    completedAt: null,
    createdAt,
    createdById: userId,
    createdByType: "web",
    deletedAt: null,
    durationSeconds: null,
    errorCode: null,
    errorMessage: null,
    fallbackToAudio: false,
    id: recordId,
    normalizedUrl: "https://www.youtube.com/watch?v=default",
    outputMode: "summary",
    platform: "youtube",
    sendEmail: false,
    sourceUrl: "https://www.youtube.com/watch?v=default",
    status: "queued",
    thumbnailUrl: null,
    title: null,
    transcriptSource: null,
    updatedAt: createdAt,
    userId,
    ...overrides,
  };
}
