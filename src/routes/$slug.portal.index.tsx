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
import { defaultDashboardLayout, type DashboardComponentKind, type DashboardLayout, type WidthSize } from "@/lib/dashboard-layout/types";
import type { CustomerSession, CustomerAccount } from "@/lib/customer/types";
import { isNavEnabled } from "@/lib/customer/product-gating";
import {
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

export const Route = createFileRoute("/$slug/portal/")({
  component: DashboardPage,
});

function useParentData() {
  return useMatch({ from: "/$slug/portal" }).loaderData as {
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
  transactions: { created_at: string; balance_after: number }[],
  currentBalance: number,
): { label: string; balance: number }[] {
  // Real history: transactions come sorted desc; walk oldest → newest.
  const asc = [...transactions].reverse();
  const points = asc
    .filter((t) => Number.isFinite(t.balance_after))
    .map((t) => ({
      label: new Date(t.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      balance: Math.round(Number(t.balance_after)),
    }));
  // Add a "today" point so the trend line always reaches the current balance.
  points.push({
    label: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    balance: Math.round(currentBalance),
  });
  return points;
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
  return months;
}

type FxRow = { pair: string; rate: number; change: number };

async function fetchFxRates(): Promise<{ rows: FxRow[]; updatedAt: string }> {
  const symbols = "EUR,GBP,JPY,CAD";
  const [latestRes, histRes] = await Promise.all([
    fetch(`https://api.frankfurter.app/latest?from=USD&to=${symbols}`),
    fetch(
      `https://api.frankfurter.app/${new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)}?from=USD&to=${symbols}`,
    ),
  ]);
  if (!latestRes.ok) throw new Error("Failed to fetch rates");
  const latest = (await latestRes.json()) as { rates: Record<string, number>; date: string };
  const hist = histRes.ok
    ? ((await histRes.json()) as { rates: Record<string, number> })
    : { rates: {} };
  const rows: FxRow[] = (["EUR", "GBP", "JPY", "CAD"] as const).map((sym) => {
    const rate = latest.rates?.[sym] ?? 0;
    const prev = hist.rates?.[sym] ?? rate;
    const change = prev ? ((rate - prev) / prev) * 100 : 0;
    return { pair: `USD → ${sym}`, rate, change };
  });
  return { rows, updatedAt: new Date().toISOString() };
}


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
  const restrFn = useServerFn(customerListRestrictions);
  const benFn = useServerFn(listBeneficiaries);
  const cardsFn = useServerFn(listCards);

  const txQ = useQuery({
    queryKey: ["portal-tx", slug],
    queryFn: () => txFn({ data: { slug } }),
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
  const fxQ = useQuery({
    queryKey: ["portal-fx"],
    queryFn: fetchFxRates,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const transactions = txQ.data ?? [];
  const restrictions = restrQ.data ?? [];
  const beneficiaries = benQ.data ?? [];
  const cards = cardsQ.data ?? [];
  const fxRates = fxQ.data?.rows ?? [];
  const fxUpdatedAt = fxQ.data?.updatedAt;

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
          to: "/$slug/portal/transfer" as const,
        }
      : null,
    {
      icon: ArrowDownToLine,
      title: "Receive",
      subtitle: "Incoming funds",
      to: "/$slug/portal/accounts" as const,
    },
    beneficiariesEnabled
      ? {
          icon: Banknote,
          title: "Withdraw",
          subtitle: "Cash or transfer",
          to: "/$slug/portal/beneficiaries" as const,
        }
      : null,
    statementsEnabled
      ? {
          icon: FileText,
          title: "Statements",
          subtitle: "Download PDF",
          to: "/$slug/portal/statements" as const,
        }
      : null,
    cardsEnabled
      ? {
          icon: CreditCard,
          title: "Cards",
          subtitle: "Manage cards",
          to: "/$slug/portal/cards" as const,
        }
      : null,
    beneficiariesEnabled
      ? {
          icon: Users,
          title: "Beneficiaries",
          subtitle: "Saved recipients",
          to: "/$slug/portal/beneficiaries" as const,
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

  // Layout-driven rendering (Phase 3): if the bank publishes a dashboard
  // layout via the Designer, render sections in that order/width/visibility.
  // Otherwise fall through to the existing default dashboard below.
  const publishedLayout = (manifest as unknown as { dashboard_layout?: DashboardLayout })
    .dashboard_layout;
  if (publishedLayout && Array.isArray(publishedLayout.items) && publishedLayout.items.length) {
    return (
      <LayoutDrivenDashboard
        layout={publishedLayout}
        slug={slug}
        currency={currency}
        balance={balance}
        balanceVisible={balanceVisible}
        setBalanceVisible={setBalanceVisible}
        session={session}
        manifest={manifest}
        acctNumber={acctNumber}
        acctMasked={acctMasked}
        transactions={transactions}
        trend={trend}
        fxRates={fxRates}
        fxLoading={fxQ.isLoading}
        fxError={fxQ.isError}
        fxUpdatedAt={fxUpdatedAt}
        cards={cards}
        beneficiaries={beneficiaries}
        restrictions={restrictions}
        onCopy={copyText}
      />
    );
  }

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

        {dashboardStyle === "premium_card" ? (
          <PremiumCardSummary
            currency={currency}
            balance={balance}
            balanceVisible={balanceVisible}
            setBalanceVisible={setBalanceVisible}
            acctNumber={acctNumber}
            acctMasked={acctMasked}
            onCopy={copyText}
            fontHeading={theme.typography.heading}
          />
        ) : (
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
        )}
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
              <p className="text-xs text-slate-500">
                {trend.length <= 1
                  ? "Not enough transaction history yet"
                  : `Based on ${trend.length - 1} recent transaction${trend.length - 1 === 1 ? "" : "s"}`}
              </p>
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
              to="/$slug/portal/transactions"
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
                  <li key={t.id}>
                    <Link
                      to="/$slug/portal/transactions/$id"
                      params={{ slug, id: t.id }}
                      className="flex items-center justify-between gap-3 py-3 text-sm transition hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                    >
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
                    </Link>
                  </li>
                );
              })}
            </ul>

          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Exchange rates</h2>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {fxQ.isLoading
                ? "Updating…"
                : fxUpdatedAt
                  ? `Updated ${new Date(fxUpdatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Live"}
            </span>
          </div>
          {fxQ.isError ? (
            <p className="py-2 text-xs text-slate-500">Rates temporarily unavailable.</p>
          ) : (
            <ul className="space-y-3">
              {(fxRates.length ? fxRates : [{ pair: "USD → EUR", rate: 0, change: 0 }, { pair: "USD → GBP", rate: 0, change: 0 }, { pair: "USD → JPY", rate: 0, change: 0 }, { pair: "USD → CAD", rate: 0, change: 0 }]).map((r) => {
                const up = r.change >= 0;
                return (
                  <li
                    key={r.pair}
                    className="flex items-center justify-between text-sm py-1 border-b"
                    style={dividerColor}
                  >
                    <span className="font-medium text-slate-700">{r.pair}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-900">
                        {r.rate ? (r.rate < 10 ? r.rate.toFixed(4) : r.rate.toFixed(2)) : "—"}
                      </span>
                      {r.rate > 0 && (
                        <span
                          className={`text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {up ? "▲" : "▼"} {Math.abs(r.change).toFixed(2)}%
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
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
              to="/$slug/portal/accounts"
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

/* ------------------------------------------------------------------ */
/*  Layout-driven dashboard renderer (Phase 3)                         */
/*  Consumes manifest.dashboard_layout published by the Designer.      */
/* ------------------------------------------------------------------ */

const WIDTH_SPAN: Record<WidthSize, string> = {
  full: "col-span-12",
  half: "col-span-12 md:col-span-6",
  third: "col-span-12 md:col-span-4",
};

type Restr = { id: string; types: string[]; reason: string | null; end_at: string | null };
type Tx = { id: string; created_at: string; balance_after: number; amount: number; currency: string; direction: string; kind: string; description: string | null };
type Bene = { id: string; name?: string; account_number?: string; nickname?: string | null };
type Card = { id: string; masked_number?: string | null; card_type?: string | null };

function LayoutDrivenDashboard(props: {
  layout: DashboardLayout;
  slug: string;
  currency: string;
  balance: number;
  balanceVisible: boolean;
  setBalanceVisible: (fn: (v: boolean) => boolean) => void;
  session: CustomerSession;
  manifest: WebsiteManifest;
  acctNumber: string;
  acctMasked: string;
  transactions: Tx[];
  trend: { label: string; balance: number }[];
  fxRates: FxRow[];
  fxLoading: boolean;
  fxError: boolean;
  fxUpdatedAt: string | undefined;
  cards: Card[];
  beneficiaries: Bene[];
  restrictions: Restr[];
  onCopy: (v: string, label: string) => void | Promise<void>;
}) {
  const { layout, slug, currency, balance, balanceVisible, setBalanceVisible, session, manifest,
          acctNumber, acctMasked, transactions, trend, fxRates, fxLoading, fxError, fxUpdatedAt,
          cards, beneficiaries, restrictions, onCopy } = props;
  const theme = manifest.theme;
  const primaryAccount = session.accounts[0];
  const dividerColor = { borderColor: "color-mix(in oklab, var(--tenant-primary) 55%, transparent)" };
  const labelText = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";

  const readStr = (p: DashboardLayout["items"][number]["props"], k: string, fb: string): string => {
    const v = p?.[k]; return typeof v === "string" ? v : fb;
  };
  const readNum = (p: DashboardLayout["items"][number]["props"], k: string, fb: number): number => {
    const v = p?.[k]; return typeof v === "number" ? v : fb;
  };

  function renderKind(kind: DashboardComponentKind, p: DashboardLayout["items"][number]["props"]) {
    switch (kind) {
      case "header": {
        const style = readStr(p, "style", "welcome");
        const align = ({ left: "text-left", center: "text-center", right: "text-right" } as Record<string, string>)[readStr(p, "alignment", "left")] || "text-left";
        if (style === "minimal") {
          return (
            <section className={align}>
              <p className={labelText}>Customer</p>
              <p className="mt-1 font-mono text-lg text-slate-800">{session.customer.customer_number}</p>
            </section>
          );
        }
        if (style === "photo") {
          const initials = `${session.customer.first_name?.[0] ?? ""}${session.customer.last_name?.[0] ?? ""}`;
          return (
            <section className={`flex items-center gap-4 ${align}`}>
              <div className="grid h-12 w-12 place-items-center rounded-full text-white text-lg font-bold" style={{ background: "var(--tenant-primary)" }}>{initials}</div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: theme.typography.heading }}>
                  {session.customer.first_name} {session.customer.last_name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Verified</span>
                <div className="text-xs text-slate-500 mt-0.5">Member since {new Date(session.customer.created_at ?? Date.now()).getFullYear()}</div>
              </div>
            </section>
          );
        }
        return (
          <section className={align}>
            <p className={labelText}>Welcome back</p>
            <h1 className="mt-0.5 text-xl font-semibold text-slate-900 md:text-2xl" style={{ fontFamily: theme.typography.heading }}>
              {session.customer.first_name} {session.customer.last_name}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Customer № <span className="font-mono text-slate-700">{session.customer.customer_number}</span>
            </p>
          </section>
        );
      }
      case "account_summary": {
        const style = readStr(p, "style", "minimal");
        const thick = readNum(p, "divider_thickness", 2);
        const balanceEl = balanceVisible ? fmt(balance, currency) : "••••••";
        if (style === "compact") {
          return (
            <section className="flex items-center justify-between rounded-xl border p-4" style={dividerColor}>
              <div>
                <p className={labelText}>Available balance</p>
                <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: theme.typography.heading }}>{balanceEl}</p>
              </div>
              <div className="font-mono text-sm text-slate-500">{acctMasked}</div>
            </section>
          );
        }
        if (style === "modern") {
          return (
            <section className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary, var(--tenant-primary)))" }}>
              <p className="text-xs opacity-80">Available balance</p>
              <p className="mt-1 text-3xl font-bold" style={{ fontFamily: theme.typography.heading }}>{balanceEl}</p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs opacity-90">
                <span>{acctMasked}</span>
                <button onClick={() => setBalanceVisible((v) => !v)} className="rounded bg-white/20 px-2 py-1">
                  {balanceVisible ? "Hide" : "Show"}
                </button>
              </div>
            </section>
          );
        }
        if (style === "executive") {
          return (
            <section className="rounded-2xl border p-6" style={{ ...dividerColor, borderWidth: 1 }}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Executive Account</div>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900" style={{ fontFamily: theme.typography.heading }}>{balanceEl}</p>
              <div className="my-4 h-px" style={{ background: "var(--tenant-primary)" }} />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-slate-500 text-xs">Account</div><div className="font-mono">{acctMasked}</div></div>
                <div><div className="text-slate-500 text-xs">Holder</div><div>{session.customer.first_name} {session.customer.last_name}</div></div>
              </div>
            </section>
          );
        }
        // minimal (divider-based)
        return (
          <section>
            <div className="py-6 border-b-2" style={{ ...dividerColor, borderBottomWidth: thick }}>
              <p className={labelText}>Account Number</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="truncate text-lg font-medium tracking-[0.12em] text-slate-900 md:text-xl" style={{ fontFamily: theme.typography.heading }}>{acctMasked}</p>
                <button type="button" onClick={() => onCopy(acctNumber, "Account number")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
            <div className="py-6 border-b-2" style={{ ...dividerColor, borderBottomWidth: thick }}>
              <p className={labelText}>Available Balance · {currency}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl" style={{ fontFamily: theme.typography.heading }}>{balanceEl}</p>
                <button type="button" onClick={() => setBalanceVisible((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
                  {balanceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {balanceVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </section>
        );
      }
      case "quick_actions": {
        const columns = readNum(p, "columns", 3);
        const orientation = readStr(p, "orientation", "grid");
        const enabled = manifest;
        type QA = { icon: typeof Send; title: string; to: "/$slug/portal/transfer" | "/$slug/portal/accounts" | "/$slug/portal/beneficiaries" | "/$slug/portal/statements" | "/$slug/portal/cards" };
        const raw: (QA | null)[] = [
          isNavEnabled(enabled, "transfer") ? { icon: Send, title: "Send", to: "/$slug/portal/transfer" } : null,
          { icon: ArrowDownToLine, title: "Receive", to: "/$slug/portal/accounts" },
          isNavEnabled(enabled, "beneficiaries") ? { icon: Banknote, title: "Withdraw", to: "/$slug/portal/beneficiaries" } : null,
          isNavEnabled(enabled, "statements") ? { icon: FileText, title: "Statements", to: "/$slug/portal/statements" } : null,
          isNavEnabled(enabled, "cards") ? { icon: CreditCard, title: "Cards", to: "/$slug/portal/cards" } : null,
          isNavEnabled(enabled, "beneficiaries") ? { icon: Users, title: "Beneficiaries", to: "/$slug/portal/beneficiaries" } : null,
        ];
        const items: QA[] = raw.filter((x): x is QA => x !== null);
        const colClass = ({ 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" } as Record<number, string>)[columns] ?? "grid-cols-2 sm:grid-cols-3";
        const wrap = orientation === "horizontal" ? "flex flex-wrap gap-3" : `grid gap-4 ${colClass}`;
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Quick actions</h2>
            <div className={`mt-4 ${wrap}`}>
              {items.map((a) => (
                <Link key={a.title} to={a.to} params={{ slug }} className="group flex items-center gap-3 rounded-xl border p-3 transition hover:bg-slate-50" style={dividerColor}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "var(--tenant-primary)" }}>
                    <a.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{a.title}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      }
      case "balance_trend": {
        const chartSize = readStr(p, "chart_size", "medium");
        const h = chartSize === "large" ? "h-72" : chartSize === "small" ? "h-40" : "h-56";
        return (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 md:text-lg">Balance trend</h2>
                <p className="text-xs text-slate-500">{trend.length <= 1 ? "Not enough transaction history yet" : `Based on ${trend.length - 1} recent transactions`}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"><TrendingUp className="h-3 w-3" /> Live</span>
            </div>
            <div className={`mt-3 ${h}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`balArea-${Math.random().toString(36).slice(2, 6)}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--tenant-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--tenant-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={48} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number) => [fmt(v, currency), "Balance"]} />
                  <Area type="monotone" dataKey="balance" stroke="var(--tenant-primary)" strokeWidth={2.5} fill="var(--tenant-primary)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      }
      case "exchange_rates":
        return (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Exchange rates</h2>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {fxLoading ? "Updating…" : fxUpdatedAt ? `Updated ${new Date(fxUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Live"}
              </span>
            </div>
            {fxError ? (
              <p className="mt-3 text-xs text-slate-500">Rates temporarily unavailable.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {fxRates.map((r) => (
                  <li key={r.pair} className="flex items-center justify-between border-b py-1 text-sm" style={dividerColor}>
                    <span className="font-medium text-slate-700">{r.pair}</span>
                    <span className="font-mono text-slate-900">{r.rate ? (r.rate < 10 ? r.rate.toFixed(4) : r.rate.toFixed(2)) : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case "recent_transactions":
        return (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Recent transactions</h2>
              <Link to="/$slug/portal/transactions" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                <ListOrdered className="h-3.5 w-3.5" /> View all
              </Link>
            </div>
            {transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No transactions yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {transactions.slice(0, 6).map((t) => {
                  const isCredit = t.direction === "credit"; const isDebit = t.direction === "debit";
                  return (
                    <li key={t.id}>
                      <Link
                        to="/$slug/portal/transactions/$id"
                        params={{ slug, id: t.id }}
                        className="flex items-center justify-between gap-3 py-3 text-sm transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${isCredit ? "bg-emerald-50 text-emerald-600" : isDebit ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                            {isCredit ? <ArrowDownToLine className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{t.description || t.kind}</div>
                            <div className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString()} · <span className="capitalize">{t.kind}</span></div>
                          </div>
                        </div>
                        <div className="ml-3 whitespace-nowrap font-mono text-sm font-semibold" style={{ color: isCredit ? "#16a34a" : isDebit ? "#dc2626" : undefined }}>
                          {isDebit ? "-" : isCredit ? "+" : ""}{fmt(t.amount, t.currency)}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      case "cards":
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Cards</h2>
            <div className="mt-3 space-y-2">
              {cards.length === 0 ? <p className="text-xs text-slate-500">No cards yet.</p> : cards.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={dividerColor}>
                  <span className="font-mono">{c.masked_number || "•••• ••••"}</span>
                  <span className="text-xs text-slate-500">{c.card_type || "Card"}</span>
                </div>
              ))}
            </div>
          </section>
        );
      case "beneficiaries":
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Beneficiaries</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {beneficiaries.length === 0 ? <p className="text-xs text-slate-500">No saved beneficiaries.</p> : beneficiaries.slice(0, 6).map((b) => (
                <div key={b.id} className="flex flex-col items-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: "var(--tenant-primary)" }}>{(b.name || b.nickname || "?").slice(0, 2).toUpperCase()}</div>
                  <div className="mt-1 truncate max-w-[80px] text-slate-600">{b.name || b.nickname}</div>
                </div>
              ))}
            </div>
          </section>
        );
      case "notifications":
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Notifications</h2>
            <p className="mt-2 text-xs text-slate-500">Open the bell icon in the header for the full list.</p>
          </section>
        );
      case "faq":
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Frequently asked questions</h2>
            <div className="mt-3">
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={dividerColor}>
                    <AccordionTrigger className="text-left text-sm font-semibold text-slate-800 hover:no-underline py-4">{f.q}</AccordionTrigger>
                    <AccordionContent className="pb-4 text-sm leading-relaxed text-slate-600">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        );
      case "support":
        return (
          <section>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">Support</h2>
            <Link to="/$slug/portal/support" params={{ slug }} className="mt-2 inline-block text-xs font-medium text-slate-600 hover:text-slate-900">
              Contact support →
            </Link>
          </section>
        );
      default:
        return null;
    }
  }

  void primaryAccount; // reserved for future kinds

  return (
    <div className="space-y-8">
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
      <div className="grid grid-cols-12 gap-6">
        {layout.items
          .filter((it) => it.visible !== false)
          .map((it) => {
            const width = (it.width ?? "full") as WidthSize;
            const kind = it.kind as DashboardComponentKind;
            const node = renderKind(kind, it.props);
            if (!node) return null;
            return (
              <div key={it.id} className={WIDTH_SPAN[width]}>
                {node}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// Silence unused import if defaultDashboardLayout is imported but not referenced yet.
void defaultDashboardLayout;

