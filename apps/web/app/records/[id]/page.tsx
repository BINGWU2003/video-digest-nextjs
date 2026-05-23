import {
  createSupabaseSummariesRepository,
  createSupabaseTranscriptsRepository,
  createSupabaseVideoRecordsRepository,
  type SummaryRow,
  type TranscriptSegmentRow,
  type VideoRecordStatus,
} from "@repo/database";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  displayRecordTitle,
  formatCreatedBy,
  formatDateTime,
  formatDuration,
  formatTranscriptSource,
  platformLabels,
  statusLabels,
  statusTone,
} from "@/lib/video-records/view-model";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { MailIcon, RefreshIcon } from "../../_components/icons";
import { retryVideoDigestJobAction } from "./actions";
import { RecordAutoRefresh } from "./auto-refresh";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

const timelineSteps: Array<{
  label: string;
  statuses: VideoRecordStatus[];
}> = [
  { label: "创建任务", statuses: ["queued"] },
  { label: "读取视频信息", statuses: ["fetching_metadata"] },
  { label: "提取字幕", statuses: ["extracting_transcript"] },
  {
    label: "音频转写",
    statuses: ["extracting_audio", "transcribing_audio"],
  },
  { label: "生成摘要", statuses: ["summarizing"] },
  { label: "邮件投递", statuses: ["delivering"] },
  { label: "完成", statuses: ["completed"] },
];

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
  const summariesRepository = createSupabaseSummariesRepository(supabase);
  const transcriptsRepository = createSupabaseTranscriptsRepository(supabase);

  const record = await videoRecordsRepository.findByIdForUser({
    id,
    userId: user.id,
  });

  if (!record) {
    notFound();
  }

  const transcript = await transcriptsRepository.findLatestForRecord({
    recordId: record.id,
    segmentLimit: 200,
    userId: user.id,
  });
  const summary = await summariesRepository.findLatestForRecord({
    recordId: record.id,
    userId: user.id,
  });

  const title = displayRecordTitle(record);
  const activeStep = resolveActiveStep(record.status);
  const retryable = isRetryableStatus(record.status);
  const failureHint = getFailureHint(record.errorCode);

  return (
    <AppShell current="/records" userEmail={user.email}>
      <RecordAutoRefresh status={record.status} />
      <PageHeader
        eyebrow="记录详情"
        title={title}
        description={`${platformLabels[record.platform]} 视频。${formatCreatedBy(record)}。`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={record.sourceUrl}>打开源视频</Link>
            </Button>
            <form action={retryVideoDigestJobAction}>
              <input name="id" type="hidden" value={record.id} />
              <Button
                disabled={!retryable}
                type="submit"
                variant="outline"
              >
                <RefreshIcon />
                重试
              </Button>
            </form>
            <Button disabled>
              <MailIcon />
              发送邮件
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Panel>
            <PanelHeader
              title="处理状态"
              action={
                <StatusBadge tone={statusTone(record.status)}>
                  {statusLabels[record.status]}
                </StatusBadge>
              }
            />
            <div className="grid gap-4 p-5">
              {record.errorCode || record.errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {record.errorCode ?? "处理失败"}
                  </p>
                  {record.errorMessage ? (
                    <p className="mt-2 text-sm leading-6 text-red-700">
                      {record.errorMessage}
                    </p>
                  ) : null}
                  {failureHint ? (
                    <p className="mt-3 rounded-md border border-red-200 bg-white/70 px-3 py-2 text-sm leading-6 text-red-700">
                      {failureHint}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  当前任务已进入 {statusLabels[record.status]} 阶段。
                </p>
              )}

              {record.status === "summarizing" ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  字幕已写入，正在生成摘要。
                </div>
              ) : null}
            </div>
          </Panel>

          {record.outputMode !== "transcript" || summary ? (
            <Panel>
              <PanelHeader
                title="摘要"
                description={
                  summary
                    ? `${summary.model ?? "未知模型"} · ${formatDateTime(summary.createdAt)}`
                    : "等待生成"
                }
                action={
                  summary ? (
                    <CopyButton
                      label="复制摘要"
                      text={summary.markdown ?? summary.shortSummary}
                    />
                  ) : null
                }
              />
              {summary ? (
                <div className="grid gap-5 p-5">
                  {summary.shortSummary ? (
                    <p className="text-sm leading-6 text-slate-700">
                      {summary.shortSummary}
                    </p>
                  ) : null}

                  <SummaryList title="关键要点" values={summary.keyPoints} />
                  <SummaryTimeline summary={summary} />
                  <SummaryList title="结论" values={summary.takeaways} />
                  {summary.markdown ? (
                    <section className="grid gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        完整摘要
                      </h3>
                      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {summary.markdown}
                      </pre>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="p-5 text-sm text-slate-600">
                  worker 生成摘要后会显示在这里。
                </div>
              )}
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              title="字幕"
              description={formatTranscriptSource(
                transcript?.transcript.source ?? record.transcriptSource,
              )}
            />
            {transcript?.segments.length ? (
              <div className="divide-y divide-slate-200">
                {transcript.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[80px_1fr]"
                  >
                    <p className="font-mono text-xs text-slate-500">
                      {formatSegmentTime(segment)}
                    </p>
                    <p className="text-sm leading-6 text-slate-700">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-600">
                暂无可展示字幕。worker 写入字幕后会显示在这里。
              </div>
            )}
            <div className="border-t border-slate-200 p-5">
              <CopyButton
                disabled={!transcript?.transcript.plainText}
                label="复制字幕"
                text={transcript?.transcript.plainText}
              />
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="视频信息" />
            <dl className="grid gap-3 p-5 text-sm">
              {[
                ["记录 ID", record.id],
                ["平台", platformLabels[record.platform]],
                ["作者", record.author ?? "待读取"],
                ["时长", formatDuration(record.durationSeconds)],
                ["创建时间", formatDateTime(record.createdAt)],
                ["完成时间", formatDateTime(record.completedAt)],
                ["输出模式", formatOutputMode(record.outputMode)],
                ["投递", record.sendEmail ? "待投递" : "不投递"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="处理时间线" />
            <ol className="grid gap-3 p-5">
              {timelineSteps.map((step, index) => {
                const completed =
                  record.status === "completed" || index < activeStep;
                const active =
                  record.status !== "completed" &&
                  record.status !== "failed" &&
                  index === activeStep;
                const failed =
                  record.status === "failed" && index === activeStep;

                return (
                  <li key={step.label} className="flex gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                        completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : failed
                            ? "border-red-600 bg-red-600 text-white"
                            : active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {step.label}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {completed ? "已完成" : failed ? "失败" : "待处理"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryList({
  title,
  values,
}: {
  title: string;
  values: unknown[];
}) {
  const items = values.filter((value): value is string => typeof value === "string");

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="grid gap-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryTimeline({ summary }: { summary: SummaryRow }) {
  const items = summary.timeline.filter(isSummaryTimelineItem);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-slate-900">时间线</h3>
      <div className="divide-y divide-slate-200 text-sm">
        {items.map((item) => (
          <div
            key={`${item.time ?? "--"}-${item.title}`}
            className="grid gap-2 py-3 sm:grid-cols-[72px_1fr]"
          >
            <span className="font-mono text-xs text-slate-500">
              {item.time ?? "--:--"}
            </span>
            <span>
              <span className="block font-medium text-slate-900">
                {item.title}
              </span>
              <span className="mt-1 block leading-6 text-slate-700">
                {item.summary}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function isSummaryTimelineItem(value: unknown): value is {
  summary: string;
  time: string | null;
  title: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.summary === "string" &&
    typeof item.title === "string" &&
    (typeof item.time === "string" || item.time === null || item.time === undefined)
  );
}

function resolveActiveStep(status: VideoRecordStatus) {
  if (status === "failed") {
    return 2;
  }

  const index = timelineSteps.findIndex((step) =>
    step.statuses.includes(status),
  );

  return index === -1 ? 0 : index;
}

function isRetryableStatus(status: VideoRecordStatus) {
  return status === "failed" || status === "cancelled";
}

function getFailureHint(errorCode: string | null) {
  const hints: Record<string, string> = {
    metadata_fetch_failed:
      "建议检查视频链接是否可访问，以及本地或部署环境的网络代理配置。",
    provider_unavailable:
      "当前平台 provider 不可用。建议检查平台识别结果、依赖配置和 worker 环境。",
    retry_enqueue_failed:
      "记录已尝试恢复，但重新入队失败。建议检查 Redis/队列连接后再次重试。",
    summary_generation_failed:
      "建议检查 OPENAI_BASE_URL、OPENAI_API_KEY、OPENAI_SUMMARY_MODEL 等摘要模型配置。",
    transcript_fetch_failed:
      "建议检查 yt-dlp 是否可执行，以及本地开发代理或部署环境网络是否能访问视频平台。",
    transcript_not_found:
      "当前视频没有可读取字幕。可以换一个有公开字幕的视频，或后续开启音频转写后再重试。",
    worker_processing_failed:
      "worker 处理链路出现未分类错误。建议查看 worker 控制台日志定位具体阶段。",
  };

  return errorCode ? hints[errorCode] : null;
}

function formatOutputMode(mode: string) {
  const labels: Record<string, string> = {
    summary: "生成摘要",
    summary_and_email: "摘要并邮件投递",
    transcript: "只提取字幕",
  };

  return labels[mode] ?? mode;
}

function formatSegmentTime(segment: TranscriptSegmentRow) {
  if (segment.startSeconds === null) {
    return "--:--";
  }

  const minutes = Math.floor(segment.startSeconds / 60);
  const seconds = Math.floor(segment.startSeconds % 60);

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
