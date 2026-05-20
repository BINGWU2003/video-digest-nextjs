import type {
  OutputMode,
  RecordCreatorType,
  VideoRecordStatus,
  VideoPlatform,
} from "../schema.js";
import type { VideoRecordRow } from "../tables.js";

export type { VideoRecordRow } from "../tables.js";

export type CreateVideoRecordInput = {
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 用户或 agent 原始提交的视频链接。 */
  sourceUrl: string;
  /** 归一化后的视频链接，用于重复检测和搜索。 */
  normalizedUrl: string;
  /** 提交视频的来源平台。 */
  platform: VideoPlatform;
  /** 本次任务请求的输出模式。 */
  outputMode: OutputMode;
  /** 没有可用字幕时，worker 是否可以提取音频并使用 ASR。 */
  fallbackToAudio: boolean;
  /** 本次任务是否需要把摘要发送到用户默认已验证邮箱。 */
  sendEmail: boolean;
  /** 创建这条记录的来源。 */
  createdByType: RecordCreatorType;
  /** 创建者标识，例如 MCP token ID 或用户 ID。 */
  createdById: string | null;
};

export type ListVideoRecordsForUserInput = {
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 可选状态过滤。 */
  status?: VideoRecordRow["status"];
  /** 可选平台过滤。 */
  platform?: VideoPlatform;
  /** 返回记录数，默认由具体 repository 决定。 */
  limit?: number;
  /** 跳过记录数，用于分页。 */
  offset?: number;
};

export type UpdateVideoRecordStatusForUserInput = {
  /** 视频记录 ID。 */
  id: string;
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 要写入的视频处理状态。 */
  status: VideoRecordStatus;
  /** 可选的当前状态前置条件，用于避免覆盖非预期状态。 */
  expectedStatus?: VideoRecordStatus;
  /** 结构化失败码；非失败状态通常传 null 清空。 */
  errorCode?: string | null;
  /** 面向用户或运维排查的失败说明；非失败状态通常传 null 清空。 */
  errorMessage?: string | null;
  /** 任务完成、失败或取消时间；进行中状态通常传 null 清空。 */
  completedAt?: Date | null;
};

export type VideoRecordsRepository = {
  /** 创建一条排队中的视频记录，并返回已持久化的数据行。 */
  create(input: CreateVideoRecordInput): Promise<VideoRecordRow>;
  /** 在指定用户的数据边界内按 ID 查找一条可见记录。 */
  findByIdForUser(input: {
    /** 视频记录 ID。 */
    id: string;
    /** 记录所属用户 ID，来自 Supabase Auth。 */
    userId: string;
  }): Promise<VideoRecordRow | null>;
  /** 按用户查询可见视频记录列表，默认按创建时间倒序。 */
  listForUser(input: ListVideoRecordsForUserInput): Promise<VideoRecordRow[]>;
  /** 在指定用户的数据边界内更新视频记录状态，并返回更新后的数据行。 */
  updateStatusForUser(
    input: UpdateVideoRecordStatusForUserInput,
  ): Promise<VideoRecordRow>;
};
