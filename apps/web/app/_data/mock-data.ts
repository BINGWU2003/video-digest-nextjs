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
  transcriptSource: "手动字幕" | "自动字幕" | "音频转写";
  deliveryStatus: "未发送" | "排队中" | "已提交服务商" | "发送失败";
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
  queued: "等待中",
  fetching_metadata: "读取视频信息",
  extracting_transcript: "提取字幕",
  transcribing_audio: "音频转写",
  summarizing: "生成摘要",
  delivering: "发送邮件",
  completed: "已完成",
  failed: "失败",
};

export const records: VideoRecord[] = [
  {
    id: "rec_1038",
    title: "构建真正值得用户信任的 AI 产品",
    author: "Design Systems Weekly",
    sourceUrl: "https://www.youtube.com/watch?v=trust-ai-product",
    platform: "YouTube",
    status: "completed",
    createdAt: "2026-05-20 13:42",
    completedAt: "2026-05-20 13:48",
    duration: "28 分 14 秒",
    transcriptSource: "手动字幕",
    deliveryStatus: "已提交服务商",
    createdBy: "来自网站创建",
    summary: {
      short:
        "这场分享把信任定义为一种产品行为，而不是品牌口号。演讲者建议在界面中展示不确定性、让用户能够回到原始材料，并在增加自动化能力前先设计好失败恢复路径。",
      keyPoints: [
        "AI 输出越容易追溯到来源证据，用户越容易建立信任。",
        "用户需要清晰的重试、编辑和失败升级控制。",
        "团队不应只看任务完成率，还要衡量修正率和用户建立信心所需时间。",
      ],
      timeline: [
        {
          time: "00:00",
          topic: "信任的定义",
          summary: "演讲者将信任描述为产品持续表现出可预测行为后的结果。",
        },
        {
          time: "08:40",
          topic: "界面模式",
          summary: "对比了置信度标签、引用来源、撤销流程和预览状态。",
        },
        {
          time: "21:05",
          topic: "团队指标",
          summary: "结尾把用户信心映射到可运营的产品指标。",
        },
      ],
      takeaways: [
        "每一段摘要都应该能追溯到字幕片段。",
        "重新生成和邮件投递都应是明确的用户操作。",
        "失败任务要被设计成可恢复流程。",
      ],
    },
    transcript: [
      {
        time: "00:12",
        text: "当人们说不信任 AI 时，他们通常是在描述某个缺失的产品能力。",
      },
      {
        time: "08:52",
        text: "置信度标签只有在用户能检查它从何而来时才有意义。",
      },
      {
        time: "21:18",
        text: "要衡量用户修正系统的时刻，因为那正是产品理解信任成本的地方。",
      },
    ],
  },
  {
    id: "rec_1037",
    title: "2026 前端架构复盘",
    author: "工程效率实验室",
    sourceUrl: "https://www.bilibili.com/video/BV1frontend2026",
    platform: "Bilibili",
    status: "summarizing",
    createdAt: "2026-05-20 12:06",
    duration: "41 分 02 秒",
    transcriptSource: "自动字幕",
    deliveryStatus: "排队中",
    createdBy: "由 MCP 令牌创建：Cursor 智能体",
    summary: {
      short:
        "任务已完成字幕提取，正在生成结构化摘要，内容会覆盖架构取舍、落地风险和行动建议。",
      keyPoints: [
        "视频对比了 monorepo 所有权和独立部署前端面的差异。",
        "构建流水线耗时被视为产品可靠性指标。",
        "团队应让路由级可观测性贴近产品分析。",
      ],
      timeline: [
        {
          time: "03:30",
          topic: "Monorepo 边界",
          summary: "视频介绍了包所有权和发布协同风险。",
        },
        {
          time: "18:16",
          topic: "运行时选择",
          summary: "对比了服务端组件、边缘渲染和客户端 islands。",
        },
      ],
      takeaways: ["等待摘要生成完成后再发送邮件。"],
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
    title: "无代码工作流自动化案例研究",
    author: "Ops Notes",
    sourceUrl: "https://youtu.be/workflow-digest-case",
    platform: "YouTube",
    status: "failed",
    createdAt: "2026-05-19 19:20",
    duration: "16 分 49 秒",
    transcriptSource: "自动字幕",
    deliveryStatus: "未发送",
    createdBy: "来自网站创建",
    summary: {
      short: "该视频未能生成摘要，因为没有找到字幕，并且未启用音频转写。",
      keyPoints: [],
      timeline: [],
      takeaways: [],
    },
    transcript: [],
    error: {
      code: "NO_TRANSCRIPT_AND_AUDIO_DISABLED",
      message: "没有找到该视频的字幕，且音频转写已关闭。",
      action: "启用音频转写后重试",
    },
  },
  {
    id: "rec_1035",
    title: "创作者教育的商业逻辑",
    author: "Knowledge Market",
    sourceUrl: "https://www.youtube.com/watch?v=creator-education",
    platform: "YouTube",
    status: "completed",
    createdAt: "2026-05-18 10:11",
    completedAt: "2026-05-18 10:18",
    duration: "35 分 33 秒",
    transcriptSource: "音频转写",
    deliveryStatus: "已提交服务商",
    createdBy: "由定时任务创建",
    summary: {
      short:
        "创作者教育正在从一次性课程销售转向更持久的学习系统，核心由社区证明、训练营节奏和可复用内容资产组成。",
      keyPoints: [
        "最强的教育产品会把高信任讲师和可重复学习闭环结合起来。",
        "训练营式的同伴约束比纯内容库更能提升完成率。",
        "内容分发依赖切片视频、newsletter 和课后轻量资产。",
      ],
      timeline: [
        {
          time: "04:12",
          topic: "市场变化",
          summary: "主持人描述课程销售从冲动购买转向会员式学习。",
        },
        {
          time: "23:44",
          topic: "留存机制",
          summary: "视频解释了答疑和同伴评审为何能改善留存。",
        },
      ],
      takeaways: [
        "摘要应保留案例和数字，方便后续研究。",
        "合集功能适合把同一创作者经济主题的视频归档在一起。",
      ],
    },
    transcript: [
      {
        time: "04:12",
        text: "市场不再只奖励信息本身，而是奖励用户能明确感受到的改变。",
      },
      {
        time: "23:44",
        text: "答疑时间不是支持渠道，它是公开的信任证明引擎。",
      },
    ],
  },
];

export const verifiedEmails = [
  {
    address: "alex@example.com",
    status: "已验证",
    default: true,
    lastSentAt: "2026-05-20 13:49",
  },
  {
    address: "research@example.com",
    status: "待验证",
    default: false,
    lastSentAt: "从未发送",
  },
];

export const mcpTokens = [
  {
    name: "Cursor 智能体",
    scopes: ["create:jobs", "read:records", "send:email"],
    lastUsedAt: "2026-05-20 12:06",
    status: "启用中",
  },
  {
    name: "每周研究任务",
    scopes: ["create:jobs", "read:records"],
    lastUsedAt: "2026-05-18 10:11",
    status: "启用中",
  },
];

export const usageStats = [
  { label: "创建任务数", value: "42", limit: "100" },
  { label: "字幕提取次数", value: "37", limit: "100" },
  { label: "音频转写时长", value: "186 分钟", limit: "300 分钟" },
  { label: "邮件发送次数", value: "28", limit: "100" },
  { label: "失败次数", value: "3", limit: "持续记录" },
];
