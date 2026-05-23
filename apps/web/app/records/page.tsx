import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  type VideoRecordRow,
  type VideoRecordStatus,
  type VideoPlatform,
  videoPlatforms,
  videoRecordStatuses,
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

type RecordsSearchParams = {
  page?: string;
  platform?: string;
  q?: string;
  status?: string;
};

const recordsPageSize = 20;

const statusFilters: Array<{
  label: string;
  value: VideoRecordStatus | "active" | null;
}> = [
  { label: "全部", value: null },
  { label: "排队中", value: "queued" },
  { label: "处理中", value: "active" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
  { label: "投递中", value: "delivering" },
];
const platformFilters: Array<{
  label: string;
  value: VideoPlatform | null;
}> = [
  { label: "全部", value: null },
  { label: "YouTube", value: "youtube" },
  { label: "Bilibili", value: "bilibili" },
];
const activeStatuses: VideoRecordStatus[] = [
  "fetching_metadata",
  "extracting_transcript",
  "extracting_audio",
  "transcribing_audio",
  "summarizing",
  "delivering",
];

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<RecordsSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedStatus = parseStatusFilter(resolvedSearchParams.status);
  const selectedPlatform = parsePlatformFilter(resolvedSearchParams.platform);
  const query = normalizeSearchQuery(resolvedSearchParams.q);
  const selectedPage = parsePageNumber(resolvedSearchParams.page);
  const user = await requireUser();
  const supabase = await createClient();
  const repository = createSupabaseVideoRecordsRepository(supabase);
  let records: VideoRecordRow[] = [];
  let totalRecords = 0;
  let databaseErrorMessage: string | null = null;

  try {
    const result = await repository.listPageForUser({
      limit: recordsPageSize,
      offset: (selectedPage - 1) * recordsPageSize,
      platform: selectedPlatform ?? undefined,
      query: query ?? undefined,
      status:
        selectedStatus && selectedStatus !== "active"
          ? selectedStatus
          : undefined,
      statuses: selectedStatus === "active" ? activeStatuses : undefined,
      userId: user.id,
    });

    records = result.records;
    totalRecords = result.total;

    const totalPages = getTotalPages(totalRecords);

    if (totalRecords > 0 && selectedPage > totalPages) {
      redirect(
        buildRecordsHref(resolvedSearchParams, {
          page: totalPages,
        }),
      );
    }
  } catch (caught) {
    if (!isMissingDatabaseSchemaError(caught)) {
      throw caught;
    }

    databaseErrorMessage =
      "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。";
  }

  const totalPages = getTotalPages(totalRecords);
  const pageStart =
    totalRecords === 0 ? 0 : (selectedPage - 1) * recordsPageSize + 1;
  const pageEnd = Math.min(totalRecords, pageStart + records.length - 1);
  const hasPreviousPage = selectedPage > 1;
  const hasNextPage = selectedPage < totalPages;
  const paginationPages = getPaginationPages(selectedPage, totalPages);

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
        <PanelHeader title="筛选" description="按状态、平台和关键词查找任务。" />
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <form action="/records" className="grid gap-2">
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
                name="q"
                type="search"
                defaultValue={query ?? ""}
                placeholder="搜索标题、作者、链接或失败原因"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {selectedStatus ? (
              <input name="status" type="hidden" value={selectedStatus} />
            ) : null}
            {selectedPlatform ? (
              <input name="platform" type="hidden" value={selectedPlatform} />
            ) : null}
          </form>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">状态</p>
            <div className="flex flex-wrap gap-1">
              {statusFilters.map((status) => (
                <Link
                  key={status.label}
                  href={buildRecordsHref(resolvedSearchParams, {
                    page: null,
                    status: status.value,
                  })}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selectedStatus === status.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {status.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">平台</p>
            <div className="flex flex-wrap gap-1">
              {platformFilters.map((platform) => (
                <Link
                  key={platform.label}
                  href={buildRecordsHref(resolvedSearchParams, {
                    page: null,
                    platform: platform.value,
                  })}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selectedPlatform === platform.value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {platform.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="全部记录"
          description={
            databaseErrorMessage ??
            `${pageStart}-${pageEnd} / ${totalRecords} 条真实记录`
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
        {databaseErrorMessage || totalPages <= 1 ? null : (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              第 {selectedPage} / {totalPages} 页
            </p>
            <nav
              aria-label="记录分页"
              className="flex flex-wrap items-center gap-2"
            >
              {hasPreviousPage ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildRecordsHref(resolvedSearchParams, {
                      page: selectedPage - 1,
                    })}
                  >
                    上一页
                  </Link>
                </Button>
              ) : (
                <Button disabled variant="outline" size="sm">
                  上一页
                </Button>
              )}
              {paginationPages.map((page) => (
                <Link
                  key={page}
                  href={buildRecordsHref(resolvedSearchParams, { page })}
                  aria-current={page === selectedPage ? "page" : undefined}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    page === selectedPage
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {page}
                </Link>
              ))}
              {hasNextPage ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildRecordsHref(resolvedSearchParams, {
                      page: selectedPage + 1,
                    })}
                  >
                    下一页
                  </Link>
                </Button>
              ) : (
                <Button disabled variant="outline" size="sm">
                  下一页
                </Button>
              )}
            </nav>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function parseStatusFilter(value: string | undefined) {
  if (value === "active") {
    return value;
  }

  return videoRecordStatuses.find((status) => status === value) ?? null;
}

function parsePlatformFilter(value: string | undefined) {
  return videoPlatforms.find((platform) => platform === value) ?? null;
}

function normalizeSearchQuery(value: string | undefined) {
  const query = value?.trim() ?? "";
  return query.length > 0 ? query : null;
}

function parsePageNumber(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildRecordsHref(
  currentParams: RecordsSearchParams,
  nextParams: {
    page?: number | null;
    platform?: VideoPlatform | null;
    status?: VideoRecordStatus | "active" | null;
  },
) {
  const params = new URLSearchParams();
  const query = normalizeSearchQuery(currentParams.q);
  const page =
    nextParams.page === undefined
      ? parsePageNumber(currentParams.page)
      : nextParams.page;
  const status =
    nextParams.status === undefined
      ? parseStatusFilter(currentParams.status)
      : nextParams.status;
  const platform =
    nextParams.platform === undefined
      ? parsePlatformFilter(currentParams.platform)
      : nextParams.platform;

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (platform) {
    params.set("platform", platform);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/records?${queryString}` : "/records";
}

function getTotalPages(totalRecords: number) {
  return Math.max(1, Math.ceil(totalRecords / recordsPageSize));
}

function getPaginationPages(currentPage: number, totalPages: number) {
  const firstPage = Math.max(1, currentPage - 2);
  const lastPage = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = firstPage; page <= lastPage; page += 1) {
    pages.push(page);
  }

  return pages;
}
