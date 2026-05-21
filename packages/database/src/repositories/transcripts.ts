import type { TranscriptSource } from "../schema.js";
import type { TranscriptRow, TranscriptSegmentRow } from "../tables.js";

export type { TranscriptRow, TranscriptSegmentRow } from "../tables.js";

export type CreateTranscriptSegmentInput = {
  /** 分段开始时间，单位秒，可包含小数；未知时为空。 */
  startSeconds: number | null;
  /** 分段结束时间，单位秒，可包含小数；未知时为空。 */
  endSeconds: number | null;
  /** 当前时间段内的字幕文本。 */
  text: string;
  /** 稳定排序值，用于字幕展示顺序。 */
  sortOrder: number;
};

export type CreateTranscriptInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 字幕所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 字幕语言，例如 zh-CN 或 en；未知时为空。 */
  language: string | null;
  /** 字幕来源，例如人工字幕、自动字幕或 ASR。 */
  source: TranscriptSource;
  /** 字幕全文，MVP 阶段直接存储在 Postgres。 */
  plainText: string | null;
  /** 对象存储 key，用于大字幕文本或字幕文件；MVP 可为空。 */
  storageKey: string | null;
  /** 字幕分段列表。 */
  segments: CreateTranscriptSegmentInput[];
};

export type CreatedTranscript = {
  /** 已创建的字幕主记录。 */
  transcript: TranscriptRow;
  /** 已创建的字幕分段记录。 */
  segments: TranscriptSegmentRow[];
};

export type FindLatestTranscriptForRecordInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 字幕所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 返回的分段数量上限，默认由具体 repository 决定。 */
  segmentLimit?: number;
};

export type TranscriptsRepository = {
  /** 创建字幕主记录和对应分段记录。 */
  create(input: CreateTranscriptInput): Promise<CreatedTranscript>;
  /** 查询指定记录下最新的一版字幕和对应分段。 */
  findLatestForRecord(
    input: FindLatestTranscriptForRecordInput,
  ): Promise<CreatedTranscript | null>;
};
