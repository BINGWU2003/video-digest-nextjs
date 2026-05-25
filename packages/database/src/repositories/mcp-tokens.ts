import type { McpTokenRow } from "../tables.js";

export type { McpTokenRow } from "../tables.js";

export type CreateMcpTokenForUserInput = {
  /** Token 所属用户 ID。 */
  userId: string;
  /** 设置页展示名称。 */
  name: string;
  /** 可展示的 token 前缀，不可用于鉴权。 */
  tokenPrefix: string;
  /** 明文 token 的 hash。 */
  tokenHash: string;
  /** token 权限范围。 */
  scopes: string[];
  /** 过期时间；为空表示长期有效。 */
  expiresAt?: Date | null;
};

export type FindActiveMcpTokenByHashInput = {
  /** 明文 token 的 hash。 */
  tokenHash: string;
  /** 当前时间，用于判断过期。 */
  now: Date;
};

export type ListMcpTokensForUserInput = {
  /** Token 所属用户 ID。 */
  userId: string;
};

export type RevokeMcpTokenForUserInput = {
  /** Token 记录 ID。 */
  id: string;
  /** Token 所属用户 ID。 */
  userId: string;
  /** 撤销时间。 */
  revokedAt: Date;
};

export type UpdateMcpTokenLastUsedAtInput = {
  /** Token 记录 ID。 */
  id: string;
  /** 最近一次成功使用时间。 */
  lastUsedAt: Date;
};

export type McpTokensRepository = {
  /** 创建一枚 MCP token，只保存 hash 和展示前缀。 */
  createForUser(input: CreateMcpTokenForUserInput): Promise<McpTokenRow>;
  /** 通过 hash 查找未撤销且未过期的 token。 */
  findActiveByHash(
    input: FindActiveMcpTokenByHashInput,
  ): Promise<McpTokenRow | null>;
  /** 列出用户的 MCP token，用于设置页展示。 */
  listForUser(input: ListMcpTokensForUserInput): Promise<McpTokenRow[]>;
  /** 撤销用户自己的 MCP token。 */
  revokeForUser(input: RevokeMcpTokenForUserInput): Promise<McpTokenRow | null>;
  /** 更新最近成功使用时间。 */
  updateLastUsedAt(input: UpdateMcpTokenLastUsedAtInput): Promise<void>;
};
