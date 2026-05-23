import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateVideoRecordInput,
  ListVideoRecordsForUserInput,
  UpdateVideoRecordMetadataForUserInput,
  UpdateVideoRecordStatusForUserInput,
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

type SupabaseUpdateVideoRecordStatusInput = {
  status: VideoRecordRow["status"];
  error_code?: string | null;
  error_message?: string | null;
  completed_at?: string | null;
};

type SupabaseUpdateVideoRecordMetadataInput = {
  title: string | null;
  author: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
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

    async findLatestByNormalizedUrlForUser(input) {
      const { data, error } = await client
        .from("video_records")
        .select("*")
        .eq("user_id", input.userId)
        .eq("normalized_url", input.normalizedUrl)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询重复视频记录失败。", error);
      }

      return data ? mapVideoRecordRow(data as SupabaseVideoRecordRow) : null;
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
      } else if (input.statuses?.length) {
        query = query.in("status", [...input.statuses]);
      }

      if (input.platform) {
        query = query.eq("platform", input.platform);
      }

      const searchFilter = toVideoRecordSearchFilter(input.query);
      if (searchFilter) {
        query = query.or(searchFilter);
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

    async listPageForUser(input) {
      let countQuery = client
        .from("video_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .is("deleted_at", null);

      if (input.status) {
        countQuery = countQuery.eq("status", input.status);
      } else if (input.statuses?.length) {
        countQuery = countQuery.in("status", [...input.statuses]);
      }

      if (input.platform) {
        countQuery = countQuery.eq("platform", input.platform);
      }

      const searchFilter = toVideoRecordSearchFilter(input.query);
      if (searchFilter) {
        countQuery = countQuery.or(searchFilter);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new DatabaseQueryError("统计视频记录列表失败。", countError);
      }

      const total = count ?? 0;
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      if (total === 0 || offset >= total) {
        return {
          records: [],
          total,
        };
      }

      let query = client
        .from("video_records")
        .select("*")
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (input.status) {
        query = query.eq("status", input.status);
      } else if (input.statuses?.length) {
        query = query.in("status", [...input.statuses]);
      }

      if (input.platform) {
        query = query.eq("platform", input.platform);
      }

      if (searchFilter) {
        query = query.or(searchFilter);
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw new DatabaseQueryError("分页查询视频记录列表失败。", error);
      }

      return {
        records: (data ?? []).map((row) =>
          mapVideoRecordRow(row as SupabaseVideoRecordRow),
        ),
        total,
      };
    },

    async updateStatusForUser(input) {
      let query = client
        .from("video_records")
        .update(toSupabaseStatusUpdateInput(input))
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .is("deleted_at", null);

      if (input.expectedStatus) {
        query = query.eq("status", input.expectedStatus);
      }

      const { data, error } = await query.select("*").maybeSingle();

      if (error) {
        throw new DatabaseQueryError("更新视频记录状态失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError(
          "更新视频记录状态失败：记录不存在或状态不匹配。",
          null,
        );
      }

      return mapVideoRecordRow(data as SupabaseVideoRecordRow);
    },

    async updateMetadataForUser(input) {
      const { data, error } = await client
        .from("video_records")
        .update(toSupabaseMetadataUpdateInput(input))
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("更新视频元数据失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError(
          "更新视频元数据失败：记录不存在或已删除。",
          null,
        );
      }

      return mapVideoRecordRow(data as SupabaseVideoRecordRow);
    },
  };
}

const videoRecordSearchColumns = [
  "title",
  "author",
  "source_url",
  "normalized_url",
  "error_code",
  "error_message",
] as const;

function toVideoRecordSearchFilter(query: ListVideoRecordsForUserInput["query"]) {
  const normalizedQuery = query
    ?.trim()
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ");

  if (!normalizedQuery) {
    return null;
  }

  const pattern = `%${normalizedQuery}%`;

  return videoRecordSearchColumns
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
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

function toSupabaseStatusUpdateInput(
  input: UpdateVideoRecordStatusForUserInput,
): SupabaseUpdateVideoRecordStatusInput {
  const updateInput: SupabaseUpdateVideoRecordStatusInput = {
    status: input.status,
  };

  if (input.errorCode !== undefined) {
    updateInput.error_code = input.errorCode;
  }

  if (input.errorMessage !== undefined) {
    updateInput.error_message = input.errorMessage;
  }

  if (input.completedAt !== undefined) {
    updateInput.completed_at = input.completedAt?.toISOString() ?? null;
  }

  return updateInput;
}

function toSupabaseMetadataUpdateInput(
  input: UpdateVideoRecordMetadataForUserInput,
): SupabaseUpdateVideoRecordMetadataInput {
  return {
    title: input.title,
    author: input.author,
    duration_seconds: input.durationSeconds,
    thumbnail_url: input.thumbnailUrl,
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
