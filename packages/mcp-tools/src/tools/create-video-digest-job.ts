import type { VideoRecordsRepository } from "@repo/database";
import {
  type CreateVideoDigestJobInput,
  type CreateVideoDigestJobOutput,
  createVideoDigestJobOutputSchema,
} from "@repo/job-contracts";
import { createVideoRecord } from "@repo/video-digest-core";

import type { ToolDefinition } from "../tool-definition.js";

type CreateVideoDigestJobDependencies = {
  videoRecordsRepository: VideoRecordsRepository;
};

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
      const record = await createVideoRecord(dependencies, {
        actor: context.actor,
        input,
      });

      return createVideoDigestJobOutputSchema.parse({
        recordId: record.id,
        status: record.status,
      });
    },
};
