import Link from "next/link";

import { Button } from "@/components/ui/button";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../_components/app-shell";
import { ArrowRightIcon, SearchIcon } from "../_components/icons";
import { records, statusLabels } from "../_data/mock-data";

const statuses = [
  "All",
  "Queued",
  "Processing",
  "Completed",
  "Failed",
  "Delivered",
];
const platforms = ["All", "YouTube", "Bilibili"];

function statusTone(
  status: string,
): "blue" | "green" | "red" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  return "blue";
}

export default function RecordsPage() {
  return (
    <AppShell current="/records">
      <PageHeader
        eyebrow="Records"
        title="Search every submitted video"
        description="Website jobs, MCP-created tasks, and scheduled digests are shown together with status, transcript source, delivery state, and source links."
        actions={
          <Button asChild>
            <Link href="/dashboard">
              New task
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <Panel>
        <PanelHeader
          title="Filters"
          description="Static controls for the first UI pass."
        />
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <div className="grid gap-2">
            <label
              htmlFor="record-search"
              className="text-sm font-medium text-slate-800"
            >
              Search
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="record-search"
                type="search"
                placeholder="Title, URL, summary, or error reason"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">Status</p>
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
            <p className="text-sm font-medium text-slate-800">Platform</p>
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
          title="All records"
          description={`${records.length} static records`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.04em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Title</th>
                <th className="px-5 py-3 font-semibold">Platform</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Completed</th>
                <th className="px-5 py-3 font-semibold">Transcript</th>
                <th className="px-5 py-3 font-semibold">Delivery</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
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
                      {record.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {record.sourceUrl}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.createdBy}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {record.platform}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={statusTone(record.status)}>
                      {statusLabels[record.status]}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {record.createdAt}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {record.completedAt ?? "In progress"}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {record.transcriptSource}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {record.deliveryStatus}
                  </td>
                  <td className="px-5 py-4">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/records/${record.id}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
