import type { SummaryFormat } from "../schema.js";
import type { SummaryRow } from "../tables.js";

export type { SummaryRow } from "../tables.js";

export type CreateSummaryInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 摘要所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 摘要语言，例如 zh-CN。 */
  language: string;
  /** 摘要格式，例如简版、详细版或邮件摘要版。 */
  format: SummaryFormat;
  /** 摘要标题，可由模型生成或沿用视频标题。 */
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
};

export type FindLatestSummaryForRecordInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 摘要所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type SummariesRepository = {
  /** 创建一条摘要结果。 */
  create(input: CreateSummaryInput): Promise<SummaryRow>;
  /** 查询指定记录下最新的一版摘要。 */
  findLatestForRecord(
    input: FindLatestSummaryForRecordInput,
  ): Promise<SummaryRow | null>;
};
