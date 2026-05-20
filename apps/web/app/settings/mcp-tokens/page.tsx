import { Button } from "@/components/ui/button";

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

export default function McpTokenSettingsPage() {
  return (
    <AppShell current="/settings/mcp-tokens">
      <PageHeader
        eyebrow="MCP token settings"
        title="Create and revoke agent access"
        description="Tokens let external agents create video digest jobs while preserving ownership and making every result visible in the website record list."
        actions={<Button>Create token</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel>
          <PanelHeader title="Active tokens" />
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
                    Last used: {token.lastUsedAt}
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
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="New token" />
            <form className="grid gap-4 p-5">
              <div className="grid gap-2">
                <label
                  htmlFor="token-name"
                  className="text-sm font-medium text-slate-800"
                >
                  Token name
                </label>
                <input
                  id="token-name"
                  placeholder="Research agent"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-slate-800">
                  Scopes
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
              <Button type="button">Create token</Button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader title="Configuration example" />
            <div className="grid gap-3 p-5">
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {`MCP URL: https://your-domain.com/api/mcp
Authorization: Bearer mcp_xxx`}
              </pre>
              <Button variant="outline">
                <CopyIcon />
                Copy config
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
