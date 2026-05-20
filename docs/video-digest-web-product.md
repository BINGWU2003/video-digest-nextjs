# Video Digest Web Product Design

## 目标

本文档描述 Next.js 网页层的产品设计。它关注用户在网站内如何提交视频 URL、查看多次爬取记录、管理摘要结果、触发邮件投递，以及后续可以扩展的网页功能。

该文档与 `video-digest-mcp-architecture.md` 互补：

- 架构文档关注 MCP、tools、worker、provider 和服务边界。
- 本文档关注用户页面、操作流程、数据展示和产品体验。

## 产品定位

网站是用户使用视频摘要能力的主入口。

用户可以：

- 粘贴 Bilibili 或 YouTube 视频 URL。
- 创建字幕提取或视频摘要任务。
- 查看每一次提交的处理记录。
- 查看任务进度、失败原因和最终摘要。
- 将摘要发送到已验证邮箱。
- 管理历史记录、邮箱、MCP token 和使用额度。

## 核心用户流程

### 单个视频摘要

```txt
用户登录
  -> 首页输入视频 URL
  -> 选择处理选项
  -> 点击创建任务
  -> 页面跳转到任务详情
  -> 显示处理进度
  -> 完成后展示摘要
  -> 用户选择发送邮件或复制内容
```

### 多次上传记录

```txt
用户多次提交 URL
  -> 每次创建一条 digest record
  -> 记录列表按创建时间倒序展示
  -> 用户可以搜索、筛选、打开详情
```

### 外部 agent 与网站记录互通

外部 agent 通过 MCP 创建的任务，也应该出现在用户网站记录中。

```txt
External Agent
  -> MCP create_transcript_job / create_video_digest_job
  -> job 绑定 actor.userId
  -> 网站记录列表展示该任务
```

这样用户能在网页里看到自己网站操作和 agent 操作产生的完整历史。

## 页面结构

### Dashboard

路径建议：

```txt
/dashboard
```

主要区域：

- URL 输入区。
- 最近任务列表。
- 本月使用量。
- 已验证邮箱状态。
- 快捷筛选。

URL 输入区建议包含：

```txt
Video URL
Platform: auto / YouTube / Bilibili
Processing mode:
  subtitles only
  subtitles then audio transcription
Output:
  transcript only
  summary
  summary and email
Delivery:
  none
  verified email
```

第一版可以简化为：

```txt
URL input
Fallback to audio checkbox
Send to email checkbox
Submit button
```

### Records

路径建议：

```txt
/records
```

展示所有提交记录。

列表字段：

```txt
Title
Platform
Source URL
Status
Created At
Completed At
Transcript Source
Delivery Status
Actions
```

状态筛选：

```txt
All
Queued
Processing
Completed
Failed
Delivered
```

平台筛选：

```txt
All
YouTube
Bilibili
```

搜索范围：

```txt
视频标题
URL
摘要内容
错误原因
```

### Record Detail

路径建议：

```txt
/records/[id]
```

详情页展示一条视频处理记录。

区域：

- 视频基本信息。
- 当前状态和处理时间线。
- 字幕来源。
- 摘要结果。
- Transcript 分段查看。
- 邮件投递记录。
- 错误详情。
- 操作按钮。

操作按钮：

```txt
Retry
Regenerate summary
Send to email
Copy summary
Copy transcript
Open source video
Delete record
```

### Email Settings

路径建议：

```txt
/settings/emails
```

功能：

- 添加邮箱。
- 发送验证邮件。
- 查看验证状态。
- 设置默认收件邮箱。
- 删除邮箱。

邮件投递 tools 应只允许发送到这里验证过的邮箱。

### MCP Token Settings

路径建议：

```txt
/settings/mcp-tokens
```

功能：

- 创建 MCP token。
- 选择 scopes。
- 查看 token 最后使用时间。
- 撤销 token。
- 查看配置示例。

配置示例：

```txt
MCP URL: https://your-domain.com/api/mcp
Authorization: Bearer mcp_xxx
```

### Usage

