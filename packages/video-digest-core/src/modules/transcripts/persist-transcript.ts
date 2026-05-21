import type { TranscriptsRepository } from "@repo/database";

import type { TranscriptResult } from "./types.js";

export type PersistTranscriptDependencies = {
  transcriptsRepository: TranscriptsRepository;
};

export type PersistTranscriptCommand = {
  /** 视频记录 ID。 */
  recordId: string;
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 已从视频平台或 ASR 得到的字幕结果。 */
  transcript: TranscriptResult;
};

export async function persistTranscript(
  dependencies: PersistTranscriptDependencies,
  command: PersistTranscriptCommand,
) {
  return dependencies.transcriptsRepository.create({
    recordId: command.recordId,
    userId: command.userId,
    language: command.transcript.language,
    source: command.transcript.source,
    plainText: command.transcript.plainText,
    storageKey: null,
    segments: command.transcript.segments.map((segment, index) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
      sortOrder: index,
    })),
  });
}
