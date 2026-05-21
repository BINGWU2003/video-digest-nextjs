import type { TranscriptProvider } from "../types.js";
import { TranscriptProviderUnavailableError } from "../types.js";

export function createYoutubeTranscriptProvider(): TranscriptProvider {
  return {
    platform: "youtube",
    async fetchTranscript() {
      throw new TranscriptProviderUnavailableError("youtube");
    },
  };
}
