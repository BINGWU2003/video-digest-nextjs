import {
  createSupabaseDeliveryRecordsRepository,
  createSupabaseEmailAddressesRepository,
  type DeliveryRecordListItem,
  type DeliveryRecordRow,
  type EmailAddressRow,
} from "@repo/database";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/video-records/view-model";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { MailIcon, TrashIcon } from "../../_components/icons";
import {
  deleteEmailAddressAction,
  requestEmailVerificationAction,
  setDefaultEmailAddressAction,
  useLoginEmailAsDefaultAction,
} from "./actions";

export const dynamic = "force-dynamic";

const deliveryRecordsPageSize = 10;

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ deliveryPage?: string; message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedDeliveryPage = parsePageNumber(
    resolvedSearchParams?.deliveryPage,
  );
  const user = await requireUser();
  const supabase = await createClient();
  const emailAddressesRepository =
    createSupabaseEmailAddressesRepository(supabase);
  const deliveryRecordsRepository =
    createSupabaseDeliveryRecordsRepository(supabase);
  const emailAddresses = await emailAddressesRepository.listForUser({
    userId: user.id,
  });
  const deliveryRecordsPage = await deliveryRecordsRepository.listPageForUser({
    limit: deliveryRecordsPageSize,
    offset: (selectedDeliveryPage - 1) * deliveryRecordsPageSize,
    userId: user.id,
  });
  const totalDeliveryPages = getTotalPages(deliveryRecordsPage.total);

  if (
    deliveryRecordsPage.total > 0 &&
    selectedDeliveryPage > totalDeliveryPages
  ) {
    redirect(buildEmailSettingsHref({ deliveryPage: totalDeliveryPages }));
  }

  const deliveryPageStart =
    deliveryRecordsPage.total === 0
      ? 0
      : (selectedDeliveryPage - 1) * deliveryRecordsPageSize + 1;
  const deliveryPageEnd = Math.min(
    deliveryRecordsPage.total,
    deliveryPageStart + deliveryRecordsPage.records.length - 1,
  );
  const hasPreviousDeliveryPage = selectedDeliveryPage > 1;
  const hasNextDeliveryPage = selectedDeliveryPage < totalDeliveryPages;
  const deliveryPaginationPages = getPaginationPages(
    selectedDeliveryPage,
    totalDeliveryPages,
  );

  return (
    <AppShell current="/settings/emails" userEmail={user.email}>
      <PageHeader
        eyebrow="邮箱设置"
        title="管理已验证收件人"
        description="摘要投递只允许发送到已验证邮箱。新任务选择邮件投递时，会默认使用默认邮箱。"
        actions={
          <form action={useLoginEmailAsDefaultAction}>
            <Button disabled={!user.email} type="submit">
              <MailIcon />
              使用登录邮箱
            </Button>
          </form>
        }
      />

      {resolvedSearchParams?.message ? (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          {resolvedSearchParams.message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader
            title="收件邮箱"
            description={`${emailAddresses.length} 个邮箱地址`}
          />
          {emailAddresses.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {emailAddresses.map((emailAddress) => (
                <EmailAddressItem
                  key={emailAddress.id}
                  emailAddress={emailAddress}
                />
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm leading-6 text-slate-600">
              当前还没有收件邮箱。可以先把登录邮箱设为默认收件邮箱，用于本地开发和邮件投递测试。
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="添加收件人"
            description="验证通过后才能作为摘要投递邮箱。"
          />
          <div className="grid gap-5 p-5">
            <form action={requestEmailVerificationAction} className="grid gap-3">
              <div className="grid gap-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-800"
                >
                  邮箱地址
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <Button type="submit">
                <MailIcon />
                发送验证邮件
              </Button>
            </form>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                {user.email ?? "当前账号没有邮箱"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                本地开发时也可以直接把登录邮箱设为默认已验证收件邮箱。
              </p>
              <form action={useLoginEmailAsDefaultAction} className="mt-3">
                <Button disabled={!user.email} type="submit" variant="outline">
                  <MailIcon />
                  使用登录邮箱
                </Button>
              </form>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="最近投递"
          description={`${deliveryPageStart}-${deliveryPageEnd} / ${deliveryRecordsPage.total} 条投递记录`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.04em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">视频</th>
                <th className="px-5 py-3 font-semibold">收件邮箱</th>
                <th className="px-5 py-3 font-semibold">主题</th>
                <th className="px-5 py-3 font-semibold">状态</th>
                <th className="px-5 py-3 font-semibold">最近事件</th>
                <th className="px-5 py-3 font-semibold">原因</th>
                <th className="px-5 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {deliveryRecordsPage.records.map((item) => (
                <DeliveryRecordItem
                  key={item.deliveryRecord.id}
                  item={item}
                />
              ))}
              {deliveryRecordsPage.records.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    暂无投递记录。选择“摘要并邮件投递”完成任务后会显示在这里。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            第 {selectedDeliveryPage} / {totalDeliveryPages} 页
          </p>
          <nav
            aria-label="投递记录分页"
            className="flex flex-wrap items-center gap-2"
          >
            {hasPreviousDeliveryPage ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildEmailSettingsHref({
                    deliveryPage: selectedDeliveryPage - 1,
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
            {deliveryPaginationPages.map((page) => (
              <Link
                key={page}
                href={buildEmailSettingsHref({ deliveryPage: page })}
                aria-current={
                  page === selectedDeliveryPage ? "page" : undefined
                }
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  page === selectedDeliveryPage
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {page}
              </Link>
            ))}
            {hasNextDeliveryPage ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildEmailSettingsHref({
                    deliveryPage: selectedDeliveryPage + 1,
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
      </Panel>
    </AppShell>
  );
}

function DeliveryRecordItem({ item }: { item: DeliveryRecordListItem }) {
  const deliveryRecord = item.deliveryRecord;

  return (
    <tr className="align-top">
      <td className="max-w-[280px] px-5 py-4">
        {item.videoRecord ? (
          <>
            <Link
              href={`/records/${item.videoRecord.id}`}
              className="font-medium text-slate-950 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {item.videoRecord.title ?? "等待读取视频标题"}
            </Link>
            <p className="mt-1 truncate text-xs text-slate-500">
              {item.videoRecord.sourceUrl}
            </p>
          </>
        ) : (
          <span className="text-slate-500">记录已删除</span>
        )}
      </td>
      <td className="px-5 py-4 text-slate-700">
        {item.targetEmail ?? "目标邮箱已删除"}
      </td>
      <td className="max-w-[240px] px-5 py-4 text-slate-700">
        <span className="line-clamp-2">
          {deliveryRecord.subject ?? "未记录"}
        </span>
      </td>
      <td className="px-5 py-4">
        <StatusBadge tone={getDeliveryStatusTone(deliveryRecord.status)}>
          {formatDeliveryStatus(deliveryRecord.status)}
        </StatusBadge>
      </td>
      <td className="px-5 py-4 text-slate-600">
        <p>{deliveryRecord.providerEventType ?? "等待 webhook"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatOptionalDate(deliveryRecord.providerEventAt)}
        </p>
      </td>
      <td className="max-w-[260px] px-5 py-4 text-slate-600">
        <span className="line-clamp-3">
          {deliveryRecord.errorMessage ?? "暂无"}
        </span>
      </td>
      <td className="px-5 py-4">
        {item.videoRecord ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/records/${item.videoRecord.id}`}>打开</Link>
          </Button>
        ) : (
          <Button disabled variant="outline" size="sm">
            打开
          </Button>
        )}
      </td>
    </tr>
  );
}

function EmailAddressItem({
  emailAddress,
}: {
  emailAddress: EmailAddressRow;
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div>
        <p className="font-medium text-slate-950">{emailAddress.email}</p>
        <p className="mt-1 text-sm text-slate-500">
          上次发送：{formatOptionalDate(emailAddress.lastSentAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={getEmailStatusTone(emailAddress.status)}>
          {formatEmailStatus(emailAddress.status)}
        </StatusBadge>
        {emailAddress.isDefault ? (
          <StatusBadge tone="blue">默认</StatusBadge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {emailAddress.status === "verified" && !emailAddress.isDefault ? (
          <form action={setDefaultEmailAddressAction}>
            <input name="id" type="hidden" value={emailAddress.id} />
            <Button variant="outline" size="sm" type="submit">
              设为默认
            </Button>
          </form>
        ) : null}
        {emailAddress.status !== "verified" ? (
          <form action={requestEmailVerificationAction}>
            <input name="email" type="hidden" value={emailAddress.email} />
            <Button variant="outline" size="sm" type="submit">
              <MailIcon />
              重新发送
            </Button>
          </form>
        ) : null}
        <form action={deleteEmailAddressAction}>
          <input name="id" type="hidden" value={emailAddress.id} />
          <Button
            variant="ghost"
            size="icon-sm"
            type="submit"
            aria-label={`删除 ${emailAddress.email}`}
          >
            <TrashIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}

function formatOptionalDate(value: Date | null) {
  return value ? formatDateTime(value) : "暂无";
}

function formatEmailStatus(status: EmailAddressRow["status"]) {
  const labels: Record<EmailAddressRow["status"], string> = {
    pending: "待验证",
    revoked: "已撤销",
    verified: "已验证",
  };

  return labels[status];
}

function getEmailStatusTone(status: EmailAddressRow["status"]) {
  const tones: Record<
    EmailAddressRow["status"],
    "amber" | "green" | "slate"
  > = {
    pending: "amber",
    revoked: "slate",
    verified: "green",
  };

  return tones[status];
}

function formatDeliveryStatus(status: DeliveryRecordRow["status"]) {
  const labels: Record<DeliveryRecordRow["status"], string> = {
    bounced: "退信",
    cancelled: "已取消",
    complained: "投诉",
    delivered: "已送达",
    delivery_delayed: "投递延迟",
    failed: "投递失败",
    queued: "排队中",
    sent: "已提交服务商",
  };

  return labels[status];
}

function getDeliveryStatusTone(
  status: DeliveryRecordRow["status"],
): "blue" | "green" | "red" | "amber" | "slate" {
  if (status === "delivered") return "green";
  if (status === "bounced" || status === "complained" || status === "failed") {
    return "red";
  }
  if (status === "queued" || status === "delivery_delayed") return "amber";
  if (status === "cancelled") return "slate";
  return "blue";
}

function parsePageNumber(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildEmailSettingsHref(nextParams: { deliveryPage?: number | null }) {
  const params = new URLSearchParams();

  if (nextParams.deliveryPage && nextParams.deliveryPage > 1) {
    params.set("deliveryPage", String(nextParams.deliveryPage));
  }

  const queryString = params.toString();

  return queryString ? `/settings/emails?${queryString}` : "/settings/emails";
}

function getTotalPages(totalRecords: number) {
  return Math.max(1, Math.ceil(totalRecords / deliveryRecordsPageSize));
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
