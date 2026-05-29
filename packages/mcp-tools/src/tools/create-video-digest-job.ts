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
    "Start an asynchronous YouTube or Bilibili video digest job and return immediately with a recordId and current status. Long videos, audio fallback, summary generation, and email delivery can take minutes; do not wait for completion or poll repeatedly in the same turn. After creating the job, tell the user the recordId and use get_video_digest_record only for an explicit later status/result check.",
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
