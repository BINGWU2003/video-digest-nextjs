import { Button } from "@/components/ui/button";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { MailIcon, TrashIcon } from "../../_components/icons";
import { verifiedEmails } from "../../_data/mock-data";

export default function EmailSettingsPage() {
  return (
    <AppShell current="/settings/emails">
      <PageHeader
        eyebrow="邮箱设置"
        title="管理已验证收件人"
        description="摘要投递只允许发送到已验证邮箱。新任务选择邮件投递时，会默认使用默认邮箱。"
        actions={
          <Button>
            <MailIcon />
            添加邮箱
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader title="已验证邮箱" />
          <div className="divide-y divide-slate-200">
            {verifiedEmails.map((email) => (
              <div
                key={email.address}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">{email.address}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    上次发送：{email.lastSentAt}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    tone={email.status === "已验证" ? "green" : "amber"}
                  >
                    {email.status}
                  </StatusBadge>
                  {email.default ? (
                    <StatusBadge tone="blue">默认</StatusBadge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    设为默认
                  </Button>
                  <Button variant="outline" size="sm">
                    验证
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`删除 ${email.address}`}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="添加收件人"
            description="第一版先展示静态表单。"
          />
          <form className="grid gap-4 p-5">
            <div className="grid gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-800"
              >
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <Button type="button">
              <MailIcon />
              发送验证邮件
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
