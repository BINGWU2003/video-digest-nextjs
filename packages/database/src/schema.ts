/** `video_records.status` 使用的视频处理生命周期状态。 */
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

/** `video_records.platform` 支持的视频平台。 */
export const videoPlatforms = ["youtube", "bilibili"] as const;

/** `video_records.transcript_source` 和 `transcripts.source` 使用的字幕来源。 */
export const transcriptSources = [
  "manual_subtitle",
  "auto_subtitle",
  "asr",
] as const;

/** `video_records.output_mode` 使用的任务输出模式。 */
export const outputModes = [
  "transcript",
  "summary",
  "summary_and_email",
] as const;

/** `video_records.created_by_type` 使用的记录创建来源。 */
export const recordCreatorTypes = [
  "web",
  "mcp_agent",
  "system",
  "scheduled",
] as const;

/** `summaries.format` 使用的摘要格式。 */
export const summaryFormats = ["brief", "detailed", "email_digest"] as const;

/** `email_addresses.status` 使用的邮箱验证状态。 */
export const emailAddressStatuses = ["pending", "verified", "revoked"] as const;

/** `delivery_records.type` 使用的投递目标类型。 */
export const deliveryTypes = ["email", "webhook"] as const;

/** `delivery_records.status` 使用的投递生命周期状态。 */
export const deliveryStatuses = [
  "queued",
  "sent",
  "failed",
  "cancelled",
] as const;

/** `usage_events.event_type` 使用的用量事件类型。 */
export const usageEventTypes = [
  "job_created",
  "transcript_extracted",
  "audio_transcribed",
  "email_sent",
  "job_failed",
] as const;

/** `usage_events.unit` 使用的用量计量单位。 */
export const usageUnits = ["count", "minute"] as const;

export type VideoRecordStatus = (typeof videoRecordStatuses)[number];
export type VideoPlatform = (typeof videoPlatforms)[number];
export type TranscriptSource = (typeof transcriptSources)[number];
export type OutputMode = (typeof outputModes)[number];
export type RecordCreatorType = (typeof recordCreatorTypes)[number];
export type SummaryFormat = (typeof summaryFormats)[number];
export type EmailAddressStatus = (typeof emailAddressStatuses)[number];
export type DeliveryType = (typeof deliveryTypes)[number];
export type DeliveryStatus = (typeof deliveryStatuses)[number];
export type UsageEventType = (typeof usageEventTypes)[number];
export type UsageUnit = (typeof usageUnits)[number];
