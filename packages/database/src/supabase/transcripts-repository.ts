import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateTranscriptInput,
  TranscriptsRepository,
} from "../repositories/transcripts.js";
import type { TranscriptRow, TranscriptSegmentRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseTranscriptRow = {
  id: string;
  record_id: string;
  user_id: string;
  language: string | null;
  source: TranscriptRow["source"];
  plain_text: string | null;
  storage_key: string | null;
  segment_count: number;
  created_at: string;
};

type SupabaseTranscriptSegmentRow = {
  id: string;
  transcript_id: string;
  record_id: string;
  user_id: string;
  start_seconds: number | null;
  end_seconds: number | null;
  text: string;
  sort_order: number;
};

type SupabaseCreateTranscriptInput = {
  record_id: string;
  user_id: string;
  language: string | null;
  source: TranscriptRow["source"];
  plain_text: string | null;
  storage_key: string | null;
  segment_count: number;
};

type SupabaseCreateTranscriptSegmentInput = {
  transcript_id: string;
  record_id: string;
  user_id: string;
  start_seconds: number | null;
  end_seconds: number | null;
  text: string;
  sort_order: number;
};

export function createSupabaseTranscriptsRepository(
  client: SupabaseClient,
): TranscriptsRepository {
  return {
    async create(input) {
      const { data: transcriptData, error: transcriptError } = await client
        .from("transcripts")
        .insert(toSupabaseCreateTranscriptInput(input))
        .select("*")
        .single();

      if (transcriptError) {
        throw new DatabaseQueryError("创建字幕记录失败。", transcriptError);
      }

      if (!transcriptData) {
        throw new DatabaseQueryError("创建字幕记录失败：数据库未返回记录。", null);
      }

      const transcript = mapTranscriptRow(
        transcriptData as SupabaseTranscriptRow,
      );

      if (input.segments.length === 0) {
        return {
          transcript,
          segments: [],
        };
      }

      const { data: segmentData, error: segmentError } = await client
        .from("transcript_segments")
        .insert(toSupabaseCreateTranscriptSegmentInputs(input, transcript.id))
        .select("*");

      if (segmentError) {
        throw new DatabaseQueryError("创建字幕分段失败。", segmentError);
      }

      return {
        transcript,
        segments: (segmentData ?? []).map((row) =>
          mapTranscriptSegmentRow(row as SupabaseTranscriptSegmentRow),
        ),
      };
    },
  };
}

function toSupabaseCreateTranscriptInput(
  input: CreateTranscriptInput,
): SupabaseCreateTranscriptInput {
  return {
    record_id: input.recordId,
    user_id: input.userId,
    language: input.language,
    source: input.source,
    plain_text: input.plainText,
    storage_key: input.storageKey,
    segment_count: input.segments.length,
  };
}

function toSupabaseCreateTranscriptSegmentInputs(
  input: CreateTranscriptInput,
  transcriptId: string,
): SupabaseCreateTranscriptSegmentInput[] {
  return input.segments.map((segment) => ({
    transcript_id: transcriptId,
    record_id: input.recordId,
    user_id: input.userId,
    start_seconds: segment.startSeconds,
    end_seconds: segment.endSeconds,
    text: segment.text,
    sort_order: segment.sortOrder,
  }));
}

function mapTranscriptRow(row: SupabaseTranscriptRow): TranscriptRow {
  return {
    id: row.id,
    recordId: row.record_id,
    userId: row.user_id,
    language: row.language,
    source: row.source,
    plainText: row.plain_text,
    storageKey: row.storage_key,
    segmentCount: row.segment_count,
    createdAt: new Date(row.created_at),
  };
}

function mapTranscriptSegmentRow(
  row: SupabaseTranscriptSegmentRow,
): TranscriptSegmentRow {
  return {
    id: row.id,
    transcriptId: row.transcript_id,
    recordId: row.record_id,
    userId: row.user_id,
    startSeconds: row.start_seconds,
    endSeconds: row.end_seconds,
    text: row.text,
    sortOrder: row.sort_order,
  };
}
