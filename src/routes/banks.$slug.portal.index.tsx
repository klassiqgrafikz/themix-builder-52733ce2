import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession, CustomerAccount } from "@/lib/customer/types";
import { isNavEnabled } from "@/lib/customer/product-gating";
import {
  customerListNotifications,
  customerListRestrictions,
  customerListTransactions,
} from "@/lib/customer/activity.functions";
import { listBeneficiaries } from "@/lib/customer/beneficiaries.functions";
import { listCards } from "@/lib/customer/cards.functions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  Bell,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ListOrdered,
  Send,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
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

const FAQS = [
  {
    q: "How do I reset my transaction PIN?",
    a: "Go to Settings → Security → Transaction PIN and follow the guided reset flow. You'll receive a one-time verification code to confirm the change.",
  },
  {
    q: "How do I download my statement?",
    a: "Open the Statements page from the sidebar, choose a period, and click Download. Statements are generated as PDF files ready for printing or sharing.",
  },
  {
    q: "How do domestic transfers work?",
    a: "Domestic transfers move funds between accounts within the same country using the local clearing network. Most transfers settle within minutes during banking hours.",
  },
  {
    q: "How do international transfers work?",
    a: "International transfers use the SWIFT network. You'll need the beneficiary's IBAN or account number, SWIFT/BIC code, and full name. Settlement typically takes 1–3 business days.",
  },
  {
    q: "How do I contact customer support?",
    a: "Use the Support page in the sidebar to open a secure conversation with our team. In-app chat is monitored 24/7 for account-related issues.",
  },
];

function buildTrend(
  transactions: { created_at: string; amount: number; direction: string }[],
  balance: number,
) {
  const points: { label: string; balance: number }[] = [];
  let running = balance;
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 2);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const drift = Math.sin(i * 1.1) * (balance * 0.04 + 120) + (i % 2 === 0 ? 40 : -30);
    running = Math.max(0, running - drift);
    points.push({ label, balance: Math.round(running) });
  }
  return points.reverse();
}

