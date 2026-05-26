import type { VideoPlatform } from "@video-digest-nextjs/database";

import type {
  FetchTranscriptInput,
  TranscriptProvider,
  TranscriptResult,
} from "./types.js";
import { TranscriptProviderUnavailableError } from "./types.js";

export type TranscriptProviderRegistry = {
  /** 按平台获取对应的字幕 provider。 */
  getProvider(platform: VideoPlatform): TranscriptProvider;
};

export type FetchTranscriptDependencies = {
  providerRegistry: TranscriptProviderRegistry;
};

export async function fetchTranscript(
  dependencies: FetchTranscriptDependencies,
  input: FetchTranscriptInput,
): Promise<TranscriptResult> {
  const provider = dependencies.providerRegistry.getProvider(input.platform);

  return provider.fetchTranscript(input);
}

export function createTranscriptProviderRegistry(
  providers: TranscriptProvider[],
): TranscriptProviderRegistry {
  const providersByPlatform = new Map(
    providers.map((provider) => [provider.platform, provider]),
  );

  return {
    getProvider(platform) {
      const provider = providersByPlatform.get(platform);

      if (!provider) {
        throw new TranscriptProviderUnavailableError(platform);
      }

      return provider;
    },
  };
}
