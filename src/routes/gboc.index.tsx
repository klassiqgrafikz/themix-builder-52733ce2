import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  gbocListBanks,
  gbocListAudit,
} from "@/lib/gboc/operations.functions";
import { getPlatformSettings } from "@/lib/gboc/platform-settings.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Wallet,
  Activity,
  Receipt,
  Bell,
  ShieldAlert,
  Snowflake,
  MessagesSquare,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/gboc/")({
  component: GbocDashboard,
});

function GbocDashboard() {
  const listFn = useServerFn(gbocListBanks);
  const auditFn = useServerFn(gbocListAudit);
  const settingsFn = useServerFn(getPlatformSettings);

  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => listFn() });
  const settingsQ = useQuery({ queryKey: ["platform-settings"], queryFn: () => settingsFn() });
  const banks = banksQ.data ?? [];

  // Recent activity: pull audit for the newest published bank as a preview.
  const previewBankId = banks[0]?.id;
  const activityQ = useQuery({
    queryKey: ["gboc", "audit", previewBankId, "dashboard"],
    enabled: !!previewBankId,
    queryFn: () => auditFn({ data: { bank_id: previewBankId as string } }),
  });

  const published = banks.filter((b) => b.render_status === "published").length;
  const drafts = banks.length - published;
  const customers = banks.reduce((n, b) => n + b.customer_count, 0);
  const accounts = banks.reduce((n, b) => n + b.account_count, 0);

  const stats = [
    { label: "Total banks", value: banks.length, icon: Building2 },
    { label: "Published", value: published, icon: Activity },
    { label: "Drafts", value: drafts, icon: Building2 },
    { label: "Active customers", value: customers, icon: Users },
    { label: "Total accounts", value: accounts, icon: Wallet },
    { label: "Today's transactions", value: "—", icon: Receipt, hint: "Live feed" },
    { label: "Pending restrictions", value: "—", icon: ShieldAlert, hint: "Live feed" },
    { label: "Frozen accounts", value: "—", icon: Snowflake, hint: "Live feed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise view of every generated bank running on TheMixWeb.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          Live chat:
          <Badge variant={settingsQ.data?.live_chat_enabled ? "default" : "secondary"}>
            {settingsQ.data?.live_chat_enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-none">{s.value}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </div>
                  {s.hint && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{s.hint}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent activity
              </h2>
              <Link to="/gboc/audit" className="text-xs text-muted-foreground underline">
                Open audit center
              </Link>
            </div>
            {!previewBankId ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Publish a bank to see live operations activity here.
              </div>
            ) : activityQ.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : (activityQ.data?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No recent activity.
              </div>
            ) : (
              <ul className="divide-y">
                {activityQ.data?.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs">{a.action}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {a.actor_email ?? "system"}
                    </span>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Platform alerts
            </h2>
            <div className="space-y-2 text-sm">
              {drafts > 0 && (
                <AlertRow
                  tone="warn"
                  title={`${drafts} draft bank${drafts === 1 ? "" : "s"} awaiting publish`}
                />
              )}
              {published === 0 && (
                <AlertRow
                  tone="warn"
                  title="No published banks yet. GBOC operations require a published tenant."
                />
              )}
              {published > 0 && drafts === 0 && (
                <AlertRow tone="ok" title="All banks published. Platform healthy." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Published tenants
            </h2>
            <Link to="/gboc/banks" className="text-xs text-muted-foreground underline">
              Manage banks
            </Link>
          </div>
          {banks.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No banks yet.{" "}
              <Link to="/launch" className="underline">
                Launch your first bank
              </Link>
              .
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {banks.slice(0, 6).map((b) => (
                <Link
                  key={b.id}
                  to="/gboc/operations"
                  search={{ bank: b.id }}
                  className="group rounded-md border p-3 text-sm hover:border-primary"
                >
                  <div className="flex items-center gap-2">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{b.bank_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.customer_count} customers · {b.account_count} accounts
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({ tone, title }: { tone: "ok" | "warn"; title: string }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>{title}</div>
  );
}
