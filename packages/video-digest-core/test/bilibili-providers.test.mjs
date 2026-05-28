import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { afterEach, describe, test, vi } from "vitest";

import {
  createBilibiliTranscriptProvider,
  createBilibiliVideoMetadataProvider,
  TranscriptFetchError,
  VideoMetadataFetchError,
} from "../dist/index.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);
const sourceUrl = "https://www.bilibili.com/video/BV1xx411c7mD";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.FASTER_WHISPER_BEAM_SIZE;
  delete process.env.FASTER_WHISPER_COMPUTE_TYPE;
  delete process.env.FASTER_WHISPER_DEVICE;
  delete process.env.FASTER_WHISPER_LANGUAGE;
  delete process.env.FASTER_WHISPER_MODEL;
  delete process.env.FASTER_WHISPER_PYTHON_PATH;
  delete process.env.FASTER_WHISPER_SCRIPT_PATH;
  delete process.env.FASTER_WHISPER_VAD_FILTER;
  delete process.env.LOCAL_PROXY_URL;
  delete process.env.YTDLP_PATH;
});

describe("createBilibiliVideoMetadataProvider", () => {
  test("reads Bilibili metadata through yt-dlp", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, {
        stderr: "",
        stdout: JSON.stringify({
          duration: 123.4,
          thumbnail: null,
          thumbnails: [{ url: "https://example.com/small.jpg" }],
          title: "Bilibili Demo",
          uploader: "Demo UP",
        }),
      });
    });

    const provider = createBilibiliVideoMetadataProvider();
    const metadata = await provider.fetchMetadata({
      platform: "bilibili",
      sourceUrl,
    });

    assert.equal(metadata.platform, "bilibili");
    assert.equal(metadata.title, "Bilibili Demo");
    assert.equal(metadata.author, "Demo UP");
    assert.equal(metadata.durationSeconds, 123);
    assert.equal(metadata.thumbnailUrl, "https://example.com/small.jpg");
    assert.ok(metadata.fetchedAt instanceof Date);

    assert.equal(execFileMock.mock.calls[0][0], "yt-dlp");
    assert.deepEqual(execFileMock.mock.calls[0][1], [
      "--dump-single-json",
      "--skip-download",
      "--no-playlist",
      sourceUrl,
    ]);
  });

  test("wraps yt-dlp metadata failures", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(new Error("boom"), {
        stderr: "boom",
        stdout: "",
      });
    });

    const provider = createBilibiliVideoMetadataProvider();

    await assert.rejects(
      provider.fetchMetadata({
        platform: "bilibili",
        sourceUrl,
      }),
      VideoMetadataFetchError,
    );
  });
});

