export type RecordStatus =
  | "queued"
  | "fetching_metadata"
  | "extracting_transcript"
  | "transcribing_audio"
  | "summarizing"
  | "delivering"
  | "completed"
  | "failed";

export type VideoRecord = {
  id: string;
  title: string;
  author: string;
  sourceUrl: string;
  platform: "YouTube" | "Bilibili";
  status: RecordStatus;
  createdAt: string;
  completedAt?: string;
  duration: string;
  transcriptSource:
    | "Manual subtitles"
    | "Auto subtitles"
    | "Audio transcription";
  deliveryStatus: "Not sent" | "Queued" | "Sent" | "Failed";
  createdBy: string;
  summary: {
    short: string;
    keyPoints: string[];
    timeline: Array<{ time: string; topic: string; summary: string }>;
    takeaways: string[];
  };
  transcript: Array<{ time: string; text: string }>;
  error?: {
    code: string;
    message: string;
    action: string;
  };
};

export const statusLabels: Record<RecordStatus, string> = {
  queued: "Waiting",
  fetching_metadata: "Reading video info",
  extracting_transcript: "Extracting subtitles",
  transcribing_audio: "Transcribing audio",
  summarizing: "Summarizing",
  delivering: "Sending email",
  completed: "Completed",
  failed: "Failed",
};

