import type {
  OutputMode,
  RecordCreatorType,
  VideoPlatform,
} from "../schema.js";
import type { VideoRecordRow } from "../tables.js";

export type { VideoRecordRow } from "../tables.js";

export type CreateVideoRecordInput = {
  /** Owner user id from Supabase Auth. */
  userId: string;
  /** Original video URL submitted by the user or agent. */
  sourceUrl: string;
  /** Normalized video URL used for duplicate detection and search. */
  normalizedUrl: string;
  /** Source platform for the submitted video. */
  platform: VideoPlatform;
  /** Requested output mode for this task. */
  outputMode: OutputMode;
  /** Whether the worker may use audio extraction and ASR when subtitles are unavailable. */
  fallbackToAudio: boolean;
  /** Whether this task should send the summary to the user's default verified email. */
  sendEmail: boolean;
  /** Source that created this record. */
  createdByType: RecordCreatorType;
  /** Creator identifier, such as MCP token id or user id. */
  createdById: string | null;
};

export type VideoRecordsRepository = {
  /** Create a queued video record and return the persisted row. */
  create(input: CreateVideoRecordInput): Promise<VideoRecordRow>;
  /** Find a visible record by id within the given user's ownership boundary. */
  findByIdForUser(input: {
    /** Video record id. */
    id: string;
    /** Owner user id from Supabase Auth. */
    userId: string;
  }): Promise<VideoRecordRow | null>;
};
