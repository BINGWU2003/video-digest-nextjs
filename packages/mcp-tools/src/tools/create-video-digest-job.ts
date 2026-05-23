import {
  type CreateVideoDigestJobInput,
  type CreateVideoDigestJobOutput,
  createVideoDigestJobOutputSchema,
} from "@repo/job-contracts";
import { createVideoRecord } from "@repo/video-digest-core";

import type { ToolDefinition } from "../tool-definition.js";

type CreateVideoDigestJobDependencies = Parameters<typeof createVideoRecord>[0];

export const createVideoDigestJobTool: ToolDefinition<
  CreateVideoDigestJobInput,
  CreateVideoDigestJobOutput,
  CreateVideoDigestJobDependencies
> = {
  name: "create_video_digest_job",
  description: "Create a queued video digest record for the current actor.",
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
