import type { SummariesRepository } from "@repo/database";

import type { GeneratedSummary } from "./types.js";

export type PersistSummaryDependencies = {
  summariesRepository: SummariesRepository;
};

export type PersistSummaryCommand = {
  /** 视频记录 ID。 */
  recordId: string;
  /** 记录所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 已生成的摘要。 */
  summary: GeneratedSummary;
};

export async function persistSummary(
  dependencies: PersistSummaryDependencies,
  command: PersistSummaryCommand,
) {
  return dependencies.summariesRepository.create({
    format: command.summary.format,
    keyPoints: command.summary.keyPoints,
    language: command.summary.language,
    markdown: command.summary.markdown,
    model: command.summary.model,
    promptVersion: command.summary.promptVersion,
    recordId: command.recordId,
    shortSummary: command.summary.shortSummary,
    takeaways: command.summary.takeaways,
    timeline: command.summary.timeline,
    title: command.summary.title,
    userId: command.userId,
  });
}