路径建议：

```txt
/settings/usage
```

展示：

- 本月创建任务数。
- 字幕提取次数。
- 音频转写分钟数。
- 邮件发送次数。
- 失败次数。
- 当前套餐限制。

## 任务状态展示

网页层应把后端 job 状态映射成用户能理解的状态。

```txt
queued -> Waiting
fetching_metadata -> Reading video info
extracting_transcript -> Extracting subtitles
extracting_audio -> Extracting audio
transcribing_audio -> Transcribing audio
summarizing -> Summarizing
delivering -> Sending email
completed -> Completed
failed -> Failed
cancelled -> Cancelled
```

页面上可以展示处理时间线：

```txt
Created
Metadata fetched
Transcript extracted
Audio transcribed
Summary generated
Email delivered
```

对于失败任务，应展示明确原因和下一步操作。

示例：

```txt
No subtitles were found for this video. Audio transcription was disabled.
```

可提供操作：

```txt
Retry with audio transcription
```

## 数据模型建议

### VideoRecord

```ts
type VideoRecord = {
  id: string;
  userId: string;
  sourceUrl: string;
  platform: "youtube" | "bilibili";
  title?: string;
  author?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  status:
    | "queued"
    | "fetching_metadata"
    | "extracting_transcript"
    | "extracting_audio"
    | "transcribing_audio"
    | "summarizing"
    | "delivering"
    | "completed"
    | "failed"
    | "cancelled";
  transcriptSource?: "manual_subtitle" | "auto_subtitle" | "asr";
  summaryId?: string;
  transcriptId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};
```

### Transcript

```ts
type Transcript = {
  id: string;
  recordId: string;
  language?: string;
  source: "manual_subtitle" | "auto_subtitle" | "asr";
  plainTextStorageKey?: string;
  segmentCount: number;
  createdAt: Date;
};
```

### Summary

```ts
type Summary = {
  id: string;
  recordId: string;
  language: string;
  format: "brief" | "detailed" | "email_digest";
  title: string;
  shortSummary: string;
  keyPoints: string[];
  timeline?: {
    time: string;
    topic: string;
    summary: string;
  }[];
  takeaways?: string[];
  markdown: string;
  createdAt: Date;
};
```

### DeliveryRecord

```ts
type DeliveryRecord = {
  id: string;
  recordId: string;
  userId: string;
  type: "email" | "webhook";
  targetId: string;
  status: "queued" | "sent" | "failed";
  errorMessage?: string;
  createdAt: Date;
  sentAt?: Date;
};
```

## Dashboard 交互细节

### URL 提交

输入框行为：

- 粘贴 URL 后自动识别平台。
- 对无效 URL 即时提示。
- 支持 Bilibili `BV` 链接和 YouTube `watch` / `youtu.be` 链接。
- 如果 URL 已提交过，提示用户可查看历史记录，也允许重新创建任务。

重复 URL 策略：

```txt
相同用户 + 相同 URL + 相同处理选项
  -> 默认展示已有记录
  -> 提供 "Run again" 按钮重新执行
```

这样可以避免用户误点重复消耗额度，同时保留重新生成的能力。

### 创建任务后的反馈

提交后立即创建记录并跳转详情页：

```txt
/records/[id]
```

详情页轮询或订阅状态更新：

```txt
GET /api/records/[id]
```

如果后续使用实时能力，可以升级为：

```txt
Server-Sent Events
WebSocket
Realtime provider
```

### 失败恢复

常见失败与操作：

```txt
NO_TRANSCRIPT_AND_AUDIO_DISABLED
  -> Retry with audio transcription

LOGIN_REQUIRED
  -> Mark as unsupported or ask user to try another video

ASR_FAILED
  -> Retry transcription

SUMMARY_FAILED
  -> Regenerate summary

EMAIL_SEND_FAILED
  -> Resend email
```

## 摘要展示设计

摘要详情建议包含：

```txt
Short Summary
Key Points
Timeline
Action Items / Takeaways
Source Info
```

可以支持多种视图：

