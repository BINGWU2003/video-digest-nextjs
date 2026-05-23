import Link from "next/link";
import type { VideoRecordRow } from "@repo/database";

import { Button } from "@/components/ui/button";
import {
  displayRecordTitle,
  formatDateTime,
  statusLabels,
  statusTone,
} from "@/lib/video-records/view-model";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "./app-shell";
import { ArrowRightIcon, MailIcon, VideoIcon } from "./icons";

import { createVideoDigestJobAction } from "../dashboard/actions";

export function DashboardPage({
  errorMessage,
  records,
  userEmail,
}: {
  errorMessage?: string;
  records: VideoRecordRow[];
  userEmail?: string;
}) {
  const completedCount = records.filter(
    (record) => record.status === "completed",
  ).length;
  const activeCount = records.filter(
    (record) => record.status !== "completed" && record.status !== "failed",
  ).length;

  return (
    <AppShell current="/dashboard" userEmail={userEmail}>
      <PageHeader
        eyebrow="工作台"
        title="创建并追踪视频摘要"
        description="提交 YouTube 或 Bilibili 链接，选择处理方式，并把网站和 MCP 创建的任务统一沉淀到可搜索的历史记录中。"
        actions={
          <Button asChild>
            <Link href="/records">
              查看记录
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Panel>
          <PanelHeader
            title="新建视频任务"
            description="提交后会创建真实记录并投递到 worker 队列。"
          />
          <form action={createVideoDigestJobAction} className="grid gap-5 p-5">
            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            <div className="grid gap-2">
              <label
                htmlFor="video-url"
                className="text-sm font-medium text-slate-800"
              >
                视频链接
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="video-url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=... 或 https://www.bilibili.com/video/BV..."
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <Button type="submit" className="sm:w-36">
                  <VideoIcon />
                  创建任务
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                平台会自动识别。重复链接会提示历史记录，也允许重新执行。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium text-slate-900">
                  平台
                </legend>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  {[
                    ["auto", "自动识别"],
                    ["youtube", "YouTube"],
                    ["bilibili", "Bilibili"],
                  ].map(([value, label], index) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="platform"
                        value={value}
                        defaultChecked={index === 0}
                        className="size-4 accent-blue-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium text-slate-900">
                  处理方式
                </legend>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  {[
                    ["transcript", "只提取字幕"],
                    ["summary", "提取字幕后生成摘要"],
                    ["summary_and_email", "生成摘要并邮件投递"],
                  ].map(([value, label], index) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="outputMode"
                        value={value}
                        defaultChecked={index === 0}
                        className="size-4 accent-blue-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium text-slate-900">
                  投递
                </legend>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      name="fallbackToAudio"
                      type="checkbox"
                      className="size-4 rounded accent-blue-600"
                    />
                    无字幕时转写音频
                  </label>
                  <p className="text-xs text-slate-500">
                    ASR 模块未接入前，该选项只会进入失败恢复链路。
                  </p>
                </div>
              </fieldset>
            </div>
          </form>
        </Panel>

        <div className="grid gap-5">
          <Panel>
            <PanelHeader title="本月概览" />
            <div className="grid grid-cols-2 gap-3 p-5">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">已完成</p>
                <p className="mt-2 text-3xl font-semibold">{completedCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">处理中</p>
                <p className="mt-2 text-3xl font-semibold">{activeCount}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">音频转写</p>
                <p className="mt-2 text-2xl font-semibold">
                  待接入
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-0 rounded-full bg-blue-600" />
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="邮箱状态"
              action={<StatusBadge tone="green">已验证</StatusBadge>}
            />
            <div className="flex items-start gap-3 p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                <MailIcon />
              </span>
              <div>
                <p className="font-medium text-slate-950">
                  {userEmail ?? "未读取到邮箱"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  邮件投递模块接入后会使用已验证邮箱。
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-5">
        <PanelHeader
          title="最近任务"
          description="汇总来自网站、MCP Token 和定时任务的最新处理记录。"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/records">查看全部</Link>
            </Button>
          }
        />
        <div className="divide-y divide-slate-200">
          {records.slice(0, 4).map((record) => (
            <Link
              key={record.id}
              href={`/records/${record.id}`}
              className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:grid-cols-[minmax(0,1fr)_180px_150px]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-950">
                  {displayRecordTitle(record)}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {record.sourceUrl}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                {formatDateTime(record.createdAt)}
              </p>
              <StatusBadge tone={statusTone(record.status)}>
                {statusLabels[record.status]}
              </StatusBadge>
            </Link>
          ))}
          {records.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              暂无任务，先提交一个视频链接。
            </div>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
