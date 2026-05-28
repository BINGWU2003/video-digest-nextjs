import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { afterEach, describe, test, vi } from "vitest";

import {
  createYoutubeTranscriptProvider,
  TranscriptFetchError,
} from "../dist/index.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);
const sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

afterEach(() => {
  vi.clearAllMocks();
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

describe("createYoutubeTranscriptProvider", () => {
  test("downloads and parses YouTube json3 subtitles through yt-dlp", async () => {
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      const outputTemplate = args[args.indexOf("--output") + 1];
      const directory = dirname(outputTemplate);

      void (async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(
          join(directory, "demo.zh-Hans.json3"),
          JSON.stringify({
            events: [
              {
                dDurationMs: 2500,
                segs: [{ utf8: "第一段" }],
                tStartMs: 0,
              },
              {
                dDurationMs: 2500,
                segs: [{ utf8: "第二段" }],
                tStartMs: 2500,
              },
            ],
          }),
          "utf8",
        );
        callback(null, { stderr: "", stdout: "" });
      })();
    });

    const provider = createYoutubeTranscriptProvider();
    const transcript = await provider.fetchTranscript({
      fallbackToAudio: true,
      platform: "youtube",
      sourceUrl,
    });

    assert.equal(transcript.language, "zh-Hans");
    assert.equal(transcript.source, "manual_subtitle");
    assert.equal(transcript.plainText, "第一段\n第二段");
    assert.deepEqual(transcript.segments, [
      { endSeconds: 2.5, startSeconds: 0, text: "第一段" },
      { endSeconds: 5, startSeconds: 2.5, text: "第二段" },
    ]);
    assert.equal(execFileMock.mock.calls.length, 1);
    assert.deepEqual(execFileMock.mock.calls[0][1].slice(0, 8), [
      "--skip-download",
      "--no-playlist",
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      "yue.*,zh.*,en.*,-live_chat",
      "--sub-format",
      "json3/vtt/best",
    ]);
  });

  test("falls back to faster-whisper ASR when YouTube subtitles are unavailable", async () => {
    const progressEvents = [];

    process.env.FASTER_WHISPER_PYTHON_PATH = "python-test";
    process.env.FASTER_WHISPER_SCRIPT_PATH =
      "D:\\code\\next-project\\video-digest-nextjs\\scripts\\asr\\faster-whisper-transcribe.py";
    process.env.FASTER_WHISPER_MODEL = "base";
    process.env.FASTER_WHISPER_LANGUAGE = "zh";

    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes("--skip-download")) {
        callback(
          Object.assign(new Error("Command failed"), {
            stderr: "WARNING: There are no subtitles for the requested languages",
          }),
        );
        return;
      }

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

    const provider = createYoutubeTranscriptProvider();
    const transcript = await provider.fetchTranscript({
      fallbackToAudio: true,
      onProgress: async (event) => {
        progressEvents.push(event);
      },
      platform: "youtube",
      sourceUrl,
    });

    assert.equal(transcript.language, "zh");
    assert.equal(transcript.source, "asr");
    assert.equal(transcript.plainText, "音频第一段\n音频第二段");
    assert.deepEqual(transcript.segments, [
      { endSeconds: 2.2, startSeconds: 0, text: "音频第一段" },
      { endSeconds: 5.1, startSeconds: 2.2, text: "音频第二段" },
    ]);
    assert.equal(execFileMock.mock.calls[1][0], "yt-dlp");
    assert.deepEqual(execFileMock.mock.calls[1][1].slice(0, 4), [
      "--no-playlist",
      "--format",
      "bestaudio[ext=m4a]/bestaudio",
      "--output",
    ]);
    assert.equal(execFileMock.mock.calls[2][0], "python-test");
    assert.deepEqual(
      progressEvents.map((event) => event.status),
      ["extracting_audio", "transcribing_audio"],
    );
    assert.equal(progressEvents[0].metadata.provider, "yt-dlp");
    assert.equal(progressEvents[1].metadata.provider, "faster-whisper");
    assert.equal(progressEvents[1].metadata.model, "base");
  });

  test("does not use ASR fallback when audio fallback is disabled", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(
        Object.assign(new Error("Command failed"), {
          stderr: "WARNING: There are no subtitles for the requested languages",
        }),
      );
    });

    const provider = createYoutubeTranscriptProvider();

    await assert.rejects(
      provider.fetchTranscript({
        fallbackToAudio: false,
        platform: "youtube",
        sourceUrl,
      }),
      TranscriptFetchError,
    );
    assert.equal(execFileMock.mock.calls.length, 1);
  });
});
