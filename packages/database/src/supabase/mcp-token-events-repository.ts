import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateMcpTokenEventInput,
  McpTokenEventStats,
  McpTokenEventsRepository,
} from "../repositories/mcp-token-events.js";
import type { McpTokenEventRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseMcpTokenEventRow = {
  id: string;
  user_id: string;
  token_id: string | null;
  token_prefix: string | null;
  tool_name: string;
  status: McpTokenEventRow["status"];
  error_code: string | null;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
};

type SupabaseCreateMcpTokenEventInput = {
  user_id: string;
  token_id: string;
  token_prefix: string;
  tool_name: string;
  status: McpTokenEventRow["status"];
  error_code: string | null;
  error_message: string | null;
  duration_ms: number;
};

export function createSupabaseMcpTokenEventsRepository(
  client: SupabaseClient,
): McpTokenEventsRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("mcp_token_events")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建 MCP 调用审计事件失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError(
          "创建 MCP 调用审计事件失败：数据库未返回记录。",
          null,
        );
      }

      return mapMcpTokenEventRow(data as SupabaseMcpTokenEventRow);
    },

    async listForUser(input) {
      const { data, error } = await client
        .from("mcp_token_events")
        .select("*")
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 20);

      if (error) {
        throw new DatabaseQueryError("查询 MCP 调用审计事件失败。", error);
      }

      return (data ?? []).map((row) =>
        mapMcpTokenEventRow(row as SupabaseMcpTokenEventRow),
      );
    },

    async listStatsForUserTokenIds(input) {
      if (input.tokenIds.length === 0) {
        return [];
      }

      const [latestEvents, countRows] = await Promise.all([
        listLatestEventsForTokenIds(client, input.userId, input.tokenIds),
        listCountRowsForTokenIds(client, input.userId, input.tokenIds),
      ]);
      const latestEventByTokenId = new Map(
        latestEvents
          .filter((event) => event.tokenId)
          .map((event) => [event.tokenId as string, event]),
      );
      const statsByTokenId = new Map<string, McpTokenEventStats>(
        input.tokenIds.map((tokenId) => [
          tokenId,
          {
            failureCount: 0,
            latestEvent: latestEventByTokenId.get(tokenId) ?? null,
            successCount: 0,
            tokenId,
            totalCount: 0,
          },
        ]),
      );

      for (const row of countRows) {
        const tokenId = row.token_id;
        const stats = statsByTokenId.get(tokenId);

        if (!stats) {
          continue;
        }

        const count = Number(row.count);
        stats.totalCount += count;

        if (row.status === "success") {
          stats.successCount += count;
        } else {
          stats.failureCount += count;
        }
      }

      return [...statsByTokenId.values()];
    },
  };
}

type SupabaseMcpTokenEventCountRow = {
  token_id: string;
  status: McpTokenEventRow["status"];
  count: number | string;
};

async function listLatestEventsForTokenIds(
  client: SupabaseClient,
  userId: string,
  tokenIds: string[],
) {
  const { data, error } = await client
    .from("mcp_token_events")
    .select("*")
    .eq("user_id", userId)
    .in("token_id", tokenIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(tokenIds.length * 5, tokenIds.length));

  if (error) {
    throw new DatabaseQueryError("查询 MCP token 最近调用失败。", error);
  }

  const latestByTokenId = new Map<string, McpTokenEventRow>();

  for (const row of (data ?? []) as SupabaseMcpTokenEventRow[]) {
    const event = mapMcpTokenEventRow(row);

    if (event.tokenId && !latestByTokenId.has(event.tokenId)) {
      latestByTokenId.set(event.tokenId, event);
    }
  }

  return [...latestByTokenId.values()];
}

async function listCountRowsForTokenIds(
  client: SupabaseClient,
  userId: string,
  tokenIds: string[],
) {
  const { data, error } = await client.rpc("get_mcp_token_event_counts", {
    p_token_ids: tokenIds,
    p_user_id: userId,
  });

  if (error) {
    throw new DatabaseQueryError("统计 MCP token 调用次数失败。", error);
  }

  return (data ?? []) as SupabaseMcpTokenEventCountRow[];
}

function toSupabaseCreateInput(
  input: CreateMcpTokenEventInput,
): SupabaseCreateMcpTokenEventInput {
  return {
    duration_ms: Math.max(0, Math.round(input.durationMs ?? 0)),
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    status: input.status,
    token_id: input.tokenId,
    token_prefix: input.tokenPrefix,
    tool_name: input.toolName,
    user_id: input.userId,
  };
}

function mapMcpTokenEventRow(
  row: SupabaseMcpTokenEventRow,
): McpTokenEventRow {
  return {
    createdAt: new Date(row.created_at),
    durationMs: row.duration_ms,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    id: row.id,
    status: row.status,
    tokenId: row.token_id,
    tokenPrefix: row.token_prefix,
    toolName: row.tool_name,
    userId: row.user_id,
  };
}
