import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateUsageEventInput,
  UsageEventsRepository,
} from "../repositories/usage-events.js";
import type { UsageEventRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseUsageEventRow = {
  id: string;
  user_id: string;
  record_id: string | null;
  event_type: UsageEventRow["eventType"];
  quantity: number;
  unit: UsageEventRow["unit"];
  created_at: string;
};

type SupabaseCreateUsageEventInput = {
  user_id: string;
  record_id: string | null;
  event_type: UsageEventRow["eventType"];
  quantity: number;
  unit: UsageEventRow["unit"];
};

export function createSupabaseUsageEventsRepository(
  client: SupabaseClient,
): UsageEventsRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("usage_events")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建用量事件失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建用量事件失败：数据库未返回记录。", null);
      }

      return mapUsageEventRow(data as SupabaseUsageEventRow);
    },
  };
}

function toSupabaseCreateInput(
  input: CreateUsageEventInput,
): SupabaseCreateUsageEventInput {
  return {
    user_id: input.userId,
    record_id: input.recordId ?? null,
    event_type: input.eventType,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? "count",
  };
}

function mapUsageEventRow(row: SupabaseUsageEventRow): UsageEventRow {
  return {
    id: row.id,
    userId: row.user_id,
    recordId: row.record_id,
    eventType: row.event_type,
    quantity: row.quantity,
    unit: row.unit,
    createdAt: new Date(row.created_at),
  };
}
