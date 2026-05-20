import type {
  OutputMode,
  RecordCreatorType,
  TranscriptSource,
  VideoPlatform,
  VideoRecordStatus,
} from "../schema.js";

export type VideoRecordRow = {
  id: string;
  userId: string;
  sourceUrl: string;
  normalizedUrl: string;
  platform: VideoPlatform;
  title: string | null;
  author: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  status: VideoRecordStatus;
  transcriptSource: TranscriptSource | null;
  outputMode: OutputMode;
  fallbackToAudio: boolean;
  sendEmail: boolean;
  createdByType: RecordCreatorType;
  createdById: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;
};

export type CreateVideoRecordInput = {
  userId: string;
  sourceUrl: string;
  normalizedUrl: string;
  platform: VideoPlatform;
  outputMode: OutputMode;
  fallbackToAudio: boolean;
  sendEmail: boolean;
  createdByType: RecordCreatorType;
  createdById: string | null;
};

export type VideoRecordsRepository = {
  create(input: CreateVideoRecordInput): Promise<VideoRecordRow>;
  findByIdForUser(input: {
    id: string;
    userId: string;
  }): Promise<VideoRecordRow | null>;
};
