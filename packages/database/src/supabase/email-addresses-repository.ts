import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EmailAddressesRepository,
  UpdateEmailAddressLastSentAtInput,
} from "../repositories/email-addresses.js";
import type { EmailAddressRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseEmailAddressRow = {
  id: string;
  user_id: string;
  email: string;
  status: EmailAddressRow["status"];
  is_default: boolean;
  verification_token_hash: string | null;
  verification_sent_at: string | null;
  verified_at: string | null;
  last_sent_at: string | null;
  created_at: string;
};

type SupabaseUpdateEmailAddressLastSentAtInput = {
  last_sent_at: string;
};

export function createSupabaseEmailAddressesRepository(
  client: SupabaseClient,
): EmailAddressesRepository {
  return {
    async findDefaultVerifiedForUser(input) {
      const { data, error } = await client
        .from("email_addresses")
        .select("*")
        .eq("user_id", input.userId)
        .eq("status", "verified")
        .eq("is_default", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询默认已验证邮箱失败。", error);
      }

      return data ? mapEmailAddressRow(data as SupabaseEmailAddressRow) : null;
    },

    async updateLastSentAt(input) {
      const { data, error } = await client
        .from("email_addresses")
        .update(toSupabaseUpdateLastSentAtInput(input))
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .eq("status", "verified")
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("更新邮箱最近发送时间失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError(
          "更新邮箱最近发送时间失败：邮箱不存在或未验证。",
          null,
        );
      }

      return mapEmailAddressRow(data as SupabaseEmailAddressRow);
    },
  };
}

function toSupabaseUpdateLastSentAtInput(
  input: UpdateEmailAddressLastSentAtInput,
): SupabaseUpdateEmailAddressLastSentAtInput {
  return {
    last_sent_at: input.lastSentAt.toISOString(),
  };
}

function mapEmailAddressRow(row: SupabaseEmailAddressRow): EmailAddressRow {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    status: row.status,
    isDefault: row.is_default,
    verificationTokenHash: row.verification_token_hash,
    verificationSentAt: row.verification_sent_at
      ? new Date(row.verification_sent_at)
      : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    lastSentAt: row.last_sent_at ? new Date(row.last_sent_at) : null,
    createdAt: new Date(row.created_at),
  };
}
