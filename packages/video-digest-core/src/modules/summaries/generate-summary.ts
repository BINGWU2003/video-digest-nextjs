import type { GenerateSummaryInput, GeneratedSummary, SummaryProvider } from "./types.js";

export type GenerateSummaryDependencies = {
  summaryProvider: SummaryProvider;
};

export async function generateSummary(
  dependencies: GenerateSummaryDependencies,
  input: GenerateSummaryInput,
): Promise<GeneratedSummary> {
  return dependencies.summaryProvider.generateSummary(input);
}
