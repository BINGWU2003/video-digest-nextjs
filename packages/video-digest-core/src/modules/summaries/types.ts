import type { SummaryFormat } from "@repo/database";

import type { TranscriptSegment } from "../transcripts/types.js";

export type SummaryTimelineItem = {
  /** 时间文本，例如 03:12；未知时为空。 */
  time: string | null;
  /** 时间点对应的主题。 */
  title: string;
  /** 该时间点的摘要说明。 */
  summary: string;
  /** 开始时间秒数；未知时为空。 */
  startSeconds: number | null;
};

export type GeneratedSummary = {
  /** 摘要语言，例如 zh-CN。 */
  language: string;
  /** 摘要格式。 */
  format: SummaryFormat;
  /** 摘要标题。 */
  title: string | null;
  /** 短摘要。 */
  shortSummary: string | null;
  /** 关键要点。 */
  keyPoints: string[];
  /** 时间线摘要。 */
  timeline: SummaryTimelineItem[];
  /** 结论、行动建议或可复用要点。 */
  takeaways: string[];
  /** 完整 Markdown 摘要。 */
  markdown: string | null;
  /** 生成摘要使用的模型。 */
  model: string | null;
  /** prompt 版本。 */
  promptVersion: string | null;
};

export type GenerateSummaryInput = {
  /** 视频标题。 */
  videoTitle: string | null;
  /** 视频作者。 */
  videoAuthor: string | null;
  /** 原始视频链接。 */
  sourceUrl: string;
  /** 字幕语言。 */
  transcriptLanguage: string | null;
  /** 字幕全文。 */
  plainText: string | null;
  /** 字幕分段。 */
  segments: TranscriptSegment[];
  /** 摘要格式。 */
  format: SummaryFormat;
};

export type SummaryProvider = {
  /** 生成结构化摘要。 */
  generateSummary(input: GenerateSummaryInput): Promise<GeneratedSummary>;
};

export class SummaryGenerationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`摘要生成失败：${message}`);
    this.name = "SummaryGenerationError";

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
