import type { VideoPlatform } from "@video-digest-nextjs/database";

import type {
  FetchVideoMetadataInput,
  VideoMetadata,
  VideoMetadataProvider,
} from "./types.js";
import { VideoMetadataProviderUnavailableError } from "./types.js";

export type VideoMetadataProviderRegistry = {
  /** 按平台获取对应的视频元数据 provider。 */
  getProvider(platform: VideoPlatform): VideoMetadataProvider;
};

export type FetchVideoMetadataDependencies = {
  providerRegistry: VideoMetadataProviderRegistry;
};

export async function fetchVideoMetadata(
  dependencies: FetchVideoMetadataDependencies,
  input: FetchVideoMetadataInput,
): Promise<VideoMetadata> {
  const provider = dependencies.providerRegistry.getProvider(input.platform);

  return provider.fetchMetadata(input);
}

export function createVideoMetadataProviderRegistry(
  providers: VideoMetadataProvider[],
): VideoMetadataProviderRegistry {
  const providersByPlatform = new Map(
    providers.map((provider) => [provider.platform, provider]),
  );

  return {
    getProvider(platform) {
      const provider = providersByPlatform.get(platform);

      if (!provider) {
        throw new VideoMetadataProviderUnavailableError(platform);
      }

      return provider;
    },
  };
}
