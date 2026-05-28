import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import type {
  FetchTranscriptInput,
  TranscriptProvider,
  TranscriptResult,
  TranscriptSegment,
} from "../types.js";
import { TranscriptFetchError, TranscriptNotFoundError } from "../types.js";
import { fetchAudioAsrTranscriptWithYtDlp } from "./audio-asr.js";

const bilibiliYtDlpTimeoutMs = 120_000;
const ytDlpSubtitleLanguages = "zh.*,en.*";
const execFileAsync = promisify(execFile);

const bilibiliJsonTranscriptSchema = z.object({
  body: z
    .array(
      z.object({
        content: z.string().optional(),
        from: z.number().optional(),
        to: z.number().optional(),
      }),
    )
    .optional(),
});

export function createBilibiliTranscriptProvider(): TranscriptProvider {
  return {
    platform: "bilibili",
    async fetchTranscript(input) {
      if (input.fallbackToAudio) {
        return fetchBilibiliTranscriptWithAudioAsr(input);
      }

      return fetchBilibiliTranscriptWithYtDlp(input);
    },
  };
}

async function fetchBilibiliTranscriptWithAudioAsr(
  input: FetchTranscriptInput,
): Promise<TranscriptResult> {
  return fetchAudioAsrTranscriptWithYtDlp({
    ...input,
    platform: "bilibili",
    platformLabel: "Bilibili",
    tempDirectoryPrefix: "video-digest-bili-audio-",
  });
}

async function fetchBilibiliTranscriptWithYtDlp(
  input: FetchTranscriptInput,
): Promise<TranscriptResult> {
  const ytDlpPath = process.env.YTDLP_PATH ?? "yt-dlp";
  const tempDirectory = await mkdtemp(join(tmpdir(), "video-digest-bili-"));
  let ytDlpError: unknown = null;

  try {
    try {
      await runYtDlpSubtitleDownload({
        outputTemplate: join(tempDirectory, "%(id)s.%(ext)s"),
        sourceUrl: input.sourceUrl,
        ytDlpPath,
      });
    } catch (caught) {
      ytDlpError = caught;
    }

    const subtitleFile = await findBestYtDlpSubtitleFile(tempDirectory);

    if (!subtitleFile) {
      if (ytDlpError) {
        throw new TranscriptFetchError(
          "bilibili",
          `yt-dlp 执行失败：${getYtDlpErrorDetail(ytDlpError)}`,
          ytDlpError,
        );
      }

      throw new TranscriptNotFoundError(
        "bilibili",
        "yt-dlp 未下载到可用字幕文件。",
      );
    }

    const fileContent = await readFile(subtitleFile.path, "utf8");
    const segments = parseYtDlpSubtitleFile(subtitleFile, fileContent);

    if (segments.length === 0) {
      throw new TranscriptNotFoundError(
        "bilibili",
        "yt-dlp 下载的字幕文件为空。",
      );
    }

    return {
      language: subtitleFile.language,
      plainText: segments.map((segment) => segment.text).join("\n"),
      segments,
      source: "manual_subtitle",
    };
  } catch (caught) {
    if (
      caught instanceof TranscriptFetchError ||
      caught instanceof TranscriptNotFoundError
    ) {
      throw caught;
    }

    throw new TranscriptFetchError("bilibili", "yt-dlp 字幕读取失败。", caught);
  } finally {
    await rm(tempDirectory, {
      force: true,
      recursive: true,
    });
  }
}

type RunYtDlpSubtitleDownloadInput = {
  outputTemplate: string;
  sourceUrl: string;
  ytDlpPath: string;
};

