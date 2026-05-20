export const videoRecordStatuses = [
  "queued",
  "fetching_metadata",
  "extracting_transcript",
  "extracting_audio",
  "transcribing_audio",
  "summarizing",
  "delivering",
  "completed",
  "failed",
  "cancelled",
] as const;

export const videoPlatforms = ["youtube", "bilibili"] as const;

export const transcriptSources = [
  "manual_subtitle",
  "auto_subtitle",
  "asr",
] as const;

export const outputModes = [
  "transcript",
  "summary",
  "summary_and_email",
] as const;

export const recordCreatorTypes = [
  "web",
  "mcp_agent",
  "system",
  "scheduled",
] as const;

export type VideoRecordStatus = (typeof videoRecordStatuses)[number];
export type VideoPlatform = (typeof videoPlatforms)[number];
export type TranscriptSource = (typeof transcriptSources)[number];
export type OutputMode = (typeof outputModes)[number];
export type RecordCreatorType = (typeof recordCreatorTypes)[number];
