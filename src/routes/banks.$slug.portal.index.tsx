import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { simulateVerifyEmail } from "@/lib/customer/customer.functions";
import {
  customerListNotifications,
  customerListRestrictions,
  customerListTransactions,
} from "@/lib/customer/activity.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  Banknote,
  Copy,
  Eye,
  EyeOff,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/banks/$slug/portal/")({
  component: DashboardPage,
});

function useParentData() {
  return useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
}

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

function formatAccountNumber(n: string) {
  return n.replace(/(.{4})/g, "$1 ").trim();
}

function DashboardPage() {
  const { bank, session } = useParentData();
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primaryAccount = session.accounts[0];
  const currency = primaryAccount?.currency ?? manifest.bank.currency ?? "USD";
  const [balanceVisible, setBalanceVisible] = useState(true);

  const qc = useQueryClient();
  const doVerify = useServerFn(simulateVerifyEmail);
  const verifyMut = useMutation({
    mutationFn: () => doVerify({ data: { slug: bank.slug } }),
    onSuccess: () => {
      toast.success("Email verified (simulation)");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Verification failed"),
  });

  const txFn = useServerFn(customerListTransactions);
  const notifFn = useServerFn(customerListNotifications);
  const restrFn = useServerFn(customerListRestrictions);
  const txQ = useQuery({
    queryKey: ["portal-tx", bank.slug],
    queryFn: () => txFn({ data: { slug: bank.slug } }),
    refetchInterval: 15000,
  });
  const notifQ = useQuery({
    queryKey: ["portal-notif", bank.slug],
    queryFn: () => notifFn({ data: { slug: bank.slug } }),
    refetchInterval: 15000,
  });
  const restrQ = useQuery({
    queryKey: ["portal-restr", bank.slug],
    queryFn: () => restrFn({ data: { slug: bank.slug } }),
    refetchInterval: 30000,
  });
  const transactions = txQ.data ?? [];
  const notifications = notifQ.data ?? [];
  const restrictions = restrQ.data ?? [];

  const acctNumber = primaryAccount?.account_number ?? "";
  const acctMasked = acctNumber ? formatAccountNumber(acctNumber) : "—";
  const balance = primaryAccount?.available_balance ?? 0;

  const quickActions = [
    {
      icon: Send,
      title: "Send",
      subtitle: "Transfer worldwide",
      to: "/banks/$slug/portal/transfer" as const,
    },
    {
      icon: ArrowDownToLine,
      title: "Receive",
      subtitle: "Log incoming funds",
      to: "/banks/$slug/portal/accounts" as const,
    },
    {
      icon: Banknote,
      title: "Withdraw",
      subtitle: "Cash or transfer",
      to: "/banks/$slug/portal/beneficiaries" as const,
    },
  ];

  const copyAcct = async () => {
    if (!acctNumber) return;
    try {
      await navigator.clipboard.writeText(acctNumber);
      toast.success("Account number copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Welcome back
        </p>
        <h1
          className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl"
          style={{ fontFamily: theme.typography.heading }}
        >
          Hello, {session.customer.first_name}.
        </h1>
      </div>

      {!session.customer.email_verified && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Your email isn't verified yet.</span>
          <Button
            size="sm"
            disabled={verifyMut.isPending}
            onClick={() => verifyMut.mutate()}
            style={{ backgroundColor: "var(--tenant-accent)" }}
          >
            {verifyMut.isPending ? "Verifying…" : "Verify email (simulate)"}
          </Button>
        </div>
      )}

      {restrictions.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-semibold">Your account has active restrictions</div>
            {restrictions.map((r) => (
              <div key={r.id} className="text-xs">
                {r.types.join(", ")} — {r.reason || "No reason provided"}
                {r.end_at ? ` (until ${new Date(r.end_at).toLocaleDateString()})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance Hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-7 text-white shadow-[0_20px_60px_-25px_rgba(6,25,56,0.55)] md:p-9"
        style={{
          background:
            "linear-gradient(135deg, var(--tenant-deep) 0%, var(--tenant-dark) 55%, var(--tenant-primary) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--tenant-accent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--tenant-primary)" }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
              Account Number
            </div>
            <button
              type="button"
              onClick={copyAcct}
              className="mt-2 inline-flex items-center gap-2 rounded-lg text-lg font-medium tracking-[0.18em] text-white/95 transition hover:text-white md:text-xl"
              style={{ fontFamily: theme.typography.heading }}
            >
              <span>{acctMasked}</span>
              <Copy className="h-4 w-4 opacity-70" />
            </button>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {primaryAccount?.status ?? "Active"}
          </span>
        </div>

        <div className="relative mt-10">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
            Available Balance
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div
              className="text-4xl font-bold tracking-tight md:text-5xl"
              style={{ fontFamily: theme.typography.heading }}
            >
              {balanceVisible ? fmt(balance, currency) : "••••••"}
            </div>
            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              aria-label={balanceVisible ? "Hide balance" : "Show balance"}
              className="mb-1.5 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {balanceVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-3 text-xs text-white/60">
            Current balance:{" "}
            <span className="font-medium text-white/85">
              {balanceVisible && primaryAccount ? fmt(primaryAccount.current_balance, currency) : "••••"}
            </span>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            params={{ slug: bank.slug }}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_-15px_rgba(15,23,42,0.25)]"
          >
            <span
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white transition group-hover:scale-105"
              style={{
                background:
                  "linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark))",
              }}
            >
              <a.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900">{a.title}</div>
              <div className="text-xs text-slate-500">{a.subtitle}</div>
            </div>
          </Link>
        ))}
      </section>

      {/* Activity */}
      <section className="grid gap-5 lg:grid-cols-2">
        <BrandedCard manifest={manifest}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Recent transactions</div>
            <span className="text-xs text-slate-500">{transactions.length}</span>
          </div>
          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No transactions yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">
                      {t.description || t.kind}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleString()} · {t.kind}
                    </div>
                  </div>
                  <div
                    className="ml-3 whitespace-nowrap font-mono text-sm"
                    style={{
                      color:
                        t.direction === "credit"
                          ? "#16a34a"
                          : t.direction === "debit"
                            ? "#dc2626"
                            : undefined,
                    }}
                  >
                    {t.direction === "debit" ? "-" : t.direction === "credit" ? "+" : ""}
                    {fmt(t.amount, t.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BrandedCard>

        <BrandedCard manifest={manifest}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Notifications</div>
            <span className="text-xs text-slate-500">{notifications.length}</span>
          </div>
          {notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              You have no notifications.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-800">{n.title}</div>
                    <span className="text-xs text-slate-500">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {n.body && <div className="mt-0.5 text-xs text-slate-500">{n.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </BrandedCard>
      </section>
    </div>
  );
}
