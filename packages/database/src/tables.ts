import type {
  DeliveryStatus,
  DeliveryType,
  EmailAddressStatus,
  OutputMode,
  RecordCreatorType,
  SummaryFormat,
  TranscriptSource,
  UsageEventType,
  UsageUnit,
  VideoPlatform,
  VideoRecordStatus,
} from "./schema.js";

export type UserProfileRow = {
  /** 用户资料主键，与 `auth.users.id` 保持一致。 */
  id: string;
  /** 展示用邮箱，从 Supabase Auth 同步，便于页面读取。 */
  email: string | null;
  /** 计费或访问套餐标识，例如 free、pro、admin。 */
  plan: string;
  /** 用户资料记录创建时间。 */
  createdAt: Date;
  /** 用户资料记录最后更新时间。 */
  updatedAt: Date;
};

export type VideoRecordRow = {
  /** 视频处理记录主键，详情页和队列 payload 会作为 recordId 使用。 */
  id: string;
  /** 记录所属用户 ID，来自 Supabase Auth，用于 RLS 和资源归属校验。 */
  userId: string;
  /** 用户或 agent 原始提交的视频链接。 */
  sourceUrl: string;
  /** 归一化后的视频链接，用于重复任务检测和搜索。 */
  normalizedUrl: string;
  /** 提交视频的来源平台。 */
  platform: VideoPlatform;
  /** worker 提取元数据后写入的视频标题。 */
  title: string | null;
  /** 视频作者、频道或 Bilibili UP 主名称。 */
  author: string | null;
  /** 视频时长，单位秒。 */
  durationSeconds: number | null;
  /** 从来源平台获取的视频封面图地址。 */
  thumbnailUrl: string | null;
  /** 当前处理状态，用于记录列表、详情页和 agent 状态查询。 */
  status: VideoRecordStatus;
  /** 记录最终采用的字幕来源，字幕提取成功后写入。 */
  transcriptSource: TranscriptSource | null;
  /** 本次任务请求的输出模式。 */
  outputMode: OutputMode;
  /** 没有可用字幕时，worker 是否可以回退到音频提取和 ASR。 */
  fallbackToAudio: boolean;
  /** 本次任务是否需要把摘要发送到用户默认已验证邮箱。 */
  sendEmail: boolean;
  /** 创建这条记录的来源，例如网页、MCP agent、系统或定时任务。 */
  createdByType: RecordCreatorType;
  /** 创建者标识。MCP 记录可存 token ID，网页记录可存用户 ID。 */
  createdById: string | null;
  /** 结构化失败码，用于恢复操作和前端提示。 */
  errorCode: string | null;
  /** 面向用户或运维排查的失败说明。 */
  errorMessage: string | null;
  /** 任务记录创建时间。 */
  createdAt: Date;
  /** 任务记录最后更新时间。 */
  updatedAt: Date;
  /** 任务完成、失败或取消的时间。 */
  completedAt: Date | null;
  /** 软删除时间；为空表示记录仍可见。 */
  deletedAt: Date | null;
};

export type TranscriptRow = {
  /** 字幕结果主键。 */
  id: string;
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 字幕所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 字幕语言，例如 zh-CN 或 en。 */
  language: string | null;
  /** 字幕来源，例如人工字幕、自动字幕或 ASR。 */
  source: TranscriptSource;
  /** 字幕全文，MVP 阶段直接存储在 Postgres。 */
  plainText: string | null;
  /** 对象存储 key，用于大字幕文本或字幕文件。 */
  storageKey: string | null;
  /** 当前字幕对应的分段数量。 */
  segmentCount: number;
  /** 字幕结果创建时间。 */
  createdAt: Date;
};

export type TranscriptSegmentRow = {
  /** 字幕分段主键。 */
  id: string;
  /** 父级字幕结果 ID。 */
  transcriptId: string;
  /** 关联的视频记录 ID，冗余保存以便详情页快速读取。 */
  recordId: string;
  /** 分段所属用户 ID，冗余保存用于 RLS 和查询过滤。 */
  userId: string;
  /** 分段开始时间，单位秒，可包含小数。 */
  startSeconds: number | null;
  /** 分段结束时间，单位秒，可包含小数。 */
  endSeconds: number | null;
  /** 当前时间段内的字幕文本。 */
  text: string;
  /** 稳定排序值，用于字幕展示顺序。 */
  sortOrder: number;
};

