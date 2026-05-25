import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateMcpTokenForUserInput,
  McpTokensRepository,
  RevokeMcpTokenForUserInput,
} from "../repositories/mcp-tokens.js";
import type { McpTokenRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseMcpTokenRow = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  token_hash: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type SupabaseCreateMcpTokenInput = {
  user_id: string;
  name: string;
  token_prefix: string;
  token_hash: string;
  scopes: string[];
  expires_at: string | null;
};

export function createSupabaseMcpTokensRepository(
  client: SupabaseClient,
): McpTokensRepository {
  return {
    async createForUser(input) {
      const { data, error } = await client
        .from("mcp_tokens")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建 MCP 令牌失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建 MCP 令牌失败：数据库未返回记录。", null);
      }

      return mapMcpTokenRow(data as SupabaseMcpTokenRow);
    },

    async findActiveByHash(input) {
      const { data, error } = await client
        .from("mcp_tokens")
        .select("*")
        .eq("token_hash", input.tokenHash)
        .is("revoked_at", null)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询 MCP 令牌失败。", error);
      }

      if (!data) {
        return null;
      }

      const token = mapMcpTokenRow(data as SupabaseMcpTokenRow);

      if (token.expiresAt && token.expiresAt.getTime() <= input.now.getTime()) {
        return null;
      }

      return token;
    },

    async listForUser(input) {
      const { data, error } = await client
        .from("mcp_tokens")
        .select("*")
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DatabaseQueryError("查询 MCP 令牌列表失败。", error);
      }

      return (data ?? []).map((row) =>
        mapMcpTokenRow(row as SupabaseMcpTokenRow),
      );
    },

    async revokeForUser(input) {
      const { data, error } = await client
        .from("mcp_tokens")
        .update(toSupabaseRevokeInput(input))
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .is("revoked_at", null)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("撤销 MCP 令牌失败。", error);
      }

      return data ? mapMcpTokenRow(data as SupabaseMcpTokenRow) : null;
    },

    async updateLastUsedAt(input) {
      const { error } = await client
        .from("mcp_tokens")
        .update({ last_used_at: input.lastUsedAt.toISOString() })
        .eq("id", input.id);

      if (error) {
        throw new DatabaseQueryError("更新 MCP 令牌最近使用时间失败。", error);
      }
    },
  };
}

function toSupabaseCreateInput(
  input: CreateMcpTokenForUserInput,
): SupabaseCreateMcpTokenInput {
  return {
    expires_at: input.expiresAt?.toISOString() ?? null,
    name: input.name,
    scopes: input.scopes,
    token_hash: input.tokenHash,
    token_prefix: input.tokenPrefix,
    user_id: input.userId,
  };
}

function toSupabaseRevokeInput(input: RevokeMcpTokenForUserInput) {
  return {
    revoked_at: input.revokedAt.toISOString(),
  };
}

function mapMcpTokenRow(row: SupabaseMcpTokenRow): McpTokenRow {
  return {
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    id: row.id,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    name: row.name,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    scopes: row.scopes,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    userId: row.user_id,
  };
}
