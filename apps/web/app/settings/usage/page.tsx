import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import { usageStats } from "../../_data/mock-data";

export default function UsageSettingsPage() {
  return (
    <AppShell current="/settings/usage">
      <PageHeader
        eyebrow="Usage"
        title="Monitor quota and operational volume"
        description="A static usage snapshot for monthly tasks, transcript extraction, audio transcription, email delivery, and failures."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {usageStats.map((stat) => (
          <Panel key={stat.label}>
            <div className="p-5">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">Limit: {stat.limit}</p>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader
            title="Monthly plan progress"
            description="Static bars showing the shape of the future billing and quota UI."
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
          <PanelHeader title="Current plan" />
          <div className="grid gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-950">MVP Pro</p>
                <StatusBadge tone="blue">Active</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Designed for individual research workflows with website and MCP
                access.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Plan limit changes will later connect to billing, alerts, and
              upgrade flows.
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
