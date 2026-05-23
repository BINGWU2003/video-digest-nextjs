import { z } from "zod";

import type {
  GenerateSummaryInput,
  GeneratedSummary,
  SummaryProvider,
} from "../types.js";
import { SummaryGenerationError } from "../types.js";

const summaryPromptVersion = "summary-v1";
const defaultSummaryModel = "gpt-4o-mini";
const defaultDeepSeekSummaryModel = "deepseek-v4-flash";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const maxTranscriptCharacters = 60_000;
const defaultMaxCompletionTokens = 4_000;
const summaryResponseSchema = z.object({
  keyPoints: z.array(z.string().min(1)).default([]),
  markdown: z.string().min(1).nullable().optional(),
  shortSummary: z.string().min(1).nullable().optional(),
  takeaways: z.array(z.string().min(1)).default([]),
  timeline: z
    .array(
      z.object({
        startSeconds: z.number().nonnegative().nullable().optional(),
        summary: z.string().min(1),
        time: z.string().min(1).nullable().optional(),
        title: z.string().min(1),
      }),
    )
    .default([]),
  title: z.string().min(1).nullable().optional(),
});

const chatCompletionResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
      }),
    }),
  ),
});

export function createOpenAICompatibleSummaryProvider(): SummaryProvider {
  return {
    async generateSummary(input) {
      return generateSummaryWithOpenAICompatibleApi(input);
    },
  };
}

