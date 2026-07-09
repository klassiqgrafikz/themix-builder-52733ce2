import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  ShieldCheck,
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

function buildTrend(transactions: { created_at: string; amount: number; direction: string }[], balance: number) {
  // Build a 12-point trend ending at current balance. Walk backwards from now.
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

function buildFlow(transactions: { created_at: string; amount: number; direction: string; currency: string }[]) {
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
  // Seed synthetic baseline so chart never looks flat during onboarding.
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
      ? { icon: Send, title: "Send", subtitle: "Transfer worldwide", to: "/banks/$slug/portal/transfer" as const, tone: "primary" as const }
      : null,
    { icon: ArrowDownToLine, title: "Receive", subtitle: "Log incoming funds", to: "/banks/$slug/portal/accounts" as const, tone: "neutral" as const },
    beneficiariesEnabled
      ? { icon: Banknote, title: "Withdraw", subtitle: "Cash or transfer", to: "/banks/$slug/portal/beneficiaries" as const, tone: "neutral" as const }
      : null,
    statementsEnabled
      ? { icon: FileText, title: "Statements", subtitle: "Download PDFs", to: "/banks/$slug/portal/statements" as const, tone: "neutral" as const }
      : null,
    cardsEnabled
      ? { icon: CreditCard, title: "Cards", subtitle: "Manage & freeze", to: "/banks/$slug/portal/cards" as const, tone: "neutral" as const }
      : null,
    beneficiariesEnabled
      ? { icon: Users, title: "Beneficiaries", subtitle: "Saved recipients", to: "/banks/$slug/portal/beneficiaries" as const, tone: "neutral" as const }
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

  return (
    <div className="space-y-8">
      {!session.customer.email_verified && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_80px_-40px_rgba(6,25,56,0.65)] md:p-10"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--tenant-accent) 25%, transparent) 0%, transparent 55%), linear-gradient(135deg, var(--tenant-deep) 0%, var(--tenant-dark) 55%, var(--tenant-primary) 100%)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: "var(--tenant-accent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--tenant-primary)" }} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {manifest.brand.dashboard_logo_url ? (
              <img src={manifest.brand.dashboard_logo_url} alt="" className="h-12 w-12 rounded-xl bg-white/10 object-contain p-2 ring-1 ring-white/15" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Wallet className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/60">
                Welcome back
              </p>
              <h1
                className="mt-0.5 text-xl font-semibold md:text-2xl"
                style={{ fontFamily: theme.typography.heading }}
              >
                Hello, {session.customer.first_name} {session.customer.last_name}
              </h1>
              <div className="mt-1 text-xs text-white/60">
                Customer № <span className="font-mono text-white/85">{session.customer.customer_number}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-inset ring-white/15">
              {primaryAccount?.account_type ?? "Account"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {primaryAccount?.status ?? "Active"}
            </span>
          </div>
        </div>

        <div className="relative mt-10 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/60">
              Available Balance · {currency}
            </div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-4xl font-bold tracking-tight md:text-6xl" style={{ fontFamily: theme.typography.heading }}>
                {balanceVisible ? fmt(balance, currency) : "••••••"}
              </div>
              <button
                type="button"
                onClick={() => setBalanceVisible((v) => !v)}
                aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                className="mb-2 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
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

          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10 backdrop-blur">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/60">
              Account Number
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span
                className="truncate text-lg font-medium tracking-[0.18em] text-white/95 md:text-xl"
                style={{ fontFamily: theme.typography.heading }}
              >
                {acctMasked}
              </span>
              <button
                type="button"
                onClick={() => copyText(acctNumber, "Account number")}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/85 ring-1 ring-inset ring-white/15 transition hover:bg-white/20"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            {primaryAccount?.iban && (
              <div className="mt-3 text-[11px] uppercase tracking-widest text-white/50">
                IBAN
                <div className="mt-0.5 truncate font-mono text-xs text-white/80">{primaryAccount.iban}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <SectionHeading title="Quick actions" subtitle="Move money and manage your banking essentials" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((a) => (
            <Link
              key={a.title}
              to={a.to}
              params={{ slug }}
              className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)]"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition group-hover:scale-105"
                style={{
                  background:
                    a.tone === "primary"
                      ? "linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark))"
                      : "linear-gradient(135deg, #0f172a, #334155)",
                }}
              >
                <a.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                <div className="text-[11px] text-slate-500">{a.subtitle}</div>
              </div>
              <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
            </Link>
          ))}
        </div>
      </section>

      {/* Financial Overview: charts */}
      <section className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Balance trend</div>
              <div className="text-xs text-slate-500">Last 24 days · simulated</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <TrendingUp className="h-3 w-3" /> Trending
            </span>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--tenant-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--tenant-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number) => [fmt(v, currency), "Balance"]}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--tenant-primary)" strokeWidth={2.5} fill="url(#balArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Inflow vs outflow</div>
              <div className="text-xs text-slate-500">Last 6 months</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Net</div>
              <div className={`text-sm font-semibold ${flowTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {flowTotals.net >= 0 ? "+" : ""}
                {fmt(flowTotals.net, currency)}
              </div>
            </div>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number, name: string) => [fmt(v, currency), name === "inflow" ? "Inflow" : "Outflow"]}
                />
                <Bar dataKey="inflow" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="outflow" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Recent transactions + FX + notifications */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Recent transactions</div>
              <div className="text-xs text-slate-500">Latest activity across your accounts</div>
            </div>
            <Link to="/banks/$slug/portal/transactions" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
              <ListOrdered className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No transactions yet.</div>
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
                          isCredit ? "bg-emerald-50 text-emerald-600" : isDebit ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCredit ? <ArrowDownToLine className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{t.description || t.kind}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(t.created_at).toLocaleString()} · <span className="capitalize">{t.kind}</span>
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

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Exchange rates</div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Indicative</span>
            </div>
            <ul className="space-y-2.5">
              {FX_RATES.map((r) => {
                const up = r.change >= 0;
                return (
                  <li key={r.pair} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{r.pair}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-900">{r.rate.toFixed(3)}</span>
                      <span className={`text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
                        {up ? "▲" : "▼"} {Math.abs(r.change).toFixed(2)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Notifications</div>
              <Link to="/banks/$slug/portal/notifications" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                <Bell className="h-3.5 w-3.5" /> View all
              </Link>
            </div>
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">You have no notifications.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.slice(0, 3).map((n) => (
                  <li key={n.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium text-slate-800">{n.title}</div>
                      <span className="whitespace-nowrap text-[11px] text-slate-500">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Accounts */}
      <section>
        <SectionHeading
          title="Your accounts"
          subtitle="All accounts linked to your customer profile"
          right={
            <Link to="/banks/$slug/portal/accounts" params={{ slug }} className="text-xs font-medium text-slate-600 hover:text-slate-900">
              Manage accounts →
            </Link>
          }
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {session.accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              visible={balanceVisible}
              onCopy={() => copyText(a.account_number, "Account number")}
            />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <SectionHeading title="Frequently asked questions" subtitle="Answers to common banking questions" />
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="px-3">
                <AccordionTrigger className="text-left text-sm font-semibold text-slate-800 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-600">
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
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 md:text-sm">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function AccountCard({
  account,
  visible,
  onCopy,
}: {
  account: CustomerAccount;
  visible: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 text-white shadow-[0_18px_40px_-25px_rgba(6,25,56,0.55)] transition hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(135deg, var(--tenant-deep) 0%, var(--tenant-dark) 60%, var(--tenant-primary) 100%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-2xl" style={{ background: "var(--tenant-accent)" }} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            {account.account_type}
          </div>
          <div className="mt-0.5 text-sm font-medium text-white/90">{account.account_name}</div>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 ring-1 ring-inset ring-white/15">
          {account.currency}
        </span>
      </div>

      <div className="relative mt-6">
        <div className="text-[10px] uppercase tracking-widest text-white/60">Available</div>
        <div className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          {visible ? fmt(account.available_balance, account.currency) : "••••••"}
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs tracking-[0.2em] text-white/80">
          {formatAccountNumber(account.account_number)}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/85 ring-1 ring-inset ring-white/15 transition hover:bg-white/20"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
    </div>
  );
}