export type SummaryRow = {
  /** 摘要结果主键。 */
  id: string;
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 摘要所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 摘要语言，默认 zh-CN。 */
  language: string;
  /** 摘要格式，例如简版、详细版或邮件摘要版。 */
  format: SummaryFormat;
  /** 摘要标题，可由模型生成或复制视频标题。 */
  title: string | null;
  /** 短摘要，用于记录详情和紧凑预览。 */
  shortSummary: string | null;
  /** 从字幕生成的结构化关键要点。 */
  keyPoints: unknown[];
  /** 从字幕生成的结构化时间线条目。 */
  timeline: unknown[];
  /** 结构化结论、行动建议或可复用要点。 */
  takeaways: unknown[];
  /** 完整 Markdown 摘要，用于复制、邮件和导出。 */
  markdown: string | null;
  /** 生成摘要使用的模型名称。 */
  model: string | null;
  /** 生成摘要使用的 prompt 版本。 */
  promptVersion: string | null;
  /** 摘要创建时间。 */
  createdAt: Date;
};

export type EmailAddressRow = {
  /** 邮箱记录主键，投递 tool 会作为 toEmailId 使用。 */
  id: string;
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 收件邮箱地址。 */
  email: string;
  /** 当前收件邮箱的验证状态。 */
  status: EmailAddressStatus;
  /** 是否为用户默认收件邮箱。 */
  isDefault: boolean;
  /** 邮箱验证 token 的 hash，永不持久化明文 token。 */
  verificationTokenHash: string | null;
  /** 最近一次验证邮件发送时间。 */
  verificationSentAt: Date | null;
  /** 邮箱完成验证的时间。 */
  verifiedAt: Date | null;
  /** 最近一次成功向该邮箱发送摘要邮件的时间。 */
  lastSentAt: Date | null;
  /** 邮箱记录创建时间。 */
  createdAt: Date;
};

export type DeliveryRecordRow = {
  /** 投递记录主键。 */
  id: string;
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 投递所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 本次投递使用的摘要版本；摘要被删除时为空。 */
  summaryId: string | null;
  /** 投递目标类型，例如 email 或 webhook。 */
  type: DeliveryType;
  /** 投递目标 ID。邮件投递时指向 `email_addresses.id`。 */
  targetId: string;
  /** 邮件服务商返回的消息 ID，用于 webhook 回写真实投递状态。 */
  providerMessageId: string | null;
  /** 最近一次服务商事件类型，例如 email.delivered。 */
  providerEventType: string | null;
  /** 最近一次服务商事件发生时间。 */
  providerEventAt: Date | null;
  /** 投递生命周期状态。 */
  status: DeliveryStatus;
  /** 邮件主题或 webhook 事件标题。 */
  subject: string | null;
  /** 投递失败时的错误说明。 */
  errorMessage: string | null;
  /** 投递记录创建时间。 */
  createdAt: Date;
  /** 投递成功发送时间。 */
  sentAt: Date | null;
};

export type McpTokenRow = {
  /** MCP token 主键，可作为 agent actor ID 使用。 */
  id: string;
  /** token 所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 设置页展示的 token 名称。 */
  name: string;
  /** token 展示前缀，用于识别 token，但不暴露密钥。 */
  tokenPrefix: string;
  /** token 密钥的 hash，永不持久化明文 token。 */
  tokenHash: string;
  /** scope 列表，控制该 token 可调用哪些 MCP tools。 */
  scopes: string[];
  /** token 过期时间；为空表示没有显式过期时间。 */
  expiresAt: Date | null;
  /** token 最近一次成功使用时间。 */
  lastUsedAt: Date | null;
  /** token 撤销时间；为空表示 token 仍启用。 */
  revokedAt: Date | null;
  /** token 创建时间。 */
  createdAt: Date;
};

export type JobEventRow = {
  /** 任务事件主键。 */
  id: string;
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 事件所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 当前事件表示的任务状态或处理阶段。 */
  status: VideoRecordStatus;
  /** 可读的状态说明、失败提示或 worker 日志摘要。 */
  message: string | null;
  /** 结构化事件元数据，例如 provider、耗时或重试次数。 */
  metadata: Record<string, unknown>;
  /** 事件发生时间。 */
  createdAt: Date;
};

export type UsageEventRow = {
  /** 用量事件主键。 */
  id: string;
  /** 用量所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 关联的视频记录 ID；与单条记录无关的用量事件可为空。 */
  recordId: string | null;
  /** 被计量的用量事件类型。 */
  eventType: UsageEventType;
  /** 本次事件的计量值，例如 1 次或转写分钟数。 */
  quantity: number;
  /** `quantity` 的计量单位，例如 count 或 minute。 */
  unit: UsageUnit;
  /** 用量事件发生时间。 */
  createdAt: Date;
};
