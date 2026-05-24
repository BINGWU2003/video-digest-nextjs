import {
  createSupabaseEmailAddressesRepository,
  type EmailAddressRow,
} from "@repo/database";

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
import { MailIcon } from "../../_components/icons";
import {
  setDefaultEmailAddressAction,
  useLoginEmailAsDefaultAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const emailAddressesRepository =
    createSupabaseEmailAddressesRepository(supabase);
  const emailAddresses = await emailAddressesRepository.listForUser({
    userId: user.id,
  });

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
            title="当前 MVP"
            description="先支持登录邮箱一键接入，后续再补完整验证邮件流程。"
          />
          <div className="grid gap-4 p-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                {user.email ?? "当前账号没有邮箱"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                这个邮箱来自 Supabase Auth 登录身份。点击后会创建或更新为 verified，并设为默认投递地址。
              </p>
            </div>
            <form action={useLoginEmailAsDefaultAction}>
              <Button disabled={!user.email} type="submit">
                <MailIcon />
                设为默认收件邮箱
              </Button>
            </form>
          </div>
        </Panel>
      </div>
    </AppShell>
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
          <Button disabled variant="outline" size="sm">
            <MailIcon />
            待验证
          </Button>
        ) : null}
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
