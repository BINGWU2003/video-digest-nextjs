import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateVideoRecordInput,
  VideoRecordsRepository,
} from "../repositories/video-records.js";
import type { VideoRecordRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseVideoRecordRow = {
  id: string;
  user_id: string;
  source_url: string;
  normalized_url: string;
  platform: VideoRecordRow["platform"];
  title: string | null;
  author: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  status: VideoRecordRow["status"];
  transcript_source: VideoRecordRow["transcriptSource"];
  output_mode: VideoRecordRow["outputMode"];
  fallback_to_audio: boolean;
  send_email: boolean;
  created_by_type: VideoRecordRow["createdByType"];
  created_by_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

type SupabaseCreateVideoRecordInput = {
  user_id: string;
  source_url: string;
  normalized_url: string;
  platform: VideoRecordRow["platform"];
  output_mode: VideoRecordRow["outputMode"];
  fallback_to_audio: boolean;
  send_email: boolean;
  created_by_type: VideoRecordRow["createdByType"];
  created_by_id: string | null;
};

export function createSupabaseVideoRecordsRepository(
  client: SupabaseClient,
): VideoRecordsRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("video_records")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建视频记录失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建视频记录失败：数据库未返回记录。", null);
      }

      return mapVideoRecordRow(data as SupabaseVideoRecordRow);
    },

    async findByIdForUser(input) {
      const { data, error } = await client
        .from("video_records")
        .select("*")
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询视频记录失败。", error);
      }

      return data ? mapVideoRecordRow(data as SupabaseVideoRecordRow) : null;
    },

    async listForUser(input) {
      let query = client
        .from("video_records")
        .select("*")
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (input.status) {
        query = query.eq("status", input.status);
      }

      if (input.platform) {
        query = query.eq("platform", input.platform);
      }

      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw new DatabaseQueryError("查询视频记录列表失败。", error);
      }

      return (data ?? []).map((row) =>
        mapVideoRecordRow(row as SupabaseVideoRecordRow),
      );
    },
  };
}

function toSupabaseCreateInput(
  input: CreateVideoRecordInput,
): SupabaseCreateVideoRecordInput {
  return {
    user_id: input.userId,
    source_url: input.sourceUrl,
    normalized_url: input.normalizedUrl,
    platform: input.platform,
    output_mode: input.outputMode,
    fallback_to_audio: input.fallbackToAudio,
    send_email: input.sendEmail,
    created_by_type: input.createdByType,
    created_by_id: input.createdById,
  };
}

function mapVideoRecordRow(row: SupabaseVideoRecordRow): VideoRecordRow {
  return {
    id: row.id,
    userId: row.user_id,
    sourceUrl: row.source_url,
    normalizedUrl: row.normalized_url,
    platform: row.platform,
    title: row.title,
    author: row.author,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    transcriptSource: row.transcript_source,
    outputMode: row.output_mode,
    fallbackToAudio: row.fallback_to_audio,
    sendEmail: row.send_email,
    createdByType: row.created_by_type,
    createdById: row.created_by_id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}
