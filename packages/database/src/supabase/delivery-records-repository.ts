import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateDeliveryRecordInput,
  DeliveryRecordsRepository,
  UpdateDeliveryRecordStatusForUserInput,
} from "../repositories/delivery-records.js";
import type { DeliveryRecordRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseDeliveryRecordRow = {
  id: string;
  record_id: string;
  user_id: string;
  summary_id: string | null;
  type: DeliveryRecordRow["type"];
  target_id: string;
  status: DeliveryRecordRow["status"];
  subject: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type SupabaseCreateDeliveryRecordInput = {
  record_id: string;
  user_id: string;
  summary_id: string | null;
  type: DeliveryRecordRow["type"];
  target_id: string;
  status: "queued";
  subject: string | null;
};

type SupabaseUpdateDeliveryRecordStatusInput = {
  status: DeliveryRecordRow["status"];
  error_message?: string | null;
  sent_at?: string | null;
};

export function createSupabaseDeliveryRecordsRepository(
  client: SupabaseClient,
): DeliveryRecordsRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("delivery_records")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建投递记录失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建投递记录失败：数据库未返回记录。", null);
      }

      return mapDeliveryRecordRow(data as SupabaseDeliveryRecordRow);
    },

    async updateStatusForUser(input) {
      const { data, error } = await client
        .from("delivery_records")
        .update(toSupabaseUpdateStatusInput(input))
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("更新投递记录状态失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("更新投递记录状态失败：记录不存在。", null);
      }

      return mapDeliveryRecordRow(data as SupabaseDeliveryRecordRow);
    },

    async findLatestForRecord(input) {
      const { data, error } = await client
        .from("delivery_records")
        .select("*")
        .eq("record_id", input.recordId)
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询投递记录失败。", error);
      }

      return data ? mapDeliveryRecordRow(data as SupabaseDeliveryRecordRow) : null;
    },
  };
}

function toSupabaseCreateInput(
  input: CreateDeliveryRecordInput,
): SupabaseCreateDeliveryRecordInput {
  return {
    record_id: input.recordId,
    user_id: input.userId,
    summary_id: input.summaryId,
    type: input.type,
    target_id: input.targetId,
    status: "queued",
    subject: input.subject,
  };
}

function toSupabaseUpdateStatusInput(
  input: UpdateDeliveryRecordStatusForUserInput,
): SupabaseUpdateDeliveryRecordStatusInput {
  const updateInput: SupabaseUpdateDeliveryRecordStatusInput = {
    status: input.status,
  };

  if (input.errorMessage !== undefined) {
    updateInput.error_message = input.errorMessage;
  }

  if (input.sentAt !== undefined) {
    updateInput.sent_at = input.sentAt?.toISOString() ?? null;
  }

  return updateInput;
}

function mapDeliveryRecordRow(row: SupabaseDeliveryRecordRow): DeliveryRecordRow {
  return {
    id: row.id,
    recordId: row.record_id,
    userId: row.user_id,
    summaryId: row.summary_id,
    type: row.type,
    targetId: row.target_id,
    status: row.status,
    subject: row.subject,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  };
}