async function runYtDlpSubtitleDownload(input: RunYtDlpSubtitleDownloadInput) {
  const args = [
    "--skip-download",
    "--no-playlist",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    ytDlpSubtitleLanguages,
    "--sub-format",
    "json/vtt/srt/best",
    "--output",
    input.outputTemplate,
  ];
  const proxyUrl = process.env.LOCAL_PROXY_URL;

  if (proxyUrl) {
    args.push("--proxy", proxyUrl);
  }

  args.push(input.sourceUrl);

  await execFileAsync(input.ytDlpPath, args, {
    env: createYtDlpEnvironment(proxyUrl),
    maxBuffer: 1024 * 1024 * 10,
    timeout: bilibiliYtDlpTimeoutMs,
    windowsHide: true,
  });
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

type YtDlpSubtitleFile = {
  extension: "json" | "srt" | "vtt";
  language: string | null;
  path: string;
  priority: number;
};

async function findBestYtDlpSubtitleFile(
  directory: string,
): Promise<YtDlpSubtitleFile | null> {
  const fileNames = await readdir(directory);
  const subtitleFiles = fileNames
    .map((fileName) => toYtDlpSubtitleFile(directory, fileName))
    .filter((file): file is YtDlpSubtitleFile => file !== null)
    .sort((left, right) => left.priority - right.priority);

  return subtitleFiles[0] ?? null;
}

function toYtDlpSubtitleFile(
  directory: string,
  fileName: string,
): YtDlpSubtitleFile | null {
  const match = /\.([^.]+)\.(json|srt|vtt)$/u.exec(fileName);

  if (!match) {
    return null;
  }

  const language = match[1] ?? null;
  const extension = match[2] as "json" | "srt" | "vtt";

  return {
    extension,
    language,
    path: join(directory, fileName),
    priority: getYtDlpSubtitleFilePriority(language, extension),
  };
}

function getYtDlpSubtitleFilePriority(
  language: string | null,
  extension: "json" | "srt" | "vtt",
) {
  const languagePriority = language?.startsWith("zh")
    ? 0
    : language?.startsWith("en")
      ? 10
      : 20;
  const extensionPriority = extension === "json" ? 0 : extension === "vtt" ? 1 : 2;

  return languagePriority + extensionPriority;
}

function getYtDlpErrorDetail(caught: unknown) {
  if (!caught || typeof caught !== "object") {
    return String(caught);
  }

  const error = caught as {
    code?: unknown;
    message?: unknown;
    stderr?: unknown;
  };
  const stderr =
    typeof error.stderr === "string" ? getLastMeaningfulLine(error.stderr) : "";

  if (stderr) {
    return stderr;
  }

  if (typeof error.message === "string" && error.message) {
    return error.message;
  }

  if (error.code) {
    return `退出码 ${String(error.code)}`;
  }

  return "未知错误";
}

function getLastMeaningfulLine(text: string) {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) ?? "";
}

function parseYtDlpSubtitleFile(
  file: YtDlpSubtitleFile,
  fileContent: string,
) {
  if (file.extension === "json") {
    return parseBilibiliJsonTranscript(fileContent);
  }

  if (file.extension === "srt") {
    return parseSrtTranscript(fileContent);
  }

  return parseVttTranscript(fileContent);
}

function parseBilibiliJsonTranscript(fileContent: string) {
  let responseBody: unknown;

  try {
    responseBody = JSON.parse(fileContent);
  } catch (caught) {
    throw new TranscriptFetchError(
      "bilibili",
      "yt-dlp 下载的 JSON 字幕不是有效 JSON。",
      caught,
    );
  }

  const parsedTranscript = bilibiliJsonTranscriptSchema.safeParse(responseBody);

  if (!parsedTranscript.success) {
    throw new TranscriptFetchError(
      "bilibili",
      "yt-dlp 下载的 JSON 字幕结构无效。",
      parsedTranscript.error,
    );
  }

  return (
    parsedTranscript.data.body
      ?.map((segment) => ({
        endSeconds: segment.to ?? null,
        startSeconds: segment.from ?? null,
        text: segment.content?.replace(/\s+/gu, " ").trim() ?? "",
      }))
      .filter((segment) => segment.text.length > 0) ?? []
  );
}

function parseVttTranscript(fileContent: string): TranscriptSegment[] {
  const normalizedContent = fileContent.replace(/\r\n/g, "\n");
  const cueBlocks = normalizedContent.split(/\n{2,}/u);
  const segments: TranscriptSegment[] = [];

  for (const cueBlock of cueBlocks) {
    const lines = cueBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timingLineIndex === -1) {
      continue;
    }

    const [startTime, endTime] = lines[timingLineIndex]!
      .split("-->")
      .map((time) => time.trim().split(/\s+/u)[0]);
    const text = lines
      .slice(timingLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/gu, "")
      .replace(/\s+/gu, " ")
      .trim();

    if (!text) {
      continue;
    }

    segments.push({
      endSeconds: parseSubtitleTimestamp(endTime),
      startSeconds: parseSubtitleTimestamp(startTime),
      text,
    });
  }

  return segments;
}

function parseSrtTranscript(fileContent: string): TranscriptSegment[] {
  const normalizedContent = fileContent.replace(/\r\n/g, "\n");
  const cueBlocks = normalizedContent.split(/\n{2,}/u);
  const segments: TranscriptSegment[] = [];

  for (const cueBlock of cueBlocks) {
    const lines = cueBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timingLineIndex === -1) {
      continue;
    }

    const [startTime, endTime] = lines[timingLineIndex]!
      .split("-->")
      .map((time) => time.trim());
    const text = lines
      .slice(timingLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/gu, "")
      .replace(/\s+/gu, " ")
      .trim();

    if (!text) {
      continue;
    }

    segments.push({
      endSeconds: parseSubtitleTimestamp(endTime),
      startSeconds: parseSubtitleTimestamp(startTime),
      text,
    });
  }

  return segments;
}

function parseSubtitleTimestamp(timestamp: string | undefined) {
  if (!timestamp) {
    return null;
  }

  const parts = timestamp.split(":");
  const secondsPart = parts.pop();

  if (!secondsPart) {
    return null;
  }

  const seconds = Number(secondsPart.replace(",", "."));
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);

  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}
