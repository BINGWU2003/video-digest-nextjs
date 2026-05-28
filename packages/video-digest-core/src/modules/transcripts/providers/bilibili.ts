import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import type {
  FetchTranscriptInput,
  TranscriptProgressEvent,
  TranscriptProvider,
  TranscriptResult,
  TranscriptSegment,
} from "../types.js";
import { TranscriptFetchError, TranscriptNotFoundError } from "../types.js";

const bilibiliYtDlpTimeoutMs = 120_000;
const bilibiliAsrTimeoutMs = 1_800_000;
const defaultFasterWhisperModel = "small";
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

const fasterWhisperTranscriptionResponseSchema = z.object({
  language: z.string().min(1).nullable().optional(),
  segments: z
    .array(
      z.object({
        end: z.number().nonnegative().nullable().optional(),
        start: z.number().nonnegative().nullable().optional(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  text: z.string().optional(),
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
  const ytDlpPath = process.env.YTDLP_PATH ?? "yt-dlp";
  const tempDirectory = await mkdtemp(join(tmpdir(), "video-digest-bili-audio-"));
  const audioDownloadStartedAt = Date.now();
  let ytDlpError: unknown = null;

  try {
    await notifyTranscriptProgress(input, {
      message: "开始下载 Bilibili 音频。",
      metadata: {
        format: "bestaudio[ext=m4a]/bestaudio",
        provider: "yt-dlp",
      },
      status: "extracting_audio",
    });

    try {
      await runYtDlpAudioDownload({
        outputTemplate: join(tempDirectory, "%(id)s.%(ext)s"),
        sourceUrl: input.sourceUrl,
        ytDlpPath,
      });
    } catch (caught) {
      ytDlpError = caught;
    }

    const audioFile = await findBestYtDlpAudioFile(tempDirectory);

    if (!audioFile) {
      if (ytDlpError) {
        throw new TranscriptFetchError(
          "bilibili",
          `yt-dlp 音频下载失败：${getYtDlpErrorDetail(ytDlpError)}`,
          ytDlpError,
        );
      }

      throw new TranscriptNotFoundError(
        "bilibili",
        "yt-dlp 未下载到可用于转写的音频文件。",
      );
    }

    const fasterWhisperOptions = getFasterWhisperOptions();

    await notifyTranscriptProgress(input, {
      message: "音频已下载，开始 faster-whisper 转写。",
      metadata: {
        audioDownloadDurationMs: Date.now() - audioDownloadStartedAt,
        audioExtension: audioFile.extension,
        computeType: fasterWhisperOptions.computeType,
        device: fasterWhisperOptions.device,
        language: fasterWhisperOptions.language ?? null,
        model: fasterWhisperOptions.model,
        provider: "faster-whisper",
        vadFilter: fasterWhisperOptions.vadFilter,
      },
      status: "transcribing_audio",
    });

    const transcription = await transcribeAudioWithFasterWhisper(
      audioFile,
      fasterWhisperOptions,
    );

    if (!transcription.plainText?.trim()) {
      throw new TranscriptNotFoundError(
        "bilibili",
        "ASR 未返回可用转写文本。",
      );
    }

    return transcription;
  } catch (caught) {
    if (
      caught instanceof TranscriptFetchError ||
      caught instanceof TranscriptNotFoundError
    ) {
      throw caught;
    }

    throw new TranscriptFetchError(
      "bilibili",
      "Bilibili 音频转写失败。",
      caught,
    );
  } finally {
    await rm(tempDirectory, {
      force: true,
      recursive: true,
    });
  }
}

async function notifyTranscriptProgress(
  input: FetchTranscriptInput,
  event: TranscriptProgressEvent,
) {
  await input.onProgress?.(event);
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

type RunYtDlpAudioDownloadInput = {
  outputTemplate: string;
  sourceUrl: string;
  ytDlpPath: string;
};

async function runYtDlpAudioDownload(input: RunYtDlpAudioDownloadInput) {
  const args = [
    "--no-playlist",
    "--format",
    "bestaudio[ext=m4a]/bestaudio",
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

type YtDlpAudioFile = {
  extension: string;
  path: string;
  priority: number;
};

async function findBestYtDlpAudioFile(
  directory: string,
): Promise<YtDlpAudioFile | null> {
  const fileNames = await readdir(directory);
  const audioFiles = fileNames
    .map((fileName) => toYtDlpAudioFile(directory, fileName))
    .filter((file): file is YtDlpAudioFile => file !== null)
    .sort((left, right) => left.priority - right.priority);

  return audioFiles[0] ?? null;
}

function toYtDlpAudioFile(
  directory: string,
  fileName: string,
): YtDlpAudioFile | null {
  const match = /\.([^.]+)$/u.exec(fileName);

  if (!match) {
    return null;
  }

  const extension = match[1]!.toLowerCase();
  const supportedExtensions = new Set([
    "m4a",
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "opus",
    "wav",
    "webm",
  ]);

  if (!supportedExtensions.has(extension)) {
    return null;
  }

  return {
    extension,
    path: join(directory, fileName),
    priority: getYtDlpAudioFilePriority(extension),
  };
}

function getYtDlpAudioFilePriority(extension: string) {
  if (extension === "m4a") {
    return 0;
  }

  if (extension === "mp3" || extension === "mp4") {
    return 1;
  }

  return 2;
}

async function transcribeAudioWithFasterWhisper(
  audioFile: YtDlpAudioFile,
  options = getFasterWhisperOptions(),
): Promise<TranscriptResult> {
  const args = [
    resolveFasterWhisperScriptPath(),
    "--audio",
    audioFile.path,
    "--model",
    options.model,
    "--device",
    options.device,
    "--compute-type",
    options.computeType,
    "--beam-size",
    options.beamSize,
  ];

  if (options.language) {
    args.push("--language", options.language);
  }

  if (options.vadFilter) {
    args.push("--vad-filter");
  }

  let stdout: string;

  try {
    ({ stdout } = await execFileAsync(options.pythonPath, args, {
      env: process.env,
      maxBuffer: 1024 * 1024 * 30,
      timeout: bilibiliAsrTimeoutMs,
      windowsHide: true,
    }));
  } catch (caught) {
    throw new TranscriptFetchError(
      "bilibili",
      `faster-whisper 执行失败：${getYtDlpErrorDetail(caught)}`,
      caught,
    );
  }

  let responseBody: unknown;

  try {
    responseBody = JSON.parse(stdout);
  } catch (caught) {
    throw new TranscriptFetchError(
      "bilibili",
      "faster-whisper 输出不是有效 JSON。",
      caught,
    );
  }

  const parsedTranscription =
    fasterWhisperTranscriptionResponseSchema.safeParse(responseBody);

  if (!parsedTranscription.success) {
    throw new TranscriptFetchError(
      "bilibili",
      "faster-whisper 输出结构无效。",
      parsedTranscription.error,
    );
  }

  const segments = toAsrTranscriptSegments(parsedTranscription.data);
  const plainText =
    parsedTranscription.data.text?.trim() ||
    segments.map((segment) => segment.text).join("\n");

  return {
    language: parsedTranscription.data.language ?? null,
    plainText,
    segments:
      segments.length > 0
        ? segments
        : [
            {
              endSeconds: null,
              startSeconds: null,
              text: plainText,
            },
          ],
    source: "asr",
  };
}

function getFasterWhisperOptions() {
  return {
    beamSize: process.env.FASTER_WHISPER_BEAM_SIZE ?? "5",
    computeType: process.env.FASTER_WHISPER_COMPUTE_TYPE ?? "int8",
    device: process.env.FASTER_WHISPER_DEVICE ?? "cpu",
    language: process.env.FASTER_WHISPER_LANGUAGE || null,
    model: process.env.FASTER_WHISPER_MODEL ?? defaultFasterWhisperModel,
    pythonPath: process.env.FASTER_WHISPER_PYTHON_PATH ?? "python",
    vadFilter: process.env.FASTER_WHISPER_VAD_FILTER !== "false",
  };
}

function resolveFasterWhisperScriptPath() {
  const configuredScriptPath = process.env.FASTER_WHISPER_SCRIPT_PATH;

  if (configuredScriptPath) {
    return configuredScriptPath;
  }

  const candidates = [
    resolve(process.cwd(), "scripts/asr/faster-whisper-transcribe.py"),
    resolve(process.cwd(), "../../scripts/asr/faster-whisper-transcribe.py"),
  ];
  const scriptPath = candidates.find((candidate) => existsSync(candidate));

  if (!scriptPath) {
    throw new TranscriptFetchError(
      "bilibili",
      "找不到 faster-whisper 转写脚本，请配置 FASTER_WHISPER_SCRIPT_PATH。",
    );
  }

  return scriptPath;
}

function toAsrTranscriptSegments(
  transcription: z.infer<typeof fasterWhisperTranscriptionResponseSchema>,
) {
  return (
    transcription.segments
      ?.map((segment) => ({
        endSeconds: segment.end ?? null,
        startSeconds: segment.start ?? null,
        text: segment.text?.replace(/\s+/gu, " ").trim() ?? "",
      }))
      .filter((segment) => segment.text.length > 0) ?? []
  );
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
