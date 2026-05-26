import type { Actor } from "@video-digest-nextjs/job-contracts";

export type ToolHandlerContext = {
  actor: Actor;
};

export type ToolDefinition<TInput, TOutput, TDependencies> = {
  name: string;
  description: string;
  requiredScopes: string[];
  createHandler: (
    dependencies: TDependencies,
  ) => (input: TInput, context: ToolHandlerContext) => Promise<TOutput>;
};
