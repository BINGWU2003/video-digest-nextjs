import type { TranscriptSource, VideoPlatform } from "@repo/database";

export type TranscriptSegment = {
  /** 分段开始时间，单位秒，可包含小数；未知时为空。 */
  startSeconds: number | null;
  /** 分段结束时间，单位秒，可包含小数；未知时为空。 */
  endSeconds: number | null;
  /** 当前时间段内的字幕文本。 */
  text: string;
};

export type TranscriptResult = {
  /** 字幕语言，例如 zh-CN 或 en；未知时为空。 */
  language: string | null;
  /** 字幕来源，例如人工字幕、自动字幕或 ASR。 */
  source: TranscriptSource;
  /** 字幕全文，MVP 阶段直接存储在 Postgres。 */
  plainText: string | null;
  /** 字幕分段列表。 */
  segments: TranscriptSegment[];
};

export type FetchTranscriptInput = {
  /** 用户或 agent 原始提交的视频链接。 */
  sourceUrl: string;
  /** 已识别的视频平台。 */
  platform: VideoPlatform;
  /** 没有可用平台字幕时，是否允许后续回退到音频提取和 ASR。 */
  fallbackToAudio: boolean;
};

export type TranscriptProvider = {
  /** 当前 provider 支持的视频平台。 */
  platform: VideoPlatform;
  /** 读取视频平台字幕。 */
  fetchTranscript(input: FetchTranscriptInput): Promise<TranscriptResult>;
};

export class TranscriptProviderUnavailableError extends Error {
  constructor(platform: VideoPlatform) {
    super(`${platform} 字幕 provider 尚未接入。`);
    this.name = "TranscriptProviderUnavailableError";
  }
}

export class TranscriptNotFoundError extends Error {
  constructor(platform: VideoPlatform, message: string) {
    super(`${platform} 未找到可用字幕：${message}`);
    this.name = "TranscriptNotFoundError";
  }
}

export class TranscriptFetchError extends Error {
  constructor(platform: VideoPlatform, message: string, cause?: unknown) {
    super(`${platform} 字幕读取失败：${message}`);
    this.name = "TranscriptFetchError";

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