```txt
Summary
Transcript
Email Preview
Raw Metadata
```

第一版推荐只做：

```txt
Summary
Transcript
Delivery
```

## 邮件投递体验

用户可在创建任务时选择是否发送邮件：

```txt
Send summary to my default email
```

如果用户没有验证邮箱：

```txt
提示去验证邮箱
任务仍然可以创建，但不发送邮件
```

详情页可手动发送：

```txt
Send to email
```

发送前使用 email preview 展示内容，避免误发。

## 推荐的额外功能

### Favorites

用户可以收藏重要记录。

用途：

- 快速找回高价值视频摘要。
- 后续做知识库时可以优先同步收藏内容。

### Tags

用户给记录打标签。

示例：

```txt
AI
投资
编程
课程
产品
```

### Notes

用户可以在摘要下方写自己的笔记。

这会让产品从“摘要工具”更接近“视频知识管理工具”。

### Collections

把多条视频记录放入一个合集。

适合：

- 一个课程系列。
- 一个 UP 主/频道专题。
- 一个研究主题。

### Scheduled Digest

后续可以支持订阅频道或关键词，定时生成摘要。

```txt
每周总结某个频道的新视频
每天总结指定播放列表的新内容
```

### Export

支持导出：

```txt
Markdown
PDF
Notion
Obsidian
```

第一版可以先做 Markdown copy。

### Webhook Delivery

除了 email，还可以把摘要发送到外部系统。

```txt
Discord
Slack
Feishu
Notion
Custom webhook
```

## 权限和记录归属

所有 record 必须绑定用户。

```txt
record.userId = actor.userId
```

来源可以区分：

```txt
createdByType: "web" | "mcp_agent" | "system"
createdById: string
```

这样网页记录可以展示：

```txt
Created from website
Created by MCP token: Cursor Agent
Created by scheduled job
```

## MVP 范围

第一版建议实现：

- 用户登录。
- Dashboard URL 输入。
- 创建视频摘要任务。
- Records 列表。
- Record 详情页。
- 状态展示。
- 摘要展示。
- Transcript 展示。
- 邮箱验证。
- 发送摘要到默认邮箱。
- MCP token 创建和撤销。

暂缓：

- 标签。
- 收藏。
- 笔记。
- 合集。
- 定时订阅。
- Notion/Slack/Feishu 投递。
- 复杂实时更新。

## 与 MCP 层的关系

网页层不直接绑定底层 provider。

推荐调用：

```txt
Server Action
  -> LangChain MCP Client
  -> /api/mcp
  -> create_video_digest_job
```

记录列表和详情页可以直接查数据库，也可以通过内部 API 读取。

推荐：

```txt
页面读模型:
  直接查询 record/summary/delivery 数据

写操作:
  通过 MCP tools 创建任务、重试、发送邮件
```

这样可以兼顾：

- 写操作统一走 MCP 能力层。
- 页面读取保持简单和高性能。

对于视频处理这类长任务，写操作只创建任务并入队，不在页面请求中等待处理完成。

```txt
Server Action
  -> LangChain MCP Client
  -> create_video_digest_job
  -> Postgres 创建 record
  -> Redis/BullMQ 入队
  -> 返回 recordId/jobId

Worker
  -> 消费队列
  -> 更新 record 状态和结果
```

部署和 worker 运行方式见 `video-digest-deployment.md`。

## 页面路由建议

```txt
/dashboard
/records
/records/[id]
/settings/emails
/settings/mcp-tokens
/settings/usage
```

后续扩展：

```txt
/favorites
/collections
/collections/[id]
/settings/webhooks
/settings/billing
```

## 最终结论

Next.js 网页层应该围绕“提交 URL”和“管理记录”展开。

最小闭环：

```txt
用户粘贴 URL
  -> 创建任务
  -> 查看记录
  -> 查看摘要
  -> 发送邮箱
```

推荐把所有写操作统一收敛到 MCP tools，把记录读取和展示留给网页层直接处理。这样产品体验清晰，后端能力也能自然开放给外部 agent。
