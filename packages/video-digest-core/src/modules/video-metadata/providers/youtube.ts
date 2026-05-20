import type { VideoMetadataProvider } from "../types.js";
import { VideoMetadataProviderUnavailableError } from "../types.js";

export function createYoutubeVideoMetadataProvider(): VideoMetadataProvider {
  return {
    platform: "youtube",
    async fetchMetadata() {
      throw new VideoMetadataProviderUnavailableError("youtube");
    },
  };
}
