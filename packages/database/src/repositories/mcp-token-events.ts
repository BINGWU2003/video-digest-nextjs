import type { McpTokenEventStatus } from "../schema.js";
import type { McpTokenEventRow } from "../tables.js";

export type { McpTokenEventRow } from "../tables.js";

export type CreateMcpTokenEventInput = {
  /** 调用所属用户 ID。 */
  userId: string;
  /** 关联 token ID。 */
  tokenId: string;
  /** 调用发生时的 token 展示前缀。 */
  tokenPrefix: string;
  /** 被调用的 MCP tool 名称。 */
  toolName: string;
  /** 调用结果。 */
  status: McpTokenEventStatus;
  /** 结构化错误码。 */
  errorCode?: string | null;
  /** 错误说明。 */
  errorMessage?: string | null;
  /** 调用耗时，单位毫秒。 */
  durationMs?: number;
};

export type ListMcpTokenEventsForUserInput = {
  /** 调用所属用户 ID。 */
  userId: string;
  /** 返回条数。 */
  limit?: number;
};

export type ListMcpTokenEventStatsForUserInput = {
  /** 调用所属用户 ID。 */
  userId: string;
  /** 需要统计的 token ID。 */
  tokenIds: string[];
};

export type McpTokenEventStats = {
  tokenId: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  latestEvent: McpTokenEventRow | null;
};

export type McpTokenEventsRepository = {
  /** 创建一条 MCP token 调用审计事件。 */
  create(input: CreateMcpTokenEventInput): Promise<McpTokenEventRow>;
  /** 查询用户最近的 MCP token 调用事件。 */
  listForUser(
    input: ListMcpTokenEventsForUserInput,
  ): Promise<McpTokenEventRow[]>;
  /** 查询设置页展示所需的 token 调用统计。 */
  listStatsForUserTokenIds(
    input: ListMcpTokenEventStatsForUserInput,
  ): Promise<McpTokenEventStats[]>;
};
