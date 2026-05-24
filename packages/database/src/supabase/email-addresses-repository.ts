import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DeleteEmailAddressForUserInput,
  EnsureVerifiedDefaultEmailAddressForUserInput,
  EmailAddressesRepository,
  RequestEmailAddressVerificationForUserInput,
  SetDefaultVerifiedEmailAddressForUserInput,
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

type SupabaseEnsureVerifiedDefaultEmailAddressInput = {
  email: string;
  is_default: true;
  status: "verified";
  user_id: string;
  verified_at: string;
};

type SupabaseRequestEmailAddressVerificationInput = {
  email: string;
  is_default: false;
  status: "pending";
  user_id: string;
  verification_sent_at: string;
  verification_token_hash: string;
  verified_at: null;
};

export function createSupabaseEmailAddressesRepository(
  client: SupabaseClient,
): EmailAddressesRepository {
  return {
    async listForUser(input) {
      const { data, error } = await client
        .from("email_addresses")
        .select("*")
        .eq("user_id", input.userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw new DatabaseQueryError("查询邮箱列表失败。", error);
      }

      return (data ?? []).map((row) =>
        mapEmailAddressRow(row as SupabaseEmailAddressRow),
      );
    },

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

    async ensureVerifiedDefaultForUser(input) {
      await clearDefaultEmailAddress(client, input.userId);

      const existingEmailAddress = await findEmailAddressByEmail(client, input);
      const verifiedAt = new Date();

      if (existingEmailAddress) {
        const { data, error } = await client
          .from("email_addresses")
          .update({
            is_default: true,
            status: "verified",
            verified_at: verifiedAt.toISOString(),
          })
          .eq("id", existingEmailAddress.id)
          .eq("user_id", input.userId)
          .select("*")
          .single();

        if (error) {
          throw new DatabaseQueryError("更新默认邮箱失败。", error);
        }

        return mapEmailAddressRow(data as SupabaseEmailAddressRow);
      }

      const { data, error } = await client
        .from("email_addresses")
        .insert(toSupabaseEnsureVerifiedDefaultInput(input, verifiedAt))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建默认邮箱失败。", error);
      }

      return mapEmailAddressRow(data as SupabaseEmailAddressRow);
    },

    async requestVerificationForUser(input) {
      const existingEmailAddress = await findEmailAddressByEmail(client, input);

      if (existingEmailAddress?.status === "verified") {
        return existingEmailAddress;
      }

      if (existingEmailAddress) {
        const { data, error } = await client
          .from("email_addresses")
          .update(toSupabaseRequestVerificationUpdateInput(input))
          .eq("id", existingEmailAddress.id)
          .eq("user_id", input.userId)
          .select("*")
          .single();

        if (error) {
          throw new DatabaseQueryError("更新邮箱验证请求失败。", error);
        }

        return mapEmailAddressRow(data as SupabaseEmailAddressRow);
      }

      const { data, error } = await client
        .from("email_addresses")
        .insert(toSupabaseRequestVerificationInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建邮箱验证请求失败。", error);
      }

      return mapEmailAddressRow(data as SupabaseEmailAddressRow);
    },

    async verifyForUser(input) {
      const { data, error } = await client
        .from("email_addresses")
        .update({
          status: "verified",
          verification_token_hash: null,
          verified_at: input.verifiedAt.toISOString(),
        })
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .eq("status", "pending")
        .eq("verification_token_hash", input.verificationTokenHash)
        .gte("verification_sent_at", input.verificationSentAfter.toISOString())
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("验证邮箱失败。", error);
      }

      return data ? mapEmailAddressRow(data as SupabaseEmailAddressRow) : null;
    },

    async setDefaultVerifiedForUser(input) {
      const targetEmailAddress = await findVerifiedEmailAddressById(client, input);

      if (!targetEmailAddress) {
        throw new DatabaseQueryError("设为默认邮箱失败：邮箱不存在或未验证。", null);
      }

      await clearDefaultEmailAddress(client, input.userId);

      const { data, error } = await client
        .from("email_addresses")
        .update({ is_default: true })
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .eq("status", "verified")
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("设为默认邮箱失败。", error);
      }

      return mapEmailAddressRow(data as SupabaseEmailAddressRow);
    },

    async deleteForUser(input) {
      await assertEmailAddressBelongsToUser(client, input);

      const { error } = await client
        .from("email_addresses")
        .delete()
        .eq("id", input.id)
        .eq("user_id", input.userId);

      if (error) {
        throw new DatabaseQueryError("删除邮箱失败。", error);
      }
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

async function clearDefaultEmailAddress(client: SupabaseClient, userId: string) {
  const { error } = await client
    .from("email_addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);

  if (error) {
    throw new DatabaseQueryError("清理默认邮箱失败。", error);
  }
}

async function findEmailAddressByEmail(
  client: SupabaseClient,
  input:
    | EnsureVerifiedDefaultEmailAddressForUserInput
    | RequestEmailAddressVerificationForUserInput,
) {
  const { data, error } = await client
    .from("email_addresses")
    .select("*")
    .eq("user_id", input.userId)
    .ilike("email", input.email)
    .maybeSingle();

  if (error) {
    throw new DatabaseQueryError("查询邮箱失败。", error);
  }

  return data ? mapEmailAddressRow(data as SupabaseEmailAddressRow) : null;
}

async function assertEmailAddressBelongsToUser(
  client: SupabaseClient,
  input: DeleteEmailAddressForUserInput,
) {
  const { data, error } = await client
    .from("email_addresses")
    .select("id")
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new DatabaseQueryError("查询邮箱失败。", error);
  }

  if (!data) {
    throw new DatabaseQueryError("删除邮箱失败：邮箱不存在。", null);
  }
}

async function findVerifiedEmailAddressById(
  client: SupabaseClient,
  input: SetDefaultVerifiedEmailAddressForUserInput,
) {
  const { data, error } = await client
    .from("email_addresses")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .eq("status", "verified")
    .maybeSingle();

  if (error) {
    throw new DatabaseQueryError("查询已验证邮箱失败。", error);
  }

  return data ? mapEmailAddressRow(data as SupabaseEmailAddressRow) : null;
}

function toSupabaseEnsureVerifiedDefaultInput(
  input: EnsureVerifiedDefaultEmailAddressForUserInput,
  verifiedAt: Date,
): SupabaseEnsureVerifiedDefaultEmailAddressInput {
  return {
    email: input.email,
    is_default: true,
    status: "verified",
    user_id: input.userId,
    verified_at: verifiedAt.toISOString(),
  };
}

function toSupabaseRequestVerificationInput(
  input: RequestEmailAddressVerificationForUserInput,
): SupabaseRequestEmailAddressVerificationInput {
  return {
    email: input.email,
    is_default: false,
    status: "pending",
    user_id: input.userId,
    verification_sent_at: input.verificationSentAt.toISOString(),
    verification_token_hash: input.verificationTokenHash,
    verified_at: null,
  };
}

function toSupabaseRequestVerificationUpdateInput(
  input: RequestEmailAddressVerificationForUserInput,
): Omit<SupabaseRequestEmailAddressVerificationInput, "email" | "user_id"> {
  return {
    is_default: false,
    status: "pending",
    verification_sent_at: input.verificationSentAt.toISOString(),
    verification_token_hash: input.verificationTokenHash,
    verified_at: null,
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
