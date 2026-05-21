import type {
  TranscriptSource,
  VideoPlatform,
  VideoRecordRow,
  VideoRecordStatus,
} from "@repo/database";

export const statusLabels: Record<VideoRecordStatus, string> = {
  cancelled: "已取消",
  completed: "已完成",
  delivering: "投递中",
  extracting_audio: "提取音频",
  extracting_transcript: "提取字幕",
  failed: "失败",
  fetching_metadata: "读取信息",
  queued: "排队中",
  summarizing: "生成摘要",
  transcribing_audio: "音频转写",
};

export const platformLabels: Record<VideoPlatform, string> = {
  bilibili: "Bilibili",
  youtube: "YouTube",
};

export const transcriptSourceLabels: Record<TranscriptSource, string> = {
  asr: "音频转写",
  auto_subtitle: "自动字幕",
  manual_subtitle: "人工字幕",
};

export function statusTone(
  status: VideoRecordStatus,
): "blue" | "green" | "red" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  if (status === "cancelled") return "slate";
  return "blue";
}

export function displayRecordTitle(record: VideoRecordRow) {
  return record.title ?? "等待读取视频标题";
}

export function formatDateTime(value: Date | null) {
  if (!value) {
    return "处理中";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "未知";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds} 秒`;
  }

  return `${minutes} 分 ${remainingSeconds.toString().padStart(2, "0")} 秒`;
}

export function formatTranscriptSource(source: TranscriptSource | null) {
  return source ? transcriptSourceLabels[source] : "暂未生成";
}

export function formatCreatedBy(record: VideoRecordRow) {
  const labels = {
    mcp_agent: "MCP 创建",
    scheduled: "定时任务",
    system: "系统创建",
    web: "网页创建",
  } satisfies Record<VideoRecordRow["createdByType"], string>;

  return labels[record.createdByType];
}
