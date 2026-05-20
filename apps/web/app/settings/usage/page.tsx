import { requireUser } from "@/lib/auth";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { usageStats } from "../../_data/mock-data";

export const dynamic = "force-dynamic";

export default async function UsageSettingsPage() {
  const user = await requireUser();

  return (
    <AppShell current="/settings/usage" userEmail={user.email}>
      <PageHeader
        eyebrow="用量"
        title="查看额度和运行情况"
        description="静态展示本月任务、字幕提取、音频转写、邮件投递和失败次数。"
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {usageStats.map((stat) => (
          <Panel key={stat.label}>
            <div className="p-5">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">额度：{stat.limit}</p>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader
            title="本月套餐进度"
            description="第一版先用静态进度条呈现未来计费和额度页面的结构。"
          />
          <div className="grid gap-5 p-5">
            {usageStats.slice(0, 4).map((stat, index) => (
              <div key={stat.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-800">{stat.label}</p>
                  <p className="text-slate-500">
                    {stat.value} / {stat.limit}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: ["42%", "37%", "62%", "28%"][index] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="当前套餐" />
          <div className="grid gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-950">
                  MVP 专业版
                </p>
                <StatusBadge tone="blue">启用中</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                面向个人研究工作流，支持网站操作和 MCP 访问。
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              套餐额度变更后续会接入计费、提醒和升级流程。
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