async function generateSummaryWithOpenAICompatibleApi(
  input: GenerateSummaryInput,
): Promise<GeneratedSummary> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new SummaryGenerationError(
      "缺少环境变量 OPENAI_API_KEY 或 DEEPSEEK_API_KEY。",
    );
  }

  const baseUrl = resolveBaseUrl();
  const model = resolveSummaryModel(baseUrl);
  const endpoint = new URL("chat/completions", normalizeBaseUrl(baseUrl));

  let response: Response;

  try {
    response = await fetch(endpoint, {
      body: JSON.stringify({
        messages: [
          {
            content:
              "你是视频内容分析助手。请只输出合法 JSON，不要输出 Markdown 代码块。",
            role: "system",
          },
          {
            content: buildSummaryPrompt(input),
            role: "user",
          },
        ],
        max_tokens: resolveMaxCompletionTokens(),
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (caught) {
    throw new SummaryGenerationError("LLM 网络请求失败。", caught);
  }

  if (!response.ok) {
    throw new SummaryGenerationError(
      `LLM 请求失败，HTTP 状态码 ${response.status}。`,
      await readResponseText(response),
    );
  }

  const completion = chatCompletionResponseSchema.safeParse(
    await response.json(),
  );

  if (!completion.success) {
    throw new SummaryGenerationError(
      "LLM 响应结构无效。",
      completion.error,
    );
  }

  const content = completion.data.choices[0]?.message.content;

  if (!content) {
    throw new SummaryGenerationError("LLM 响应为空。");
  }

  const parsedContent = parseSummaryContent(content);

  return {
    format: input.format,
    keyPoints: parsedContent.keyPoints,
    language: "zh-CN",
    markdown: parsedContent.markdown ?? buildMarkdownFallback(parsedContent),
    model,
    promptVersion: summaryPromptVersion,
    shortSummary: parsedContent.shortSummary ?? null,
    takeaways: parsedContent.takeaways,
    timeline: parsedContent.timeline.map((item) => ({
      startSeconds: item.startSeconds ?? null,
      summary: item.summary,
      time: item.time ?? null,
      title: item.title,
    })),
    title: parsedContent.title ?? input.videoTitle,
  };
}

function resolveBaseUrl() {
  if (process.env.OPENAI_BASE_URL) {
    return process.env.OPENAI_BASE_URL;
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return defaultDeepSeekBaseUrl;
  }

  return defaultBaseUrl;
}

function resolveSummaryModel(baseUrl: string) {
  if (process.env.OPENAI_SUMMARY_MODEL) {
    return process.env.OPENAI_SUMMARY_MODEL;
  }

  if (process.env.DEEPSEEK_SUMMARY_MODEL) {
    return process.env.DEEPSEEK_SUMMARY_MODEL;
  }

  if (baseUrl.includes("deepseek.com")) {
    return defaultDeepSeekSummaryModel;
  }

  return defaultSummaryModel;
}

function resolveMaxCompletionTokens() {
  const rawValue = process.env.OPENAI_SUMMARY_MAX_TOKENS;

  if (!rawValue) {
    return defaultMaxCompletionTokens;
  }

  const parsedValue = Number(rawValue);

  return Number.isSafeInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultMaxCompletionTokens;
}

function buildSummaryPrompt(input: GenerateSummaryInput) {
  const transcript = buildTranscriptText(input);

  return [
    "请根据下面的视频字幕生成中文摘要。",
    "",
    `视频标题：${input.videoTitle ?? "未知"}`,
    `视频作者：${input.videoAuthor ?? "未知"}`,
    `视频链接：${input.sourceUrl}`,
    `字幕语言：${input.transcriptLanguage ?? "未知"}`,
    `摘要格式：${input.format}`,
    "",
    "输出 JSON，字段必须使用 camelCase：",
    "{",
    '  "title": "摘要标题",',
    '  "shortSummary": "150 字以内的概览",',
    '  "keyPoints": ["关键要点 1", "关键要点 2"],',
    '  "timeline": [{"time": "03:12", "startSeconds": 192, "title": "主题", "summary": "说明"}],',
    '  "takeaways": ["结论或行动建议"],',
    '  "markdown": "完整 Markdown 摘要"',
    "}",
    "",
    "要求：保留重要数字、观点和因果关系；不要编造字幕中没有的信息；时间线优先使用字幕时间。",
    "",
    "字幕：",
    transcript,
  ].join("\n");
}

function buildTranscriptText(input: GenerateSummaryInput) {
  const segmentsText = input.segments
    .map((segment) => {
      const time = formatTimestamp(segment.startSeconds);
      return time ? `[${time}] ${segment.text}` : segment.text;
    })
    .join("\n");
  const sourceText = segmentsText || input.plainText || "";

  if (!sourceText.trim()) {
    throw new SummaryGenerationError("字幕为空，无法生成摘要。");
  }

  if (sourceText.length <= maxTranscriptCharacters) {
    return sourceText;
  }

  return `${sourceText.slice(0, maxTranscriptCharacters)}\n\n[字幕过长，已截断用于 MVP 摘要生成]`;
}

function parseSummaryContent(content: string) {
  let responseBody: unknown;

  try {
    responseBody = JSON.parse(stripJsonCodeFence(content));
  } catch (caught) {
    throw new SummaryGenerationError("LLM 输出不是有效 JSON。", caught);
  }

  const parsedSummary = summaryResponseSchema.safeParse(responseBody);

  if (!parsedSummary.success) {
    throw new SummaryGenerationError(
      "LLM 输出结构无效。",
      parsedSummary.error,
    );
  }

  return parsedSummary.data;
}

function buildMarkdownFallback(summary: z.infer<typeof summaryResponseSchema>) {
  return [
    `# ${summary.title ?? "视频摘要"}`,
    "",
    summary.shortSummary ?? "",
    "",
    "## 关键要点",
    ...summary.keyPoints.map((point) => `- ${point}`),
    "",
    "## 时间线",
    ...summary.timeline.map((item) =>
      `- ${item.time ?? "--:--"} ${item.title}：${item.summary}`,
    ),
    "",
    "## 结论",
    ...summary.takeaways.map((takeaway) => `- ${takeaway}`),
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function stripJsonCodeFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function formatTimestamp(seconds: number | null) {
  if (seconds === null) {
    return null;
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}