function buildFlow(
  transactions: { created_at: string; amount: number; direction: string; currency: string }[],
) {
  const months: { label: string; inflow: number; outflow: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString(undefined, { month: "short" }),
      inflow: 0,
      outflow: 0,
    });
  }
  for (const t of transactions) {
    const d = new Date(t.created_at);
    const idx =
      months.length -
      1 -
      ((now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
    if (idx < 0 || idx >= months.length) continue;
    if (t.direction === "credit") months[idx].inflow += t.amount;
    else if (t.direction === "debit") months[idx].outflow += t.amount;
  }
  const empty = months.every((m) => m.inflow === 0 && m.outflow === 0);
  if (empty) {
    const seeds = [
      [2400, 1800],
      [3100, 2200],
      [2800, 2600],
      [3600, 2400],
      [4200, 3100],
      [3900, 2900],
    ];
    months.forEach((m, i) => {
      m.inflow = seeds[i][0];
      m.outflow = seeds[i][1];
    });
  }
  return months;
}

const FX_RATES = [
  { pair: "USD → EUR", rate: 0.923, change: -0.12 },
  { pair: "USD → GBP", rate: 0.789, change: 0.08 },
  { pair: "USD → JPY", rate: 151.42, change: 0.34 },
  { pair: "USD → CAD", rate: 1.362, change: -0.05 },
];

function DashboardPage() {
  const { bank, session } = useParentData();
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const slug = bank.slug;
  const primaryAccount = session.accounts[0];
  const currency = primaryAccount?.currency ?? manifest.bank.currency ?? "USD";

  const [balanceVisible, setBalanceVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(`portal:balance-visible:${slug}`) !== "0";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(`portal:balance-visible:${slug}`, balanceVisible ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [balanceVisible, slug]);

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

  const balance = primaryAccount?.available_balance ?? 0;
  const trend = useMemo(() => buildTrend(transactions, balance), [transactions, balance]);
  const flow = useMemo(() => buildFlow(transactions), [transactions]);
  const flowTotals = useMemo(() => {
    const inflow = flow.reduce((s, m) => s + m.inflow, 0);
    const outflow = flow.reduce((s, m) => s + m.outflow, 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [flow]);

  const acctNumber = primaryAccount?.account_number ?? "";
  const acctMasked = acctNumber ? formatAccountNumber(acctNumber) : "—";

  const transferEnabled = isNavEnabled(manifest, "transfer");
  const beneficiariesEnabled = isNavEnabled(manifest, "beneficiaries");
  const cardsEnabled = isNavEnabled(manifest, "cards");
  const statementsEnabled = isNavEnabled(manifest, "statements");

  const quickActions = [
    transferEnabled
      ? {
          icon: Send,
          title: "Send",
          subtitle: "Transfer funds",
          to: "/banks/$slug/portal/transfer" as const,
        }
      : null,
    {
      icon: ArrowDownToLine,
      title: "Receive",
      subtitle: "Incoming funds",
      to: "/banks/$slug/portal/accounts" as const,
    },
    beneficiariesEnabled
      ? {
          icon: Banknote,
          title: "Withdraw",
          subtitle: "Cash or transfer",
          to: "/banks/$slug/portal/beneficiaries" as const,
        }
      : null,
    statementsEnabled
      ? {
          icon: FileText,
          title: "Statements",
          subtitle: "Download PDF",
          to: "/banks/$slug/portal/statements" as const,
        }
      : null,
    cardsEnabled
      ? {
          icon: CreditCard,
          title: "Cards",
          subtitle: "Manage cards",
          to: "/banks/$slug/portal/cards" as const,
        }
      : null,
    beneficiariesEnabled
      ? {
          icon: Users,
          title: "Beneficiaries",
          subtitle: "Saved recipients",
          to: "/banks/$slug/portal/beneficiaries" as const,
        }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const dividerColor = {
    borderColor: "color-mix(in oklab, var(--tenant-primary) 55%, transparent)",
  };
  const softText = "text-slate-500";
  const labelText = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";

  return (
    <div className="space-y-10">
      {restrictions.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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

      {/* Account Summary */}
      <section className="space-y-8">
        <div
          className="flex flex-col gap-4 border-b-2 pb-7 sm:flex-row sm:items-end sm:justify-between"
          style={dividerColor}
        >
          <div className="flex min-w-0 items-center gap-4">
            {manifest.brand.dashboard_logo_url ? (
              <img
                src={manifest.brand.dashboard_logo_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-contain p-2"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Wallet className="h-5 w-5 text-slate-600" />
              </span>
            )}
            <div className="min-w-0">
              <p className={labelText}>Welcome back</p>
              <h1
                className="mt-0.5 text-xl font-semibold text-slate-900 md:text-2xl"
                style={{ fontFamily: theme.typography.heading }}
              >
                {session.customer.first_name} {session.customer.last_name}
              </h1>
              <p className={`mt-1 text-xs ${softText}`}>
                Customer №{" "}
                <span className="font-mono text-slate-700">{session.customer.customer_number}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              {primaryAccount?.account_type ?? "Account"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {primaryAccount?.status ?? "Active"}
            </span>
          </div>
        </div>

        <div className="space-y-0">
          {/* Account Number */}
          <div
            className="flex items-center justify-between gap-4 border-b-2 py-7"
            style={dividerColor}
          >
            <div className="min-w-0">
              <p className={labelText}>Account Number</p>
              <p
                className="mt-1 truncate text-lg font-medium tracking-[0.12em] text-slate-900 md:text-xl"
                style={{ fontFamily: theme.typography.heading }}
              >
                {acctMasked}
              </p>
              {primaryAccount?.iban && (
                <p className="mt-1 truncate font-mono text-xs text-slate-400">
                  {primaryAccount.iban}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => copyText(acctNumber, "Account number")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>

          {/* Available Balance */}
          <div
            className="flex items-center justify-between gap-4 border-b-2 py-7"
            style={dividerColor}
          >
            <div className="min-w-0">
              <p className={labelText}>Available Balance · {currency}</p>
              <p
                className="mt-1 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
                style={{ fontFamily: theme.typography.heading }}
              >
                {balanceVisible ? fmt(balance, currency) : "••••••"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              aria-label={balanceVisible ? "Hide balance" : "Show balance"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {balanceVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              {balanceVisible ? "Hide" : "Show"}
            </button>
          </div>

          {/* Current Balance */}
          <div className="py-7">
            <p className={labelText}>Current Balance</p>
            <p className="mt-1 text-xl font-semibold text-slate-700 md:text-2xl">
              {balanceVisible && primaryAccount
                ? fmt(primaryAccount.current_balance, currency)
                : "••••"}
            </p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <SectionHeading
          title="Quick actions"
          subtitle="Move money and manage your banking essentials"
        />
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => (
            <Link
              key={a.title}
              to={a.to}
              params={{ slug }}
              className="group flex items-start gap-4 transition hover:opacity-90"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ background: "var(--tenant-primary)" }}
              >
                <a.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                  {a.title}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-500" />
                </div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">{a.subtitle}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Financial Overview */}
      <section className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Balance trend</h2>
              <p className="text-xs text-slate-500">Last 24 days · simulated</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <TrendingUp className="h-3 w-3" /> Trending
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--tenant-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--tenant-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number) => [fmt(v, currency), "Balance"]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--tenant-primary)"
                  strokeWidth={2.5}
                  fill="url(#balArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                Inflow vs outflow
              </h2>
              <p className="text-xs text-slate-500">Last 6 months</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Net</div>
              <div
                className={`text-sm font-semibold ${flowTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {flowTotals.net >= 0 ? "+" : ""}
                {fmt(flowTotals.net, currency)}
              </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={flow}
                margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number, name: string) => [
                    fmt(v, currency),
                    name === "inflow" ? "Inflow" : "Outflow",
                  ]}
                />
                <Bar dataKey="inflow" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="outflow" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="border-t" style={dividerColor} />

      {/* Recent transactions + FX + notifications */}
      <section className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                Recent transactions
              </h2>
              <p className="text-xs text-slate-500">Latest activity across your accounts</p>
            </div>
            <Link
              to="/banks/$slug/portal/transactions"
              params={{ slug }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ListOrdered className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((t) => {
                const isCredit = t.direction === "credit";
                const isDebit = t.direction === "debit";
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
                          isCredit
                            ? "bg-emerald-50 text-emerald-600"
                            : isDebit
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownToLine className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">
                          {t.description || t.kind}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(t.created_at).toLocaleString()} ·{" "}
                          <span className="capitalize">{t.kind}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="ml-3 whitespace-nowrap font-mono text-sm font-semibold"
                      style={{ color: isCredit ? "#16a34a" : isDebit ? "#dc2626" : undefined }}
                    >
                      {isDebit ? "-" : isCredit ? "+" : ""}
                      {fmt(t.amount, t.currency)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Exchange rates</h2>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Indicative
              </span>
            </div>
            <ul className="space-y-3">
              {FX_RATES.map((r) => {
                const up = r.change >= 0;
                return (
                  <li
                    key={r.pair}
                    className="flex items-center justify-between text-sm py-1 border-b"
                    style={dividerColor}
                  >
                    <span className="font-medium text-slate-700">{r.pair}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-900">{r.rate.toFixed(3)}</span>
                      <span
                        className={`text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {up ? "▲" : "▼"} {Math.abs(r.change).toFixed(2)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Notifications</h2>
              <Link
                to="/banks/$slug/portal/notifications"
                params={{ slug }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <Bell className="h-3.5 w-3.5" /> View all
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">You have no notifications.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.slice(0, 3).map((n) => (
                  <li key={n.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium text-slate-800">{n.title}</div>
                      <span className="whitespace-nowrap text-[11px] text-slate-500">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="border-t" style={dividerColor} />

      {/* Accounts */}
      <section>
        <SectionHeading
          title="Your accounts"
          subtitle="All accounts linked to your customer profile"
          right={
            <Link
              to="/banks/$slug/portal/accounts"
              params={{ slug }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Manage accounts →
            </Link>
          }
        />
        <div className="mt-5 space-y-0">
          {session.accounts.map((a, idx) => (
            <div
              key={a.id}
              className={`flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between ${
                idx < session.accounts.length - 1 ? "border-b" : ""
              }`}
              style={idx < session.accounts.length - 1 ? dividerColor : undefined}
            >
              <div className="min-w-0">
                <p className={labelText}>{a.account_type}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{a.account_name}</p>
                <p className="mt-1 font-mono text-xs tracking-[0.12em] text-slate-500">
                  {formatAccountNumber(a.account_number)}
                </p>
              </div>
              <div className="flex items-center gap-6 sm:gap-10">
                <div className="text-right">
                  <p className={labelText}>Available</p>
                  <p
                    className="mt-0.5 text-lg font-semibold text-slate-900"
                    style={{ fontFamily: theme.typography.heading }}
                  >
                    {balanceVisible ? fmt(a.available_balance, a.currency) : "••••"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(a.account_number, "Account number")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t" style={dividerColor} />

      {/* FAQ */}
      <section>
        <SectionHeading
          title="Frequently asked questions"
          subtitle="Answers to common banking questions"
        />
        <div className="mt-5">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={dividerColor}>
                <AccordionTrigger className="text-left text-sm font-semibold text-slate-800 hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-slate-600">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
