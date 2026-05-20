/** Video record lifecycle statuses persisted in `video_records.status`. */
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

/** Video platforms supported by `video_records.platform`. */
export const videoPlatforms = ["youtube", "bilibili"] as const;

/** Transcript source values persisted in `video_records.transcript_source` and `transcripts.source`. */
export const transcriptSources = [
  "manual_subtitle",
  "auto_subtitle",
  "asr",
] as const;

/** Requested output modes persisted in `video_records.output_mode`. */
export const outputModes = [
  "transcript",
  "summary",
  "summary_and_email",
] as const;

/** Sources that can create a video record, persisted in `video_records.created_by_type`. */
export const recordCreatorTypes = [
  "web",
  "mcp_agent",
  "system",
  "scheduled",
] as const;

/** Summary formats persisted in `summaries.format`. */
export const summaryFormats = ["brief", "detailed", "email_digest"] as const;

/** Email verification states persisted in `email_addresses.status`. */
export const emailAddressStatuses = ["pending", "verified", "revoked"] as const;

/** Delivery target types persisted in `delivery_records.type`. */
export const deliveryTypes = ["email", "webhook"] as const;

/** Delivery lifecycle states persisted in `delivery_records.status`. */
export const deliveryStatuses = [
  "queued",
  "sent",
  "failed",
  "cancelled",
] as const;

/** Usage event types persisted in `usage_events.event_type`. */
export const usageEventTypes = [
  "job_created",
  "transcript_extracted",
  "audio_transcribed",
  "email_sent",
  "job_failed",
] as const;

/** Usage units persisted in `usage_events.unit`. */
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
