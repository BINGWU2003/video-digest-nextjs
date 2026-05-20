import type { VideoMetadataProvider } from "../types.js";
import { VideoMetadataProviderUnavailableError } from "../types.js";

export function createBilibiliVideoMetadataProvider(): VideoMetadataProvider {
  return {
    platform: "bilibili",
    async fetchMetadata() {
      throw new VideoMetadataProviderUnavailableError("bilibili");
    },
  };
}
