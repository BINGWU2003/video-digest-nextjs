import Link from "next/link";
import {
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  type VideoRecordRow,
} from "@repo/database";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  displayRecordTitle,
  formatCreatedBy,
  formatDateTime,
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
} from "../_components/app-shell";
import { ArrowRightIcon, SearchIcon } from "../_components/icons";

export const dynamic = "force-dynamic";

const statuses = ["全部", "排队中", "处理中", "已完成", "失败", "已投递"];
const platforms = ["全部", "YouTube", "Bilibili"];

export default async function RecordsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const repository = createSupabaseVideoRecordsRepository(supabase);
  let records: VideoRecordRow[] = [];
  let databaseErrorMessage: string | null = null;

  try {
    records = await repository.listForUser({
      limit: 100,
      userId: user.id,
    });
  } catch (caught) {
    if (!isMissingDatabaseSchemaError(caught)) {
      throw caught;
    }

    databaseErrorMessage =
      "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。";
  }

  return (
    <AppShell current="/records" userEmail={user.email}>
      <PageHeader
        eyebrow="记录"
        title="搜索所有提交过的视频"
        description="网站任务、MCP 创建的任务和定时摘要会统一展示，并包含状态、字幕来源、投递状态和源链接。"
        actions={
          <Button asChild>
            <Link href="/dashboard">
              新建任务
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <Panel>
        <PanelHeader title="筛选" description="筛选交互后续接入查询参数。" />
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <div className="grid gap-2">
            <label
              htmlFor="record-search"
              className="text-sm font-medium text-slate-800"
            >
              搜索
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="record-search"
                type="search"
                placeholder="搜索标题、链接、摘要内容或失败原因"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">状态</p>
            <div className="flex flex-wrap gap-1">
              {statuses.map((status, index) => (
                <button
                  key={status}
                  type="button"
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    index === 0
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">平台</p>
            <div className="flex flex-wrap gap-1">
              {platforms.map((platform, index) => (
                <button
                  key={platform}
                  type="button"
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    index === 0
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="全部记录"
          description={
            databaseErrorMessage ?? `${records.length} 条真实记录`
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.04em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">标题</th>
                <th className="px-5 py-3 font-semibold">平台</th>
                <th className="px-5 py-3 font-semibold">状态</th>
                <th className="px-5 py-3 font-semibold">创建时间</th>
                <th className="px-5 py-3 font-semibold">完成时间</th>
                <th className="px-5 py-3 font-semibold">字幕来源</th>
                <th className="px-5 py-3 font-semibold">投递</th>
                <th className="px-5 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {records.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="max-w-[320px] px-5 py-4">
                    <Link
                      href={`/records/${record.id}`}
                      className="font-medium text-slate-950 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {displayRecordTitle(record)}
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {record.sourceUrl}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCreatedBy(record)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {platformLabels[record.platform]}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={statusTone(record.status)}>
                      {statusLabels[record.status]}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDateTime(record.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDateTime(record.completedAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatTranscriptSource(record.transcriptSource)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {record.sendEmail ? "待投递" : "不投递"}
                  </td>
                  <td className="px-5 py-4">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/records/${record.id}`}>打开</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    暂无记录，先从工作台创建一个任务。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
