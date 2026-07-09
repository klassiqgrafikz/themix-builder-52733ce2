import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { isNavEnabled } from "@/lib/customer/product-gating";
import { simulateVerifyEmail } from "@/lib/customer/customer.functions";
import {
  customerListNotifications,
  customerListRestrictions,
  customerListTransactions,
} from "@/lib/customer/activity.functions";
import { listBeneficiaries } from "@/lib/customer/beneficiaries.functions";
import { listCards } from "@/lib/customer/cards.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  Banknote,
  Bell,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  ListOrdered,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
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
  const slug = bank.slug;
  const primaryAccount = session.accounts[0];
  const currency = primaryAccount?.currency ?? manifest.bank.currency ?? "USD";

  // Balance visibility — persists during session (until refresh).
  const [balanceVisible, setBalanceVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(`portal:balance-visible:${slug}`) !== "0";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(`portal:balance-visible:${slug}`, balanceVisible ? "1" : "0");
    } catch { /* ignore */ }
  }, [balanceVisible, slug]);

  const qc = useQueryClient();
  const doVerify = useServerFn(simulateVerifyEmail);
  const verifyMut = useMutation({
    mutationFn: () => doVerify({ data: { slug } }),
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
  const benFn = useServerFn(listBeneficiaries);
  const cardsFn = useServerFn(listCards);

  const txQ = useQuery({
    queryKey: ["portal-tx", slug],
    queryFn: () => txFn({ data: { slug } }),
    refetchInterval: 15000,
  });
  const notifQ = useQuery({
    queryKey: ["portal-notif", slug],
    queryFn: () => notifFn({ data: { slug } }),
    refetchInterval: 15000,
  });
  const restrQ = useQuery({
    queryKey: ["portal-restr", slug],
    queryFn: () => restrFn({ data: { slug } }),
    refetchInterval: 30000,
  });
  const benQ = useQuery({
    queryKey: ["portal-ben", slug],
    queryFn: () => benFn({ data: { slug } }),
  });
  const cardsQ = useQuery({
    queryKey: ["portal-cards", slug],
    queryFn: () => cardsFn({ data: { slug } }),
  });

  const transactions = txQ.data ?? [];
  const notifications = notifQ.data ?? [];
  const restrictions = restrQ.data ?? [];
  const beneficiaries = benQ.data ?? [];
  const cards = cardsQ.data ?? [];

  const now = Date.now();
  const activeCards = cards.filter((c) => c.status === "active").length;
  const frozenCards = cards.filter((c) => c.status === "frozen").length;
  const expiringCards = cards.filter((c) => {
    const exp = new Date(c.expiry_year, c.expiry_month - 1, 1).getTime();
    const days = (exp - now) / (1000 * 60 * 60 * 24);
    return days > 0 && days < 60;
  }).length;

  const acctNumber = primaryAccount?.account_number ?? "";
  const acctMasked = acctNumber ? formatAccountNumber(acctNumber) : "—";
  const balance = primaryAccount?.available_balance ?? 0;

  const transferEnabled = isNavEnabled(manifest, "transfer");
  const beneficiariesEnabled = isNavEnabled(manifest, "beneficiaries");
  const cardsEnabled = isNavEnabled(manifest, "cards");
  const quickActions = [
    transferEnabled
      ? { icon: Send, title: "Send Money", subtitle: "Transfer worldwide", to: "/banks/$slug/portal/transfer" as const }
      : null,
    { icon: ArrowDownToLine, title: "Receive Money", subtitle: "Log incoming funds", to: "/banks/$slug/portal/accounts" as const },
    beneficiariesEnabled
      ? { icon: Banknote, title: "Withdraw", subtitle: "Cash or transfer", to: "/banks/$slug/portal/beneficiaries" as const }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  const copyAcct = async () => {
    if (!acctNumber) return;
    try {
      await navigator.clipboard.writeText(acctNumber);
      toast.success("Account number copied.");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-8">
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
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "var(--tenant-accent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full opacity-20 blur-3xl" style={{ background: "var(--tenant-primary)" }} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {manifest.brand.dashboard_logo_url ? (
              <img src={manifest.brand.dashboard_logo_url} alt="" className="h-10 w-10 rounded-lg bg-white/10 object-contain p-1.5 ring-1 ring-white/15" />
            ) : null}
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                {session.customer.first_name} {session.customer.last_name}
              </div>
              <div className="mt-0.5 text-xs text-white/60">
                Customer № <span className="font-mono text-white/85">{session.customer.customer_number}</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {primaryAccount?.status ?? "Active"}
          </span>
        </div>

        <div className="relative mt-8">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
            Account Number
          </div>
          <button
            type="button"
            onClick={copyAcct}
            className="mt-1.5 inline-flex items-center gap-2 rounded-lg text-lg font-medium tracking-[0.18em] text-white/95 transition hover:text-white md:text-xl"
            style={{ fontFamily: theme.typography.heading }}
          >
            <span>{acctMasked}</span>
            <Copy className="h-4 w-4 opacity-70" />
          </button>
        </div>

        <div className="relative mt-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
            Available Balance · {currency}
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: theme.typography.heading }}>
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
            params={{ slug }}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_-15px_rgba(15,23,42,0.25)]"
          >
            <span
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white transition group-hover:scale-105"
              style={{ background: "linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark))" }}
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

      {/* Recent Transactions + Notifications */}
      <section className="grid gap-5 lg:grid-cols-2">
        <BrandedCard manifest={manifest}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Recent transactions</div>
            <Link to="/banks/$slug/portal/transactions" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
              <ListOrdered className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No transactions yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{t.description || t.kind}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleString()} · <span className="capitalize">{t.kind}</span>
                    </div>
                  </div>
                  <div
                    className="ml-3 whitespace-nowrap font-mono text-sm"
                    style={{
                      color: t.direction === "credit" ? "#16a34a" : t.direction === "debit" ? "#dc2626" : undefined,
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
            <Link to="/banks/$slug/portal/notifications" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
              <Bell className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">You have no notifications.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-800">{n.title}</div>
                    <span className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  {n.body && <div className="mt-0.5 text-xs text-slate-500">{n.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </BrandedCard>
      </section>

      {/* Account summary + Cards + Beneficiaries */}
      <section className="grid gap-5 lg:grid-cols-3">
        <BrandedCard manifest={manifest}>
          <div className="mb-3 text-sm font-semibold text-slate-900">Account summary</div>
          <dl className="space-y-2 text-sm">
            <SummaryRow label="Account type" value={primaryAccount?.account_type ?? "—"} />
            <SummaryRow label="Status" value={primaryAccount?.status ?? "—"} />
            <SummaryRow label="Branch" value={manifest.bank.name} />
            <SummaryRow label="Customer №" value={session.customer.customer_number} />
            <SummaryRow label="Currency" value={currency} />
            <SummaryRow
              label="Opened"
              value={primaryAccount ? new Date(primaryAccount.created_at).toLocaleDateString() : "—"}
            />
          </dl>
        </BrandedCard>

        {cardsEnabled && (
          <BrandedCard manifest={manifest}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Cards</div>
              <Link to="/banks/$slug/portal/cards" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                <CreditCard className="h-3.5 w-3.5" /> Manage cards
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatTile label="Active" value={activeCards} tone="ok" />
              <StatTile label="Frozen" value={frozenCards} tone="warn" />
              <StatTile label="Expiring" value={expiringCards} tone="danger" />
            </div>
            {cards.length === 0 && (
              <div className="mt-3 text-xs text-slate-500">No cards issued yet.</div>
            )}
          </BrandedCard>
        )}

        {beneficiariesEnabled && (
          <BrandedCard manifest={manifest}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Beneficiaries</div>
              <Link to="/banks/$slug/portal/beneficiaries" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                <Users className="h-3.5 w-3.5" /> Manage
              </Link>
            </div>
            {beneficiaries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">No beneficiaries yet.</div>
            ) : (
              <ul className="space-y-2">
                {beneficiaries.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{b.beneficiary_name}</div>
                      <div className="truncate text-xs text-slate-500 font-mono">{b.account_number}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                      {b.kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </BrandedCard>
        )}
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate text-right text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "danger" }) {
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-rose-600";
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
