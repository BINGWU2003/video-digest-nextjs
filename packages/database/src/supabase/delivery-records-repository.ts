import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateDeliveryRecordInput,
  DeliveryRecordListItem,
  DeliveryRecordsRepository,
  UpdateDeliveryRecordStatusByProviderMessageIdInput,
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
  provider_message_id: string | null;
  provider_event_type: string | null;
  provider_event_at: string | null;
  status: DeliveryRecordRow["status"];
  subject: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type SupabaseDeliveryRecordWithVideoRow = SupabaseDeliveryRecordRow & {
  video_records:
    | {
        id: string;
        source_url: string;
        title: string | null;
      }
    | null;
};

type SupabaseEmailAddressLookupRow = {
  id: string;
  email: string;
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
  provider_message_id?: string | null;
  provider_event_type?: string | null;
  provider_event_at?: string | null;
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

    async listForRecord(input) {
      const { data, error } = await client
        .from("delivery_records")
        .select("*")
        .eq("record_id", input.recordId)
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 5);

      if (error) {
        throw new DatabaseQueryError("查询投递历史失败。", error);
      }

      return (data ?? []).map((row) =>
        mapDeliveryRecordRow(row as SupabaseDeliveryRecordRow),
      );
    },

    async listPageForUser(input) {
      const { count, error: countError } = await client
        .from("delivery_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId);

      if (countError) {
        throw new DatabaseQueryError("统计投递记录列表失败。", countError);
      }

      const total = count ?? 0;
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;

      if (total === 0 || offset >= total) {
        return {
          records: [],
          total,
        };
      }

      const { data, error } = await client
        .from("delivery_records")
        .select(
          `
          *,
          video_records (
            id,
            source_url,
            title
          )
        `,
        )
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new DatabaseQueryError("分页查询投递记录列表失败。", error);
      }

      const rows = (data ?? []) as SupabaseDeliveryRecordWithVideoRow[];
      const targetEmailById = await loadTargetEmails(
        client,
        input.userId,
        rows
          .filter((row) => row.type === "email")
          .map((row) => row.target_id),
      );

      return {
        records: rows.map((row) =>
          mapDeliveryRecordListItem(row, targetEmailById),
        ),
        total,
      };
    },

    async updateStatusByProviderMessageId(input) {
      const { data, error } = await client
        .from("delivery_records")
        .update(toSupabaseProviderStatusInput(input))
        .eq("provider_message_id", input.providerMessageId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("同步投递 webhook 状态失败。", error);
      }

      return data ? mapDeliveryRecordRow(data as SupabaseDeliveryRecordRow) : null;
    },
  };
}

async function loadTargetEmails(
  client: SupabaseClient,
  userId: string,
  targetIds: string[],
) {
  const uniqueTargetIds = [...new Set(targetIds)];

  if (uniqueTargetIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await client
    .from("email_addresses")
    .select("id,email")
    .eq("user_id", userId)
    .in("id", uniqueTargetIds);

  if (error) {
    throw new DatabaseQueryError("查询投递目标邮箱失败。", error);
  }

  return new Map(
    ((data ?? []) as SupabaseEmailAddressLookupRow[]).map((row) => [
      row.id,
      row.email,
    ]),
  );
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

  if (input.providerMessageId !== undefined) {
    updateInput.provider_message_id = input.providerMessageId;
  }

  if (input.providerEventType !== undefined) {
    updateInput.provider_event_type = input.providerEventType;
  }

  if (input.providerEventAt !== undefined) {
    updateInput.provider_event_at = input.providerEventAt?.toISOString() ?? null;
  }

  if (input.errorMessage !== undefined) {
    updateInput.error_message = input.errorMessage;
  }

  if (input.sentAt !== undefined) {
    updateInput.sent_at = input.sentAt?.toISOString() ?? null;
  }

  return updateInput;
}

function toSupabaseProviderStatusInput(
  input: UpdateDeliveryRecordStatusByProviderMessageIdInput,
): SupabaseUpdateDeliveryRecordStatusInput {
  return {
    error_message: input.errorMessage,
    provider_event_at: input.providerEventAt.toISOString(),
    provider_event_type: input.providerEventType,
    sent_at: input.sentAt?.toISOString() ?? undefined,
    status: input.status,
  };
}

function mapDeliveryRecordRow(row: SupabaseDeliveryRecordRow): DeliveryRecordRow {
  return {
    id: row.id,
    recordId: row.record_id,
    userId: row.user_id,
    summaryId: row.summary_id,
    type: row.type,
    targetId: row.target_id,
    providerMessageId: row.provider_message_id,
    providerEventType: row.provider_event_type,
    providerEventAt: row.provider_event_at
      ? new Date(row.provider_event_at)
      : null,
    status: row.status,
    subject: row.subject,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  };
}

function mapDeliveryRecordListItem(
  row: SupabaseDeliveryRecordWithVideoRow,
  targetEmailById: Map<string, string>,
): DeliveryRecordListItem {
  return {
    deliveryRecord: mapDeliveryRecordRow(row),
    targetEmail:
      row.type === "email" ? (targetEmailById.get(row.target_id) ?? null) : null,
    videoRecord: row.video_records
      ? {
          id: row.video_records.id,
          sourceUrl: row.video_records.source_url,
          title: row.video_records.title,
        }
      : null,
  };
}
