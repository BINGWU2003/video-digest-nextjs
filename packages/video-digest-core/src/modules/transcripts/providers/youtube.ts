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

const youtubeYtDlpTimeoutMs = 120_000;
const ytDlpSubtitleLanguages =
  "zh.*,en.*,[a-z][a-z][a-z]?(-[A-Za-z0-9]+)*,-live_chat";
const execFileAsync = promisify(execFile);

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

type YoutubeJson3Event = NonNullable<
  z.infer<typeof youtubeJson3TranscriptSchema>["events"]
>[number];

export function createYoutubeTranscriptProvider(): TranscriptProvider {
  return {
    platform: "youtube",
    async fetchTranscript(input) {
      return fetchYoutubeTranscriptWithYtDlp(input);
    },
  };
}

async function fetchYoutubeTranscriptWithYtDlp(
  input: FetchTranscriptInput,
): Promise<TranscriptResult> {
  const ytDlpPath = process.env.YTDLP_PATH ?? "yt-dlp";
  const tempDirectory = await mkdtemp(join(tmpdir(), "video-digest-ytdlp-"));
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
          "youtube",
          `yt-dlp 执行失败，请确认 YTDLP_PATH 可用：${ytDlpPath}`,
          ytDlpError,
        );
      }

      throw new TranscriptNotFoundError(
        "youtube",
        "yt-dlp 未下载到可用字幕文件。",
      );
    }

    const fileContent = await readFile(subtitleFile.path, "utf8");
    const segments = parseYtDlpSubtitleFile(subtitleFile, fileContent);

    if (segments.length === 0) {
      throw new TranscriptNotFoundError(
        "youtube",
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

    throw new TranscriptFetchError("youtube", "yt-dlp 字幕读取失败。", caught);
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
    "json3/vtt/best",
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
    timeout: youtubeYtDlpTimeoutMs,
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
  extension: "json3" | "vtt";
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
  const match = /\.([^.]+)\.(json3|vtt)$/u.exec(fileName);

  if (!match) {
    return null;
  }

  const language = match[1] ?? null;
  const extension = match[2] as "json3" | "vtt";

  return {
    extension,
    language,
    path: join(directory, fileName),
    priority: getYtDlpSubtitleFilePriority(language, extension),
  };
}

function getYtDlpSubtitleFilePriority(
  language: string | null,
  extension: "json3" | "vtt",
) {
  const languagePriority = language?.startsWith("zh")
    ? 0
    : language?.startsWith("en")
      ? 10
      : 20;
  const extensionPriority = extension === "json3" ? 0 : 1;

  return languagePriority + extensionPriority;
}

function parseYtDlpSubtitleFile(
  file: YtDlpSubtitleFile,
  fileContent: string,
) {
  if (file.extension === "json3") {
    return parseJson3Transcript(fileContent);
  }

  return parseVttTranscript(fileContent);
}

function parseJson3Transcript(fileContent: string) {
  let responseBody: unknown;

  try {
    responseBody = JSON.parse(fileContent);
  } catch (caught) {
    throw new TranscriptFetchError(
      "youtube",
      "yt-dlp 下载的 json3 字幕不是有效 JSON。",
      caught,
    );
  }

  const parsedTranscript =
    youtubeJson3TranscriptSchema.safeParse(responseBody);

  if (!parsedTranscript.success) {
    throw new TranscriptFetchError(
      "youtube",
      "yt-dlp 下载的 json3 字幕结构无效。",
      parsedTranscript.error,
    );
  }

  return (
    parsedTranscript.data.events
      ?.map(toTranscriptSegment)
      .filter((segment): segment is TranscriptSegment => segment !== null) ?? []
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
      endSeconds: parseVttTimestamp(endTime),
      startSeconds: parseVttTimestamp(startTime),
      text,
    });
  }

  return segments;
}

function parseVttTimestamp(timestamp: string | undefined) {
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
