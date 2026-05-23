import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateJobEventInput,
  JobEventsRepository,
} from "../repositories/job-events.js";
import type { JobEventRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseJobEventRow = {
  id: string;
  record_id: string;
  user_id: string;
  status: JobEventRow["status"];
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SupabaseCreateJobEventInput = {
  record_id: string;
  user_id: string;
  status: JobEventRow["status"];
  message: string | null;
  metadata: Record<string, unknown>;
};

export function createSupabaseJobEventsRepository(
  client: SupabaseClient,
): JobEventsRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("job_events")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建任务事件失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建任务事件失败：数据库未返回记录。", null);
      }

      return mapJobEventRow(data as SupabaseJobEventRow);
    },

    async listForRecord(input) {
      const limit = input.limit ?? 100;
      const { data, error } = await client
        .from("job_events")
        .select("*")
        .eq("record_id", input.recordId)
        .eq("user_id", input.userId)
        .order("created_at", { ascending: true })
        .range(0, limit - 1);

      if (error) {
        throw new DatabaseQueryError("查询任务事件列表失败。", error);
      }

      return (data ?? []).map((row) =>
        mapJobEventRow(row as SupabaseJobEventRow),
      );
    },
  };
}

function toSupabaseCreateInput(
  input: CreateJobEventInput,
): SupabaseCreateJobEventInput {
  return {
    record_id: input.recordId,
    user_id: input.userId,
    status: input.status,
    message: input.message ?? null,
    metadata: input.metadata ?? {},
  };
}

function mapJobEventRow(row: SupabaseJobEventRow): JobEventRow {
  return {
    id: row.id,
    recordId: row.record_id,
    userId: row.user_id,
    status: row.status,
    message: row.message,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
  };
}
