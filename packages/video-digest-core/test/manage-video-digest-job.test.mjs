import assert from "node:assert/strict";
import { describe, test } from "vitest";

import {
  cancelVideoDigestJob,
  retryVideoDigestJob,
} from "../dist/index.js";

const userId = "11111111-1111-4111-8111-111111111111";
const fixedDate = new Date("2026-05-23T08:30:00.000Z");

describe("cancelVideoDigestJob", () => {
  test("cancels an active record and persists a job event", async () => {
    const record = createVideoRecordRow({
      id: "22222222-2222-4222-8222-222222222222",
      status: "extracting_transcript",
    });
    const dependencies = createDependencies({ records: [record] });

    const result = await cancelVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.cancelled, true);
    assert.equal(result.record.status, "cancelled");
    assert.equal(result.record.completedAt, fixedDate);
    assert.deepEqual(dependencies.statusUpdates, [
      {
        completedAt: fixedDate,
        errorCode: null,
        errorMessage: null,
        expectedStatus: "extracting_transcript",
        id: record.id,
        status: "cancelled",
        userId,
      },
    ]);
    assert.equal(dependencies.createdJobEvents.length, 1);
    assert.equal(dependencies.createdJobEvents[0].status, "cancelled");
    assert.deepEqual(dependencies.createdJobEvents[0].metadata, {
      cancelledAt: fixedDate.toISOString(),
      previousStatus: "extracting_transcript",
    });
  });

  test("does not cancel a completed record", async () => {
    const record = createVideoRecordRow({
      id: "33333333-3333-4333-8333-333333333333",
      status: "completed",
    });
    const dependencies = createDependencies({ records: [record] });

    const result = await cancelVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.cancelled, false);
    assert.equal(result.record, record);
    assert.equal(dependencies.statusUpdates.length, 0);
    assert.equal(dependencies.createdJobEvents.length, 0);
  });

  test("keeps cancellation successful when job event persistence fails", async () => {
    const record = createVideoRecordRow({
      id: "44444444-4444-4444-8444-444444444444",
      status: "queued",
    });
    const errors = [];
    const dependencies = createDependencies({
      failJobEventCreate: true,
      onJobEventCreateError: (error) => errors.push(error),
      records: [record],
    });

    const result = await cancelVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.cancelled, true);
    assert.equal(result.record.status, "cancelled");
    assert.equal(errors.length, 1);
  });
});

describe("retryVideoDigestJob", () => {
  test("requeues a failed record with a unique retry queue job id", async () => {
    const record = createVideoRecordRow({
      errorCode: "transcript_not_found",
      id: "55555555-5555-4555-8555-555555555555",
      status: "failed",
    });
    const dependencies = createDependencies({ records: [record] });

    const result = await retryVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.retried, true);
    assert.equal(result.enqueued, true);
    assert.equal(result.record.status, "queued");
    assert.deepEqual(dependencies.statusUpdates, [
      {
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        expectedStatus: "failed",
        id: record.id,
        status: "queued",
        userId,
      },
    ]);
    assert.equal(dependencies.createdJobEvents.length, 1);
    assert.deepEqual(dependencies.createdJobEvents[0].metadata, {
      previousErrorCode: "transcript_not_found",
      previousStatus: "failed",
      retriedAt: fixedDate.toISOString(),
    });
    assert.deepEqual(dependencies.enqueuedJobs, [
      {
        options: {
          queueJobId: `${record.id}-retry-${fixedDate.getTime()}`,
        },
        payload: {
          recordId: record.id,
          userId,
        },
      },
    ]);
  });

  test("does not retry an active record", async () => {
    const record = createVideoRecordRow({
      id: "66666666-6666-4666-8666-666666666666",
      status: "summarizing",
    });
    const dependencies = createDependencies({ records: [record] });

    const result = await retryVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.retried, false);
    assert.equal(result.enqueued, false);
    assert.equal(result.record, record);
    assert.equal(dependencies.statusUpdates.length, 0);
    assert.equal(dependencies.enqueuedJobs.length, 0);
  });

  test("marks the record failed when retry enqueue fails", async () => {
    const record = createVideoRecordRow({
      errorCode: "worker_processing_failed",
      id: "77777777-7777-4777-8777-777777777777",
      status: "cancelled",
    });
    const dependencies = createDependencies({
      failEnqueue: true,
      records: [record],
    });

    const result = await retryVideoDigestJob(dependencies, {
      recordId: record.id,
      userId,
    });

    assert.equal(result.retried, true);
    assert.equal(result.enqueued, false);
    assert.equal(result.record.status, "failed");
    assert.equal(result.record.errorCode, "retry_enqueue_failed");
    assert.equal(result.record.errorMessage, "Redis unavailable");
    assert.deepEqual(
      dependencies.statusUpdates.map((update) => update.status),
      ["queued", "failed"],
    );
    assert.deepEqual(
      dependencies.createdJobEvents.map((event) => event.status),
      ["queued", "failed"],
    );
    assert.deepEqual(dependencies.createdJobEvents[1].metadata, {
      previousErrorCode: "worker_processing_failed",
      previousStatus: "cancelled",
    });
  });
});

function createDependencies(options = {}) {
  const records = [...(options.records ?? [])];
  const createdJobEvents = [];
  const enqueuedJobs = [];
  const statusUpdates = [];

  return {
    createdJobEvents,
    enqueuedJobs,
    jobEventsRepository: {
      async create(input) {
        if (options.failJobEventCreate) {
          throw new Error("job event unavailable");
        }

        createdJobEvents.push(input);
        return {
          ...input,
          createdAt: fixedDate,
          id: `job-event-${createdJobEvents.length}`,
        };
      },
    },
    now: () => fixedDate,
    onJobEventCreateError: options.onJobEventCreateError,
    statusUpdates,
    videoDigestQueue: {
      async enqueueVideoDigestJob(payload, enqueueOptions) {
        if (options.failEnqueue) {
          throw new Error("Redis unavailable");
        }

        enqueuedJobs.push({
          options: enqueueOptions,
          payload,
        });

        return {
          jobName: "process-video-digest",
          payload,
          queueJobId: enqueueOptions?.queueJobId ?? null,
          queueName: "video-digest",
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
      async updateMetadataForUser() {
        throw new Error("updateMetadataForUser is not used in these tests.");
      },
      async updateStatusForUser(input) {
        statusUpdates.push(input);
        const record = records.find(
          (candidate) =>
            candidate.id === input.id &&
            candidate.userId === input.userId &&
            candidate.status === input.expectedStatus,
        );

        if (!record) {
          throw new Error("record not found or status mismatch");
        }

        const nextRecord = {
          ...record,
          completedAt: input.completedAt ?? null,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          status: input.status,
          updatedAt: fixedDate,
        };
        records.splice(records.indexOf(record), 1, nextRecord);
        return nextRecord;
      },
    },
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
    id: "11111111-1111-4111-8111-000000000000",
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
