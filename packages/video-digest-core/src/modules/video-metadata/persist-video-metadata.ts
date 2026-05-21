import type { VideoRecordsRepository } from "@repo/database";

import type { VideoMetadata } from "./types.js";

export type PersistVideoMetadataDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
};

export type PersistVideoMetadataCommand = {
  /** 视频记录 ID。 */
  recordId: string;
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 已从视频平台读取到的元数据。 */
  metadata: VideoMetadata;
};

export async function persistVideoMetadata(
  dependencies: PersistVideoMetadataDependencies,
  command: PersistVideoMetadataCommand,
) {
  return dependencies.videoRecordsRepository.updateMetadataForUser({
    id: command.recordId,
    userId: command.userId,
    title: command.metadata.title,
    author: command.metadata.author,
    durationSeconds: command.metadata.durationSeconds,
    thumbnailUrl: command.metadata.thumbnailUrl,
  });
}
