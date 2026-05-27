import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

import type { FetchVideoMetadataInput, VideoMetadataProvider } from "../types.js";
import { VideoMetadataFetchError } from "../types.js";

const bilibiliYtDlpMetadataTimeoutMs = 120_000;
const execFileAsync = promisify(execFile);

const bilibiliYtDlpMetadataSchema = z.object({
  duration: z.number().nonnegative().nullable().optional(),
  thumbnail: z.string().min(1).nullable().optional(),
  thumbnails: z
    .array(
      z.object({
        url: z.string().min(1).nullable().optional(),
      }),
    )
    .optional(),
  title: z.string().min(1).nullable().optional(),
  uploader: z.string().min(1).nullable().optional(),
});

export function createBilibiliVideoMetadataProvider(): VideoMetadataProvider {
  return {
    platform: "bilibili",
    async fetchMetadata(input) {
      return fetchBilibiliYtDlpMetadata(input);
    },
  };
}

async function fetchBilibiliYtDlpMetadata(input: FetchVideoMetadataInput) {
  const metadata = await runYtDlpMetadata(input);

  return {
    author: metadata.uploader ?? null,
    durationSeconds: metadata.duration ? Math.round(metadata.duration) : null,
    fetchedAt: new Date(),
    platform: "bilibili" as const,
    thumbnailUrl: metadata.thumbnail ?? getLastThumbnailUrl(metadata) ?? null,
    title: metadata.title ?? null,
  };
}

async function runYtDlpMetadata(input: FetchVideoMetadataInput) {
  const ytDlpPath = process.env.YTDLP_PATH ?? "yt-dlp";
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-playlist",
    input.sourceUrl,
  ];
  const proxyUrl = process.env.LOCAL_PROXY_URL;

  if (proxyUrl) {
    args.splice(args.length - 1, 0, "--proxy", proxyUrl);
  }

  let stdout: string;

  try {
    const result = await execFileAsync(ytDlpPath, args, {
      env: createYtDlpEnvironment(proxyUrl),
      maxBuffer: 1024 * 1024 * 10,
      timeout: bilibiliYtDlpMetadataTimeoutMs,
      windowsHide: true,
    });
    stdout = result.stdout;
  } catch (caught) {
    throw new VideoMetadataFetchError(
      "bilibili",
      `yt-dlp 执行失败，请确认 YTDLP_PATH 可用：${ytDlpPath}`,
      caught,
    );
  }

  let responseBody: unknown;

  try {
    responseBody = JSON.parse(stdout);
  } catch (caught) {
    throw new VideoMetadataFetchError(
      "bilibili",
      "yt-dlp 元数据输出不是有效 JSON。",
      caught,
    );
  }

  const parsedMetadata = bilibiliYtDlpMetadataSchema.safeParse(responseBody);

  if (!parsedMetadata.success) {
    throw new VideoMetadataFetchError(
      "bilibili",
      "yt-dlp 元数据输出结构无效。",
      parsedMetadata.error,
    );
  }

  return parsedMetadata.data;
}

function createYtDlpEnvironment(proxyUrl: string | undefined) {
  if (!proxyUrl) {
    return process.env;
  }

  return {
    ...process.env,
    ALL_PROXY: process.env.ALL_PROXY ?? proxyUrl,
    HTTP_PROXY: process.env.HTTP_PROXY ?? proxyUrl,
    HTTPS_PROXY: process.env.HTTPS_PROXY ?? proxyUrl,
  };
}

function getLastThumbnailUrl(
  metadata: z.infer<typeof bilibiliYtDlpMetadataSchema>,
) {
  return metadata.thumbnails
    ?.slice()
    .reverse()
    .find((thumbnail) => thumbnail.url)?.url;
}
