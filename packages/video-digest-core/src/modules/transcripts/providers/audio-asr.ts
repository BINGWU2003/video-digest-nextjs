import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { VideoPlatform } from "@video-digest-nextjs/database";
import { z } from "zod";

import type { FetchTranscriptInput, TranscriptResult } from "../types.js";
import { TranscriptFetchError, TranscriptNotFoundError } from "../types.js";

const audioYtDlpTimeoutMs = 120_000;
const audioAsrTimeoutMs = 1_800_000;
const defaultFasterWhisperModel = "small";
const ytDlpAudioFormat = "bestaudio[ext=m4a]/bestaudio";
const execFileAsync = promisify(execFile);

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

type FetchAudioAsrTranscriptInput = FetchTranscriptInput & {
  platform: VideoPlatform;
  platformLabel: string;
  tempDirectoryPrefix: string;
};

type YtDlpAudioFile = {
  extension: string;
  path: string;
  priority: number;
};

export async function fetchAudioAsrTranscriptWithYtDlp(
  input: FetchAudioAsrTranscriptInput,
): Promise<TranscriptResult> {
  const ytDlpPath = process.env.YTDLP_PATH ?? "yt-dlp";
  const tempDirectory = await mkdtemp(join(tmpdir(), input.tempDirectoryPrefix));
  const audioDownloadStartedAt = Date.now();
  let ytDlpError: unknown = null;

  try {
    await input.onProgress?.({
      message: `开始下载 ${input.platformLabel} 音频。`,
      metadata: {
        format: ytDlpAudioFormat,
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
          input.platform,
          `yt-dlp 音频下载失败：${getProcessErrorDetail(ytDlpError)}`,
          ytDlpError,
        );
      }

      throw new TranscriptNotFoundError(
        input.platform,
        "yt-dlp 未下载到可用于转写的音频文件。",
      );
    }

    const fasterWhisperOptions = getFasterWhisperOptions();

    await input.onProgress?.({
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
      input.platform,
      audioFile,
      fasterWhisperOptions,
    );

    if (!transcription.plainText?.trim()) {
      throw new TranscriptNotFoundError(
        input.platform,
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
      input.platform,
      `${input.platformLabel} 音频转写失败。`,
      caught,
    );
  } finally {
    await rm(tempDirectory, {
      force: true,
      recursive: true,
    });
  }
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
    ytDlpAudioFormat,
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
    timeout: audioYtDlpTimeoutMs,
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

type FasterWhisperOptions = ReturnType<typeof getFasterWhisperOptions>;

async function transcribeAudioWithFasterWhisper(
  platform: VideoPlatform,
  audioFile: YtDlpAudioFile,
  options: FasterWhisperOptions,
): Promise<TranscriptResult> {
  const args = [
    resolveFasterWhisperScriptPath(platform),
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
      timeout: audioAsrTimeoutMs,
      windowsHide: true,
    }));
  } catch (caught) {
    throw new TranscriptFetchError(
      platform,
      `faster-whisper 执行失败：${getProcessErrorDetail(caught)}`,
      caught,
    );
  }

  let responseBody: unknown;

  try {
    responseBody = JSON.parse(stdout);
  } catch (caught) {
    throw new TranscriptFetchError(
      platform,
      "faster-whisper 输出不是有效 JSON。",
      caught,
    );
  }

  const parsedTranscription =
    fasterWhisperTranscriptionResponseSchema.safeParse(responseBody);

  if (!parsedTranscription.success) {
    throw new TranscriptFetchError(
      platform,
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

function resolveFasterWhisperScriptPath(platform: VideoPlatform) {
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
      platform,
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

function getProcessErrorDetail(caught: unknown) {
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
