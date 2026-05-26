import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { createVideoRecord } from "../dist/index.js";

const userId = "11111111-1111-4111-8111-111111111111";
const actor = {
  id: userId,
  scopes: [],
  type: "user",
  userId,
};

describe("createVideoRecord", () => {
  test("creates a queued record and enqueues a worker job", async () => {
    const dependencies = createDependencies();

    const result = await createVideoRecord(dependencies, {
      actor,
      input: {
        fallbackToAudio: false,
        outputMode: "summary",
        platform: "auto",
        sendEmail: false,
        url: "https://www.youtube.com/watch?v=abc123&t=30s#intro",
      },
    });

    assert.equal(result.created, true);
    assert.equal(result.record.status, "queued");
    assert.equal(result.record.platform, "youtube");
    assert.equal(
      result.record.normalizedUrl,
      "https://www.youtube.com/watch?v=abc123&t=30s",
    );
    assert.equal(dependencies.createdRecords.length, 1);
    assert.equal(dependencies.createdJobEvents.length, 1);
    assert.equal(dependencies.createdUsageEvents.length, 1);
    assert.deepEqual(dependencies.enqueuedJobs, [
      {
        recordId: result.record.id,
        userId,
      },
    ]);
  });

  test("reuses an existing active record for the same normalized URL", async () => {
    const existingRecord = createVideoRecordRow({
      id: "22222222-2222-4222-8222-222222222222",
      normalizedUrl: "https://www.youtube.com/watch?v=duplicate",
      status: "summarizing",
    });
    const dependencies = createDependencies({
      existingRecords: [existingRecord],
    });

    const result = await createVideoRecord(dependencies, {
      actor,
      input: {
        url: "https://www.youtube.com/watch?v=duplicate#ignored",
      },
    });

    assert.equal(result.created, false);
    assert.equal(result.record, existingRecord);
    assert.equal(dependencies.createdRecords.length, 0);
    assert.equal(dependencies.createdJobEvents.length, 0);
    assert.equal(dependencies.createdUsageEvents.length, 0);
    assert.equal(dependencies.enqueuedJobs.length, 0);
  });

  test("creates a fresh record when the latest matching record failed", async () => {
    const failedRecord = createVideoRecordRow({
      id: "33333333-3333-4333-8333-333333333333",
      normalizedUrl: "https://www.youtube.com/watch?v=retry",
      status: "failed",
    });
    const dependencies = createDependencies({
      existingRecords: [failedRecord],
    });

    const result = await createVideoRecord(dependencies, {
      actor,
      input: {
        url: "https://www.youtube.com/watch?v=retry",
      },
    });

    assert.equal(result.created, true);
    assert.notEqual(result.record.id, failedRecord.id);
    assert.equal(dependencies.createdRecords.length, 1);
    assert.equal(dependencies.enqueuedJobs.length, 1);
  });

  test("creates a fresh record when the latest matching record was cancelled", async () => {
    const cancelledRecord = createVideoRecordRow({
      id: "44444444-4444-4444-8444-444444444444",
      normalizedUrl: "https://www.youtube.com/watch?v=cancelled",
      status: "cancelled",
    });
    const dependencies = createDependencies({
      existingRecords: [cancelledRecord],
    });

    const result = await createVideoRecord(dependencies, {
      actor,
      input: {
        url: "https://www.youtube.com/watch?v=cancelled",
      },
    });

    assert.equal(result.created, true);
    assert.notEqual(result.record.id, cancelledRecord.id);
    assert.equal(dependencies.createdRecords.length, 1);
    assert.equal(dependencies.enqueuedJobs.length, 1);
  });
});

function createDependencies(options = {}) {
  const records = [...(options.existingRecords ?? [])];
  const createdRecords = [];
  const createdJobEvents = [];
  const createdUsageEvents = [];
  const enqueuedJobs = [];

  return {
    createdJobEvents,
    createdRecords,
    createdUsageEvents,
    enqueuedJobs,
    jobEventsRepository: {
      async create(input) {
        createdJobEvents.push(input);
        return {
          ...input,
          createdAt: new Date("2026-05-23T00:00:00.000Z"),
          id: `job-event-${createdJobEvents.length}`,
        };
      },
    },
    usageEventsRepository: {
      async create(input) {
        createdUsageEvents.push(input);
        return {
          ...input,
          createdAt: new Date("2026-05-23T00:00:00.000Z"),
          id: `usage-event-${createdUsageEvents.length}`,
        };
      },
    },
    videoDigestQueue: {
      async close() {},
      async enqueueVideoDigestJob(payload) {
        enqueuedJobs.push(payload);
      },
    },
    videoRecordsRepository: {
      async create(input) {
        const row = createVideoRecordRow({
          ...input,
          id: `55555555-5555-4555-8555-${String(records.length + 1).padStart(12, "0")}`,
          status: "queued",
        });
        records.push(row);
        createdRecords.push(row);
        return row;
      },
      async findByIdForUser() {
        throw new Error("findByIdForUser is not used in these tests.");
      },
      async findLatestByNormalizedUrlForUser(input) {
        return (
          records.find(
            (record) =>
              record.normalizedUrl === input.normalizedUrl &&
              record.userId === input.userId &&
              record.deletedAt === null,
          ) ?? null
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
      async updateStatusForUser() {
        throw new Error("updateStatusForUser is not used in these tests.");
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
    createdById: actor.id,
    createdByType: "web",
    deletedAt: null,
    durationSeconds: null,
    errorCode: null,
    errorMessage: null,
    fallbackToAudio: false,
    id: "55555555-5555-4555-8555-000000000000",
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
