import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { CopyIcon, TrashIcon } from "../../_components/icons";
import { mcpTokens } from "../../_data/mock-data";

const scopes = ["create:jobs", "read:records", "send:email"];

export const dynamic = "force-dynamic";

export default async function McpTokenSettingsPage() {
  const user = await requireUser();

  return (
    <AppShell current="/settings/mcp-tokens" userEmail={user.email}>
      <PageHeader
        eyebrow="MCP 令牌设置"
        title="创建和撤销智能体访问权限"
        description="令牌允许外部智能体创建视频摘要任务，同时保留用户归属，并让结果出现在网站记录列表中。"
        actions={<Button>创建令牌</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel>
          <PanelHeader title="启用中的令牌" />
          <div className="divide-y divide-slate-200">
            {mcpTokens.map((token) => (
              <div
                key={token.name}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_180px_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{token.name}</p>
                    <StatusBadge tone="green">{token.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    上次使用：{token.lastUsedAt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {token.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="font-mono text-sm text-slate-500">
                  mcp_...{token.name.slice(0, 4).toLowerCase()}
                </p>
                <Button variant="outline" size="sm">
                  <TrashIcon />
                  撤销
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="新建令牌" />
            <form className="grid gap-4 p-5">
              <div className="grid gap-2">
                <label
                  htmlFor="token-name"
                  className="text-sm font-medium text-slate-800"
                >
                  令牌名称
                </label>
                <input
                  id="token-name"
                  placeholder="研究助手"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-slate-800">
                  权限范围
                </legend>
                {scopes.map((scope, index) => (
                  <label
                    key={scope}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={index < 2}
                      className="size-4 rounded accent-blue-600"
                    />
                    {scope}
                  </label>
                ))}
              </fieldset>
              <Button type="button">创建令牌</Button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader title="配置示例" />
            <div className="grid gap-3 p-5">
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {`MCP URL: https://your-domain.com/api/mcp
Authorization: Bearer mcp_xxx`}
              </pre>
              <Button variant="outline">
                <CopyIcon />
                复制配置
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
