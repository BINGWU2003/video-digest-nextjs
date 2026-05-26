import type { VideoPlatform } from "@video-digest-nextjs/database";

export type VideoMetadata = {
  /** 视频标题；平台未返回时为空。 */
  title: string | null;
  /** 视频作者、频道或 UP 主名称；平台未返回时为空。 */
  author: string | null;
  /** 视频时长，单位秒；平台未返回时为空。 */
  durationSeconds: number | null;
  /** 视频封面图地址；平台未返回时为空。 */
  thumbnailUrl: string | null;
  /** 元数据来源平台。 */
  platform: VideoPlatform;
  /** 元数据抓取完成时间。 */
  fetchedAt: Date;
};

export type FetchVideoMetadataInput = {
  /** 用户或 agent 原始提交的视频链接。 */
  sourceUrl: string;
  /** 已识别的视频平台。 */
  platform: VideoPlatform;
};

export type VideoMetadataProvider = {
  /** 当前 provider 支持的视频平台。 */
  platform: VideoPlatform;
  /** 读取视频平台元数据。 */
  fetchMetadata(input: FetchVideoMetadataInput): Promise<VideoMetadata>;
};

export class VideoMetadataProviderUnavailableError extends Error {
  constructor(platform: VideoPlatform) {
    super(`${platform} 视频元数据 provider 尚未接入。`);
    this.name = "VideoMetadataProviderUnavailableError";
  }
}

export class VideoMetadataFetchError extends Error {
  constructor(
    platform: VideoPlatform,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`${platform} 视频元数据读取失败：${message}`);
    this.name = "VideoMetadataFetchError";
  }
}
