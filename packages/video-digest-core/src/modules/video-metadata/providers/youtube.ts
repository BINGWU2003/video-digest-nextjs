import { z } from "zod";

import type { FetchVideoMetadataInput, VideoMetadataProvider } from "../types.js";
import { VideoMetadataFetchError } from "../types.js";

const youtubeOembedResponseSchema = z.object({
  author_name: z.string().min(1).nullable().optional(),
  thumbnail_url: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
});

const youtubeOembedTimeoutMs = 10_000;

export function createYoutubeVideoMetadataProvider(): VideoMetadataProvider {
  return {
    platform: "youtube",
    async fetchMetadata(input) {
      return fetchYoutubeOembedMetadata(input);
    },
  };
}

async function fetchYoutubeOembedMetadata(input: FetchVideoMetadataInput) {
  const endpointUrl = new URL("https://www.youtube.com/oembed");
  endpointUrl.searchParams.set("format", "json");
  endpointUrl.searchParams.set("url", input.sourceUrl);

  let response: Response;

  try {
    response = await fetch(endpointUrl, {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(youtubeOembedTimeoutMs),
    });
  } catch (caught) {
    throw new VideoMetadataFetchError(
      "youtube",
      "oEmbed 网络请求失败。",
      caught,
    );
  }

  if (!response.ok) {
    throw new VideoMetadataFetchError(
      "youtube",
      `oEmbed 请求失败，HTTP 状态码 ${response.status}。`,
    );
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (caught) {
    throw new VideoMetadataFetchError(
      "youtube",
      "oEmbed 响应不是有效 JSON。",
      caught,
    );
  }
  const parsedResponse = youtubeOembedResponseSchema.safeParse(responseBody);

  if (!parsedResponse.success) {
    throw new VideoMetadataFetchError(
      "youtube",
      "oEmbed 响应结构无效。",
      parsedResponse.error,
    );
  }

  return {
    author: parsedResponse.data.author_name ?? null,
    durationSeconds: null,
    fetchedAt: new Date(),
    platform: "youtube" as const,
    thumbnailUrl: parsedResponse.data.thumbnail_url ?? null,
    title: parsedResponse.data.title ?? null,
  };
}
