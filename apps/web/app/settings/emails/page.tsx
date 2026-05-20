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
        eyebrow="Email settings"
        title="Manage verified recipients"
        description="Summary delivery is restricted to verified addresses. The default address is used when a new task requests email delivery."
        actions={
          <Button>
            <MailIcon />
            Add email
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader title="Verified email addresses" />
          <div className="divide-y divide-slate-200">
            {verifiedEmails.map((email) => (
              <div
                key={email.address}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">{email.address}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Last sent: {email.lastSentAt}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    tone={email.status === "Verified" ? "green" : "amber"}
                  >
                    {email.status}
                  </StatusBadge>
                  {email.default ? (
                    <StatusBadge tone="blue">Default</StatusBadge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    Set default
                  </Button>
                  <Button variant="outline" size="sm">
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${email.address}`}
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
            title="Add recipient"
            description="Static form for the first implementation pass."
          />
          <form className="grid gap-4 p-5">
            <div className="grid gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-800"
              >
                Email address
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
              Send verification
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
