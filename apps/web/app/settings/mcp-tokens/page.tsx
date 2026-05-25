import {
  createSupabaseMcpTokensRepository,
  type McpTokenRow,
} from "@repo/database";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/video-records/view-model";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { TrashIcon } from "../../_components/icons";
import { createMcpTokenAction, revokeMcpTokenAction } from "./actions";
import { CopyTextButton } from "./copy-text-button";

const scopes = [
  {
    description: "允许智能体创建视频摘要任务。",
    label: "创建摘要任务",
    value: "digest:create",
  },
  {
    description: "允许智能体读取自己的摘要记录、字幕和摘要结果。",
    label: "读取摘要记录",
    value: "digest:read",
  },
] as const;

const configExample = `MCP URL: https://your-domain.com/api/mcp
Authorization: Bearer mcp_xxx`;

export const dynamic = "force-dynamic";

export default async function McpTokenSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ createdToken?: string; message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const user = await requireUser();
  const mcpTokensRepository = createSupabaseMcpTokensRepository(
    createAdminClient(),
  );
  const mcpTokens = await mcpTokensRepository.listForUser({ userId: user.id });
  const activeTokenCount = mcpTokens.filter(isActiveToken).length;

  return (
    <AppShell current="/settings/mcp-tokens" userEmail={user.email}>
      <PageHeader
        eyebrow="MCP 令牌设置"
        title="创建和撤销智能体访问权限"
        description="令牌允许外部智能体创建视频摘要任务，同时保留用户归属，并让结果出现在网站记录列表中。"
      />

      {resolvedSearchParams?.message ? (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          {resolvedSearchParams.message}
        </div>
      ) : null}

      {resolvedSearchParams?.createdToken ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-950">
            新令牌只显示一次
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-white p-3 font-mono text-xs leading-6 text-slate-950 ring-1 ring-amber-200">
            {resolvedSearchParams.createdToken}
          </pre>
          <div className="mt-3">
            <CopyTextButton
              label="复制令牌"
              text={resolvedSearchParams.createdToken}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel>
          <PanelHeader
            title="MCP 令牌"
            description={`${activeTokenCount} 个启用中的令牌`}
          />
          {mcpTokens.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {mcpTokens.map((token) => (
                <TokenItem key={token.id} token={token} />
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm leading-6 text-slate-600">
              当前还没有 MCP 令牌。创建后可以在外部智能体里用 Bearer token
              调用站点的 MCP 接口。
            </div>
          )}
        </Panel>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="新建令牌" />
            <form action={createMcpTokenAction} className="grid gap-4 p-5">
              <div className="grid gap-2">
                <label
                  htmlFor="token-name"
                  className="text-sm font-medium text-slate-800"
                >
                  令牌名称
                </label>
                <input
                  id="token-name"
                  name="name"
                  placeholder="研究助手"
                  required
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-slate-800">
                  权限范围
                </legend>
                {scopes.map((scope, index) => (
                  <label
                    key={scope.value}
                    className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope.value}
                      defaultChecked={index < 2}
                      className="mt-0.5 size-4 rounded accent-blue-600"
                    />
                    <span className="font-medium text-slate-900">
                      {scope.label}
                    </span>
                    <span className="col-start-2 text-xs leading-5 text-slate-500">
                      {scope.value} · {scope.description}
                    </span>
                  </label>
                ))}
              </fieldset>
              <Button type="submit">创建令牌</Button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader title="配置示例" />
            <div className="grid gap-3 p-5">
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {configExample}
              </pre>
              <CopyTextButton label="复制配置" text={configExample} />
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function TokenItem({ token }: { token: McpTokenRow }) {
  const tokenStatus = getTokenStatus(token);
  const canRevoke = tokenStatus === "active";

  return (
    <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_160px_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-950">{token.name}</p>
          <StatusBadge tone={tokenStatusTone[tokenStatus]}>
            {tokenStatusLabel[tokenStatus]}
          </StatusBadge>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          上次使用：{formatOptionalDate(token.lastUsedAt)}
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
      <p className="font-mono text-sm text-slate-500">{token.tokenPrefix}...</p>
      {canRevoke ? (
        <form action={revokeMcpTokenAction}>
          <input type="hidden" name="id" value={token.id} />
          <Button variant="outline" size="sm" type="submit">
            <TrashIcon />
            撤销
          </Button>
        </form>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <TrashIcon />
          撤销
        </Button>
      )}
    </div>
  );
}

type TokenStatus = "active" | "expired" | "revoked";

const tokenStatusLabel: Record<TokenStatus, string> = {
  active: "启用中",
  expired: "已过期",
  revoked: "已撤销",
};

const tokenStatusTone: Record<
  TokenStatus,
  "amber" | "green" | "slate"
> = {
  active: "green",
  expired: "amber",
  revoked: "slate",
};

function getTokenStatus(token: McpTokenRow): TokenStatus {
  if (token.revokedAt) {
    return "revoked";
  }

  if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

function isActiveToken(token: McpTokenRow) {
  return getTokenStatus(token) === "active";
}

function formatOptionalDate(value: Date | null) {
  return value ? formatDateTime(value) : "暂无";
}