describe("createBilibiliTranscriptProvider", () => {
  test("downloads and parses Bilibili JSON subtitles through yt-dlp", async () => {
    execFileMock.mockImplementation((_command, args, options, callback) => {
      const outputTemplate = args[args.indexOf("--output") + 1];
      const directory = dirname(outputTemplate);

      void (async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(
          join(directory, "demo.zh-CN.json"),
          JSON.stringify({
            body: [
              { content: "第一段", from: 0, to: 2.5 },
              { content: "第二段", from: 2.5, to: 5 },
            ],
          }),
          "utf8",
        );
        callback(null, { stderr: "", stdout: "" });
      })();
    });

    const provider = createBilibiliTranscriptProvider();
    const transcript = await provider.fetchTranscript({
      fallbackToAudio: false,
      platform: "bilibili",
      sourceUrl,
    });

    assert.equal(transcript.language, "zh-CN");
    assert.equal(transcript.source, "manual_subtitle");
    assert.equal(transcript.plainText, "第一段\n第二段");
    assert.deepEqual(transcript.segments, [
      { endSeconds: 2.5, startSeconds: 0, text: "第一段" },
      { endSeconds: 5, startSeconds: 2.5, text: "第二段" },
    ]);

    assert.equal(execFileMock.mock.calls[0][0], "yt-dlp");
    assert.deepEqual(execFileMock.mock.calls[0][1].slice(0, 8), [
      "--skip-download",
      "--no-playlist",
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      "zh.*,en.*",
      "--sub-format",
      "json/vtt/srt/best",
    ]);
  });

  test("wraps yt-dlp subtitle failures", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(
        Object.assign(new Error("Command failed"), {
          stderr: "ERROR: subtitles unavailable",
        }),
      );
    });

    const provider = createBilibiliTranscriptProvider();

    await assert.rejects(
      provider.fetchTranscript({
        fallbackToAudio: false,
        platform: "bilibili",
        sourceUrl,
      }),
      TranscriptFetchError,
    );
  });

  test("downloads Bilibili audio and transcribes it with faster-whisper when audio fallback is enabled", async () => {
    const progressEvents = [];

    process.env.FASTER_WHISPER_PYTHON_PATH = "python-test";
    process.env.FASTER_WHISPER_SCRIPT_PATH =
      "D:\\code\\next-project\\video-digest-nextjs\\scripts\\asr\\faster-whisper-transcribe.py";
    process.env.FASTER_WHISPER_MODEL = "base";
    process.env.FASTER_WHISPER_LANGUAGE = "zh";

    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes("--output")) {
        const outputTemplate = args[args.indexOf("--output") + 1];
        const directory = dirname(outputTemplate);

        void (async () => {
          await mkdir(directory, { recursive: true });
          await writeFile(join(directory, "demo.m4a"), Buffer.from([1, 2, 3]));
          callback(null, { stderr: "", stdout: "" });
        })();
        return;
      }

      callback(null, {
        stderr: "",
        stdout: JSON.stringify({
          language: "zh",
          segments: [
            { end: 2.2, start: 0, text: "音频第一段" },
            { end: 5.1, start: 2.2, text: "音频第二段" },
          ],
          text: "音频第一段\n音频第二段",
        }),
      });
    });

    const provider = createBilibiliTranscriptProvider();
    const transcript = await provider.fetchTranscript({
      fallbackToAudio: true,
      onProgress: async (event) => {
        progressEvents.push(event);
      },
      platform: "bilibili",
      sourceUrl,
    });

    assert.equal(transcript.language, "zh");
    assert.equal(transcript.source, "asr");
    assert.equal(transcript.plainText, "音频第一段\n音频第二段");
    assert.deepEqual(transcript.segments, [
      { endSeconds: 2.2, startSeconds: 0, text: "音频第一段" },
      { endSeconds: 5.1, startSeconds: 2.2, text: "音频第二段" },
    ]);

    assert.equal(execFileMock.mock.calls[0][0], "yt-dlp");
    assert.deepEqual(execFileMock.mock.calls[0][1].slice(0, 4), [
      "--no-playlist",
      "--format",
      "bestaudio[ext=m4a]/bestaudio",
      "--output",
    ]);

    assert.equal(execFileMock.mock.calls[1][0], "python-test");
    assert.deepEqual(execFileMock.mock.calls[1][1], [
      "D:\\code\\next-project\\video-digest-nextjs\\scripts\\asr\\faster-whisper-transcribe.py",
      "--audio",
      join(
        dirname(
          execFileMock.mock.calls[0][1][
            execFileMock.mock.calls[0][1].indexOf("--output") + 1
          ],
        ),
        "demo.m4a",
      ),
      "--model",
      "base",
      "--device",
      "cpu",
      "--compute-type",
      "int8",
      "--beam-size",
      "5",
      "--language",
      "zh",
      "--vad-filter",
    ]);
    assert.deepEqual(
      progressEvents.map((event) => event.status),
      ["extracting_audio", "transcribing_audio"],
    );
    assert.equal(progressEvents[0].metadata.provider, "yt-dlp");
    assert.equal(progressEvents[1].metadata.provider, "faster-whisper");
    assert.equal(progressEvents[1].metadata.model, "base");
    assert.equal(progressEvents[1].metadata.device, "cpu");
  });

  test("wraps faster-whisper failures for Bilibili audio fallback", async () => {
    process.env.FASTER_WHISPER_SCRIPT_PATH =
      "D:\\code\\next-project\\video-digest-nextjs\\scripts\\asr\\faster-whisper-transcribe.py";
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes("--output")) {
        const outputTemplate = args[args.indexOf("--output") + 1];
        const directory = dirname(outputTemplate);

        void (async () => {
          await mkdir(directory, { recursive: true });
          await writeFile(join(directory, "demo.m4a"), Buffer.from([1, 2, 3]));
          callback(null, { stderr: "", stdout: "" });
        })();
        return;
      }

      callback(
        Object.assign(new Error("Command failed"), {
          stderr: "ModuleNotFoundError: No module named 'faster_whisper'",
        }),
      );
    });

    const provider = createBilibiliTranscriptProvider();

    await assert.rejects(
      provider.fetchTranscript({
        fallbackToAudio: true,
        platform: "bilibili",
        sourceUrl,
      }),
      TranscriptFetchError,
    );
  });
});