export const records: VideoRecord[] = [
  {
    id: "rec_1038",
    title: "Building AI products that users actually trust",
    author: "Design Systems Weekly",
    sourceUrl: "https://www.youtube.com/watch?v=trust-ai-product",
    platform: "YouTube",
    status: "completed",
    createdAt: "2026-05-20 13:42",
    completedAt: "2026-05-20 13:48",
    duration: "28m 14s",
    transcriptSource: "Manual subtitles",
    deliveryStatus: "Sent",
    createdBy: "Created from website",
    summary: {
      short:
        "The talk frames trust as a product behavior, not a brand claim. It recommends exposing uncertainty, making source material reachable, and designing recovery states before adding more automation.",
      keyPoints: [
        "Trust improves when AI output keeps a visible path back to source evidence.",
        "Users need clear controls for retrying, editing, and escalating failures.",
        "Teams should measure correction rate and time-to-confidence, not only task completion.",
      ],
      timeline: [
        {
          time: "00:00",
          topic: "Trust definition",
          summary:
            "Trust is introduced as repeated evidence that the product behaves predictably.",
        },
        {
          time: "08:40",
          topic: "Interface patterns",
          summary:
            "The speaker compares confidence labels, citations, undo flows, and preview states.",
        },
        {
          time: "21:05",
          topic: "Team metrics",
          summary:
            "The closing section maps user confidence to operational metrics.",
        },
      ],
      takeaways: [
        "Make every summary traceable to transcript segments.",
        "Keep regeneration and delivery as explicit user actions.",
        "Treat failed jobs as recoverable workflows.",
      ],
    },
    transcript: [
      {
        time: "00:12",
        text: "When people say they do not trust AI, they are usually describing a missing product affordance.",
      },
      {
        time: "08:52",
        text: "A confidence badge is useful only when the user can inspect what created that confidence.",
      },
      {
        time: "21:18",
        text: "Measure the moments where users correct the system, because that is where the product learns what trust costs.",
      },
    ],
  },
  {
    id: "rec_1037",
    title: "2026 front-end architecture review",
    author: "工程效率实验室",
    sourceUrl: "https://www.bilibili.com/video/BV1frontend2026",
    platform: "Bilibili",
    status: "summarizing",
    createdAt: "2026-05-20 12:06",
    duration: "41m 02s",
    transcriptSource: "Auto subtitles",
    deliveryStatus: "Queued",
    createdBy: "Created by MCP token: Cursor Agent",
    summary: {
      short:
        "The job has extracted subtitles and is generating a structured summary with architecture tradeoffs, adoption risks, and action items.",
      keyPoints: [
        "The speaker contrasts monorepo ownership with independently deployed front-end surfaces.",
        "Build pipeline time is treated as a product reliability metric.",
        "Teams should keep route-level observability close to product analytics.",
      ],
      timeline: [
        {
          time: "03:30",
          topic: "Monorepo boundaries",
          summary:
            "The video introduces package ownership and release coordination risks.",
        },
        {
          time: "18:16",
          topic: "Runtime choices",
          summary:
            "The speaker compares server components, edge rendering, and client-only islands.",
        },
      ],
      takeaways: [
        "Wait for summary generation to finish before sending email.",
      ],
    },
    transcript: [
      {
        time: "03:30",
        text: "前端架构的核心不是目录怎么分，而是谁能安全地改变它。",
      },
      {
        time: "18:16",
        text: "渲染策略应该跟业务路径绑定，而不是跟框架宣传绑定。",
      },
    ],
  },
  {
    id: "rec_1036",
    title: "No-code workflow automation case study",
    author: "Ops Notes",
    sourceUrl: "https://youtu.be/workflow-digest-case",
    platform: "YouTube",
    status: "failed",
    createdAt: "2026-05-19 19:20",
    duration: "16m 49s",
    transcriptSource: "Auto subtitles",
    deliveryStatus: "Not sent",
    createdBy: "Created from website",
    summary: {
      short:
        "The video could not be summarized because no subtitles were available and audio transcription was disabled.",
      keyPoints: [],
      timeline: [],
      takeaways: [],
    },
    transcript: [],
    error: {
      code: "NO_TRANSCRIPT_AND_AUDIO_DISABLED",
      message:
        "No subtitles were found for this video. Audio transcription was disabled.",
      action: "Retry with audio transcription",
    },
  },
  {
    id: "rec_1035",
    title: "The economics of creator education",
    author: "Knowledge Market",
    sourceUrl: "https://www.youtube.com/watch?v=creator-education",
    platform: "YouTube",
    status: "completed",
    createdAt: "2026-05-18 10:11",
    completedAt: "2026-05-18 10:18",
    duration: "35m 33s",
    transcriptSource: "Audio transcription",
    deliveryStatus: "Sent",
    createdBy: "Created by scheduled job",
    summary: {
      short:
        "Creator education is shifting from one-off courses to durable learning systems built around community proof, cohort cadence, and reusable media assets.",
      keyPoints: [
        "The strongest products pair high-trust instructors with repeatable learning loops.",
        "Cohort accountability keeps completion rates higher than evergreen libraries.",
        "Distribution depends on clips, newsletters, and lightweight post-course assets.",
      ],
      timeline: [
        {
          time: "04:12",
          topic: "Market shift",
          summary:
            "The host describes the move from impulse course sales to membership education.",
        },
        {
          time: "23:44",
          topic: "Retention",
          summary:
            "The video explains why office hours and peer review improve retention.",
        },
      ],
      takeaways: [
        "Summaries should preserve examples and numbers for future research.",
        "Collections would help group videos from the same creator economy topic.",
      ],
    },
    transcript: [
      {
        time: "04:12",
        text: "The market is no longer rewarding information alone; it rewards transformation that people can point to.",
      },
      {
        time: "23:44",
        text: "The office hour is not a support channel. It is a public proof engine.",
      },
    ],
  },
];

export const verifiedEmails = [
  {
    address: "alex@example.com",
    status: "Verified",
    default: true,
    lastSentAt: "2026-05-20 13:49",
  },
  {
    address: "research@example.com",
    status: "Pending verification",
    default: false,
    lastSentAt: "Never",
  },
];

export const mcpTokens = [
  {
    name: "Cursor Agent",
    scopes: ["create:jobs", "read:records", "send:email"],
    lastUsedAt: "2026-05-20 12:06",
    status: "Active",
  },
  {
    name: "Weekly Research Runner",
    scopes: ["create:jobs", "read:records"],
    lastUsedAt: "2026-05-18 10:11",
    status: "Active",
  },
];

export const usageStats = [
  { label: "Created tasks", value: "42", limit: "100" },
  { label: "Subtitle extractions", value: "37", limit: "100" },
  { label: "Audio transcription", value: "186 min", limit: "300 min" },
  { label: "Emails sent", value: "28", limit: "100" },
  { label: "Failures", value: "3", limit: "Tracked" },
];
