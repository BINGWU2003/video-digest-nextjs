import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import {
  CopyIcon,
  MailIcon,
  RefreshIcon,
  TrashIcon,
} from "../../_components/icons";
import { records, statusLabels } from "../../_data/mock-data";

export const dynamic = "force-dynamic";

function statusTone(
  status: string,
): "blue" | "green" | "red" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  return "blue";
}

const timelineSteps = [
  "创建任务",
  "读取视频信息",
  "提取字幕",
  "音频转写",
  "生成摘要",
  "邮件投递",
];

export function generateStaticParams() {
  return records.map((record) => ({ id: record.id }));
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const record = records.find((item) => item.id === id);

  if (!record) {
    notFound();
  }

  const activeStep =
    record.status === "failed"
      ? 2
      : record.status === "completed"
        ? timelineSteps.length
        : record.status === "summarizing"
          ? 4
          : 3;

  return (
    <AppShell current="/records" userEmail={user.email}>
      <PageHeader
        eyebrow="记录详情"
        title={record.title}
        description={`${record.author} 发布的 ${record.platform} 视频。${record.createdBy}。`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={record.sourceUrl}>打开源视频</Link>
            </Button>
            <Button variant="outline">
              <RefreshIcon />
              重试
            </Button>
            <Button>
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
              title="摘要"
              action={
                <StatusBadge tone={statusTone(record.status)}>
                  {statusLabels[record.status]}
                </StatusBadge>
              }
            />
            <div className="grid gap-5 p-5">
              <p className="leading-7 text-slate-700">{record.summary.short}</p>

              {record.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {record.error.code}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-red-700">
                    {record.error.message}
                  </p>
                  <Button className="mt-4" variant="outline">
                    <RefreshIcon />
                    {record.error.action}
                  </Button>
                </div>
              ) : null}

              {record.summary.keyPoints.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    关键要点
                  </h2>
                  <ul className="mt-3 grid gap-2">
                    {record.summary.keyPoints.map((point) => (
                      <li
                        key={point}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {record.summary.timeline.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    时间线
                  </h2>
                  <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {record.summary.timeline.map((item) => (
                      <div
                        key={`${item.time}-${item.topic}`}
                        className="grid gap-2 p-4 sm:grid-cols-[80px_180px_1fr]"
                      >
                        <p className="font-mono text-xs text-slate-500">
                          {item.time}
                        </p>
                        <p className="text-sm font-medium text-slate-950">
                          {item.topic}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">
                          {item.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {record.summary.takeaways.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    结论与行动建议
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.summary.takeaways.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <CopyIcon />
                  复制摘要
                </Button>
                <Button variant="outline">
                  <RefreshIcon />
                  重新生成摘要
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="字幕" description={record.transcriptSource} />
            {record.transcript.length ? (
              <div className="divide-y divide-slate-200">
                {record.transcript.map((segment) => (
                  <div
                    key={`${segment.time}-${segment.text}`}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[80px_1fr]"
                  >
                    <p className="font-mono text-xs text-slate-500">
                      {segment.time}
                    </p>
                    <p className="text-sm leading-6 text-slate-700">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-600">
                这个失败任务暂无可用字幕片段。
              </div>
            )}
            <div className="border-t border-slate-200 p-5">
              <Button variant="outline">
                <CopyIcon />
                复制字幕
              </Button>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="视频信息" />
            <dl className="grid gap-3 p-5 text-sm">
              {[
                ["记录 ID", record.id],
                ["作者", record.author],
                ["时长", record.duration],
                ["创建时间", record.createdAt],
                ["完成时间", record.completedAt ?? "处理中"],
                ["投递状态", record.deliveryStatus],
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
                  index < activeStep && record.status !== "failed";
                const failedPoint =
                  record.status === "failed" && index === activeStep;
                return (
                  <li key={step} className="flex gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                        completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : failedPoint
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {step}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {completed
                          ? "已完成"
                          : failedPoint
                            ? "需要处理"
                            : "待处理"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader title="投递" />
            <div className="grid gap-3 p-5 text-sm text-slate-700">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-950">默认邮箱</p>
                <p className="mt-1 text-slate-600">alex@example.com</p>
                <p className="mt-2 text-xs text-slate-500">
                  状态：{record.deliveryStatus}
                </p>
              </div>
              <Button variant="outline">
                <MailIcon />
                预览邮件
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="危险操作" />
            <div className="p-5">
              <Button variant="destructive">
                <TrashIcon />
                删除记录
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
