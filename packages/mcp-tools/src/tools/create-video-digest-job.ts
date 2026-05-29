import {
  type CreateVideoDigestJobInput,
  type CreateVideoDigestJobOutput,
  createVideoDigestJobOutputSchema,
} from "@video-digest-nextjs/job-contracts";
import { createVideoRecord } from "@video-digest-nextjs/video-digest-core";

import type { ToolDefinition } from "../tool-definition.js";

type CreateVideoDigestJobDependencies = Parameters<typeof createVideoRecord>[0];

export const createVideoDigestJobTool: ToolDefinition<
  CreateVideoDigestJobInput,
  CreateVideoDigestJobOutput,
  CreateVideoDigestJobDependencies
> = {
  name: "create_video_digest_job",
  description:
    "创建一个异步 YouTube 或 Bilibili 视频摘要任务，并立即返回 recordId 和当前状态。长视频、音频转写、摘要生成和邮件投递可能需要几分钟；不要在同一轮对话里等待任务完成，也不要反复轮询。创建任务后，把 recordId 告诉用户；只有当用户明确要求稍后查询状态或结果时，才调用 get_video_digest_record。",
  requiredScopes: ["digest:create"],
  createHandler:
    (dependencies) =>
    async (input, context): Promise<CreateVideoDigestJobOutput> => {
      const result = await createVideoRecord(dependencies, {
        actor: context.actor,
        input,
      });

      return createVideoDigestJobOutputSchema.parse({
        created: result.created,
        recordId: result.record.id,
        status: result.record.status,
      });
    },
};
