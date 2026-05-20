import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";

import {
  AppShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from "../../_components/app-shell";
import {
  CopyIcon,
  MailIcon,
  RefreshIcon,
  TrashIcon,
} from "../../_components/icons";
import { records, statusLabels } from "../../_data/mock-data";

function statusTone(
  status: string,
): "blue" | "green" | "red" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  return "blue";
}

const timelineSteps = [
  "Created",
  "Metadata fetched",
  "Transcript extracted",
  "Audio transcribed",
  "Summary generated",
  "Email delivered",
];

export function generateStaticParams() {
  return records.map((record) => ({ id: record.id }));
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = records.find((item) => item.id === id);

  if (!record) {
    notFound();
  }

  const activeStep =
    record.status === "failed"
      ? 2
      : record.status === "completed"
        ? timelineSteps.length
        : record.status === "summarizing"
          ? 4
          : 3;

  return (
    <AppShell current="/records">
      <PageHeader
        eyebrow="Record detail"
        title={record.title}
        description={`${record.platform} video by ${record.author}. ${record.createdBy}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={record.sourceUrl}>Open source</Link>
            </Button>
            <Button variant="outline">
              <RefreshIcon />
              Retry
            </Button>
            <Button>
              <MailIcon />
              Send email
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Panel>
            <PanelHeader
              title="Summary"
              action={
                <StatusBadge tone={statusTone(record.status)}>
                  {statusLabels[record.status]}
                </StatusBadge>
              }
            />
            <div className="grid gap-5 p-5">
              <p className="leading-7 text-slate-700">{record.summary.short}</p>

              {record.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {record.error.code}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-red-700">
                    {record.error.message}
                  </p>
                  <Button className="mt-4" variant="outline">
                    <RefreshIcon />
                    {record.error.action}
                  </Button>
                </div>
              ) : null}

              {record.summary.keyPoints.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Key points
                  </h2>
                  <ul className="mt-3 grid gap-2">
                    {record.summary.keyPoints.map((point) => (
                      <li
                        key={point}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {record.summary.timeline.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Timeline
                  </h2>
                  <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {record.summary.timeline.map((item) => (
                      <div
                        key={`${item.time}-${item.topic}`}
                        className="grid gap-2 p-4 sm:grid-cols-[80px_180px_1fr]"
                      >
                        <p className="font-mono text-xs text-slate-500">
                          {item.time}
                        </p>
                        <p className="text-sm font-medium text-slate-950">
                          {item.topic}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">
                          {item.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {record.summary.takeaways.length ? (
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Takeaways
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.summary.takeaways.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <CopyIcon />
                  Copy summary
                </Button>
                <Button variant="outline">
                  <RefreshIcon />
                  Regenerate summary
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Transcript"
              description={record.transcriptSource}
            />
            {record.transcript.length ? (
              <div className="divide-y divide-slate-200">
                {record.transcript.map((segment) => (
                  <div
                    key={`${segment.time}-${segment.text}`}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[80px_1fr]"
                  >
                    <p className="font-mono text-xs text-slate-500">
                      {segment.time}
                    </p>
                    <p className="text-sm leading-6 text-slate-700">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-600">
                No transcript segments are available for this failed job.
              </div>
            )}
            <div className="border-t border-slate-200 p-5">
              <Button variant="outline">
                <CopyIcon />
                Copy transcript
              </Button>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="Video info" />
            <dl className="grid gap-3 p-5 text-sm">
              {[
                ["Record ID", record.id],
                ["Author", record.author],
                ["Duration", record.duration],
                ["Created", record.createdAt],
                ["Completed", record.completedAt ?? "In progress"],
                ["Delivery", record.deliveryStatus],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Processing timeline" />
            <ol className="grid gap-3 p-5">
              {timelineSteps.map((step, index) => {
                const completed =
                  index < activeStep && record.status !== "failed";
                const failedPoint =
                  record.status === "failed" && index === activeStep;
                return (
                  <li key={step} className="flex gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                        completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : failedPoint
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {step}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {completed
                          ? "Done"
                          : failedPoint
                            ? "Needs attention"
                            : "Pending"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader title="Delivery" />
            <div className="grid gap-3 p-5 text-sm text-slate-700">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-950">Default email</p>
                <p className="mt-1 text-slate-600">alex@example.com</p>
                <p className="mt-2 text-xs text-slate-500">
                  Status: {record.deliveryStatus}
                </p>
              </div>
              <Button variant="outline">
                <MailIcon />
                Preview email
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Danger zone" />
            <div className="p-5">
              <Button variant="destructive">
                <TrashIcon />
                Delete record
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
