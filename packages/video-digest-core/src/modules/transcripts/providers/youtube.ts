import { z } from "zod";

import type {
  FetchTranscriptInput,
  TranscriptProvider,
  TranscriptResult,
  TranscriptSegment,
} from "../types.js";
import { TranscriptFetchError, TranscriptNotFoundError } from "../types.js";

const youtubeTranscriptTimeoutMs = 10_000;
const youtubeVideoIdPattern = /^[a-zA-Z0-9_-]{11}$/;

const youtubePlayerResponseSchema = z.object({
  captions: z
    .object({
      playerCaptionsTracklistRenderer: z
        .object({
          captionTracks: z
            .array(
              z.object({
                baseUrl: z.string().min(1),
                kind: z.string().nullable().optional(),
                languageCode: z.string().min(1).nullable().optional(),
                name: z
                  .object({
                    runs: z.array(z.object({ text: z.string() })).optional(),
                    simpleText: z.string().optional(),
                  })
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const youtubeJson3TranscriptSchema = z.object({
  events: z
    .array(
      z.object({
        dDurationMs: z.number().optional(),
        segs: z.array(z.object({ utf8: z.string().optional() })).optional(),
        tStartMs: z.number().optional(),
      }),
    )
    .optional(),
});

type YoutubeCaptionTrack = NonNullable<
  NonNullable<
    NonNullable<
      z.infer<typeof youtubePlayerResponseSchema>["captions"]
    >["playerCaptionsTracklistRenderer"]
  >["captionTracks"]
>[number];
type YoutubeJson3Event = NonNullable<
  z.infer<typeof youtubeJson3TranscriptSchema>["events"]
>[number];

export function createYoutubeTranscriptProvider(): TranscriptProvider {
  return {
    platform: "youtube",
    async fetchTranscript(input) {
      return fetchYoutubeTranscript(input);
    },
  };
}

async function fetchYoutubeTranscript(
  input: FetchTranscriptInput,
): Promise<TranscriptResult> {
  const videoId = parseYoutubeVideoId(input.sourceUrl);
  const playerResponse = await fetchYoutubePlayerResponse(videoId);
  const captionTracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
    [];
  const captionTrack = selectCaptionTrack(captionTracks);

  if (!captionTrack) {
    throw new TranscriptNotFoundError(
      "youtube",
      input.fallbackToAudio
        ? "视频没有公开字幕，后续可接入音频转写回退。"
        : "视频没有公开字幕，且当前任务未允许音频转写回退。",
    );
  }

  const segments = await fetchYoutubeCaptionSegments(captionTrack);

  if (segments.length === 0) {
    throw new TranscriptNotFoundError("youtube", "字幕轨道为空。");
  }

  return {
    language: captionTrack.languageCode ?? null,
    plainText: segments.map((segment) => segment.text).join("\n"),
    segments,
    source: captionTrack.kind === "asr" ? "auto_subtitle" : "manual_subtitle",
  };
}

function parseYoutubeVideoId(sourceUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch (caught) {
    throw new TranscriptFetchError("youtube", "视频链接不是有效 URL。", caught);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const videoId =
    hostname === "youtu.be"
      ? parsedUrl.pathname.split("/").filter(Boolean)[0]
      : resolveYoutubeVideoIdFromPath(parsedUrl);

  if (!videoId || !youtubeVideoIdPattern.test(videoId)) {
    throw new TranscriptFetchError("youtube", "无法从链接中识别视频 ID。");
  }

  return videoId;
}

function resolveYoutubeVideoIdFromPath(parsedUrl: URL) {
  const directVideoId = parsedUrl.searchParams.get("v");

  if (directVideoId) {
    return directVideoId;
  }

  const [firstSegment, secondSegment] = parsedUrl.pathname
    .split("/")
    .filter(Boolean);

  if (
    firstSegment === "embed" ||
    firstSegment === "shorts" ||
    firstSegment === "live"
  ) {
    return secondSegment;
  }

  return null;
}

async function fetchYoutubePlayerResponse(videoId: string) {
  const watchUrl = new URL("https://www.youtube.com/watch");
  watchUrl.searchParams.set("v", videoId);
  watchUrl.searchParams.set("hl", "en");
  watchUrl.searchParams.set("persist_hl", "1");

  let response: Response;

  try {
    response = await fetch(watchUrl, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(youtubeTranscriptTimeoutMs),
    });
  } catch (caught) {
    throw new TranscriptFetchError(
      "youtube",
      "视频页面网络请求失败。",
      caught,
    );
  }

  if (!response.ok) {
    throw new TranscriptFetchError(
      "youtube",
      `视频页面请求失败，HTTP 状态码 ${response.status}。`,
    );
  }

  const html = await response.text();
  const rawPlayerResponse = parseInitialPlayerResponse(html);
  const parsedPlayerResponse =
    youtubePlayerResponseSchema.safeParse(rawPlayerResponse);

  if (!parsedPlayerResponse.success) {
    throw new TranscriptFetchError(
      "youtube",
      "视频页面内的播放器数据结构无效。",
      parsedPlayerResponse.error,
    );
  }

  return parsedPlayerResponse.data;
}

function parseInitialPlayerResponse(html: string) {
  const markerCandidates = [
    "ytInitialPlayerResponse =",
    "var ytInitialPlayerResponse =",
  ];

  for (const marker of markerCandidates) {
    const markerIndex = html.indexOf(marker);

    if (markerIndex === -1) {
      continue;
    }

    const jsonStartIndex = html.indexOf("{", markerIndex + marker.length);

    if (jsonStartIndex === -1) {
      continue;
    }

    const jsonText = extractJsonObject(html, jsonStartIndex);

    try {
      return JSON.parse(jsonText) as unknown;
    } catch (caught) {
      throw new TranscriptFetchError(
        "youtube",
        "播放器数据不是有效 JSON。",
        caught,
      );
    }
  }

  throw new TranscriptFetchError("youtube", "视频页面缺少播放器数据。");
}

function extractJsonObject(text: string, startIndex: number) {
  let depth = 0;
  let isEscaped = false;
  let isInsideString = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (isInsideString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        isInsideString = false;
      }

      continue;
    }

    if (char === '"') {
      isInsideString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  throw new TranscriptFetchError("youtube", "播放器数据 JSON 不完整。");
}

function selectCaptionTrack(captionTracks: YoutubeCaptionTrack[]) {
  return (
    findTrack(captionTracks, { isAutoGenerated: false, languagePrefix: "zh" }) ??
    findTrack(captionTracks, { isAutoGenerated: false, languagePrefix: "en" }) ??
    findTrack(captionTracks, { isAutoGenerated: false }) ??
    findTrack(captionTracks, { isAutoGenerated: true, languagePrefix: "zh" }) ??
    findTrack(captionTracks, { isAutoGenerated: true, languagePrefix: "en" }) ??
    findTrack(captionTracks, { isAutoGenerated: true }) ??
    captionTracks[0] ??
    null
  );
}

function findTrack(
  captionTracks: YoutubeCaptionTrack[],
  options: {
    isAutoGenerated: boolean;
    languagePrefix?: string;
  },
) {
  return captionTracks.find((track) => {
    if ((track.kind === "asr") !== options.isAutoGenerated) {
      return false;
    }

    if (!options.languagePrefix) {
      return true;
    }

    return track.languageCode?.startsWith(options.languagePrefix) ?? false;
  });
}

async function fetchYoutubeCaptionSegments(captionTrack: YoutubeCaptionTrack) {
  const captionUrl = new URL(captionTrack.baseUrl);
  captionUrl.searchParams.set("fmt", "json3");

  let response: Response;

  try {
    response = await fetch(captionUrl, {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(youtubeTranscriptTimeoutMs),
    });
  } catch (caught) {
    throw new TranscriptFetchError("youtube", "字幕轨道请求失败。", caught);
  }

  if (!response.ok) {
    throw new TranscriptFetchError(
      "youtube",
      `字幕轨道请求失败，HTTP 状态码 ${response.status}。`,
    );
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (caught) {
    throw new TranscriptFetchError(
      "youtube",
      "字幕轨道响应不是有效 JSON。",
      caught,
    );
  }

  const parsedTranscript =
    youtubeJson3TranscriptSchema.safeParse(responseBody);

  if (!parsedTranscript.success) {
    throw new TranscriptFetchError(
      "youtube",
      "字幕轨道响应结构无效。",
      parsedTranscript.error,
    );
  }

  return (
    parsedTranscript.data.events
      ?.map(toTranscriptSegment)
      .filter((segment): segment is TranscriptSegment => segment !== null) ??
    []
  );
}

function toTranscriptSegment(event: YoutubeJson3Event) {
  const text =
    event.segs
      ?.map((segment) => segment.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim() ?? "";

  if (!text) {
    return null;
  }

  const startSeconds =
    event.tStartMs === undefined ? null : event.tStartMs / 1000;
  const endSeconds =
    startSeconds === null || event.dDurationMs === undefined
      ? null
      : startSeconds + event.dDurationMs / 1000;

  return {
    endSeconds,
    startSeconds,
    text,
  };
}
