import type { TranscriptProvider } from "../types.js";
import { TranscriptProviderUnavailableError } from "../types.js";

export function createBilibiliTranscriptProvider(): TranscriptProvider {
  return {
    platform: "bilibili",
    async fetchTranscript() {
      throw new TranscriptProviderUnavailableError("bilibili");
    },
  };
}
