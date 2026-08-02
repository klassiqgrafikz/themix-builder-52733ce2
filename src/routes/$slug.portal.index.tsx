import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { defaultDashboardLayout, type DashboardComponentKind, type DashboardLayout, type WidthSize } from "@/lib/dashboard-layout/types";
import type { CustomerAccount, CustomerSession } from "@/lib/customer/types";
import { isNavEnabled, isDashboardKindEnabled } from "@/lib/customer/product-gating";
import {
  customerListRestrictions,
  customerListTransactions,
} from "@/lib/customer/activity.functions";
import { listBeneficiaries } from "@/lib/customer/beneficiaries.functions";
import {
  listCards,
  updateCardStatus,
  type CustomerCard,
} from "@/lib/customer/cards.functions";
import { submitTransfer } from "@/lib/customer/transfers.functions";
import { BankCard, CardOptionsSheet } from "@/components/customer/bank-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  ListOrdered,
  MessageCircle,
  ReceiptText,
  ScanLine,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
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

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function AccountCarousel({
  accounts,
  currency,
  balanceVisible,
  theme,
}: {
  accounts: CustomerAccount[];
  currency: string;
  balanceVisible: boolean;
  theme: WebsiteManifest["theme"];
}) {
  const total = accounts.reduce((s, a) => s + Number(a.available_balance ?? 0), 0);
  return (
    <section>
      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className="flex min-w-[230px] flex-none flex-col justify-between rounded-2xl p-5 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark, var(--tenant-primary)))` }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Total balance</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: theme.typography.heading }}>
              {balanceVisible ? fmt(total, currency) : "••••••"}
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs opacity-90">
            <Landmark className="h-4 w-4" /> All accounts
          </div>
        </div>
        {accounts.map((a) => (
          <div
            key={a.id}
            className="flex min-w-[230px] flex-none flex-col justify-between rounded-2xl p-5 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in oklab, var(--tenant-primary) 60%, var(--tenant-accent, var(--tenant-primary))) 100%)` }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">{a.account_type}</p>
              <p className="mt-1 truncate text-sm font-semibold">{a.account_name}</p>
              <p className="mt-0.5 font-mono text-xs opacity-80">{formatAccountNumber(a.account_number ?? "")}</p>
            </div>
            <p className="mt-6 text-xl font-bold" style={{ fontFamily: theme.typography.heading }}>
              {balanceVisible ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PromoCard({ manifest, slug }: { manifest: WebsiteManifest; slug: string }) {
  return (
    <section className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">Remote deposits</h2>
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl text-white" style={{ background: "var(--tenant-primary)" }}>
            <ScanLine className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Deposit checks in seconds with your phone camera — no branch visit needed. Funds are typically available the next business day.
        </p>
      </div>
      <Link
        to="/$slug/portal/accounts"
        params={{ slug }}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: "var(--tenant-primary)" }}
      >
        Learn more <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function TransfersWidget({
  accounts,
  slug,
  currency,
  onDone,
}: {
  accounts: CustomerAccount[];
  slug: string;
  currency: string;
  onDone: () => void;
}) {
  const usable = accounts.filter((a) => a.status === "active");
  const [from, setFrom] = useState(usable[0]?.id ?? "");
  const [to, setTo] = useState(usable[1]?.id ?? usable[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const doTransfer = useServerFn(submitTransfer);
  const mut = useMutation({
    mutationFn: () =>
      doTransfer({
        data: {
          slug,
          kind: "own",
          source_account_id: from,
          destination_account_id: to,
          amount: Number(amount),
          currency,
          narration: "Quick transfer",
        },
      }),
    onSuccess: () => {
      toast.success("Transfer completed");
      setAmount("");
      onDone();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Transfer failed"),
  });
  const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200";
  const labelCls = "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 md:text-lg">Transfers</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className={labelCls}>From</label>
          <select className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)}>
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} · {a.account_number.slice(-4)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>To</label>
          <select className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)}>
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} · {a.account_number.slice(-4)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={`${fieldCls} font-mono`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !from || !to || from === to || !Number(amount)}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ background: "var(--tenant-primary)" }}
        >
          <Send className="h-4 w-4" /> {mut.isPending ? "Sending…" : "Send"}
        </button>
      </div>
    </section>
  );
}

function AccountAccordions({
  accounts,
  cards,
  currency,
  balanceVisible,
  group,
  showRouting,
  onCardClick,
  theme,
}: {
  accounts: CustomerAccount[];
  cards: Card[];
  currency: string;
  balanceVisible: boolean;
  group: string;
  showRouting: boolean;
  onCardClick: (c: CustomerCard) => void;
  theme: WebsiteManifest["theme"];
}) {
  const groups = new Map<string, CustomerAccount[]>();
  accounts.forEach((a) => {
    const key = a.account_type || "Accounts";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  });

  const accountItems = [...groups.entries()].map(([type, list]) => (
    <AccordionItem key={type} value={type} className="border-b">
      <AccordionTrigger className="py-4 text-left text-sm font-semibold text-slate-800 hover:no-underline">
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.account_name}</p>
                  <p className="font-mono text-xs text-slate-500">•••• {a.account_number.slice(-4)}</p>
                  {showRouting && a.routing_number && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Routing {a.routing_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {balanceVisible ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Current {balanceVisible ? fmt(a.current_balance ?? 0, a.currency ?? currency) : "••••••"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  ));

  const cardsItem = (
    <AccordionItem value="__cards" className="border-b">
      <AccordionTrigger className="py-4 text-left text-sm font-semibold text-slate-800 hover:no-underline">
        Credit Cards
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        {cards.length === 0 ? (
          <p className="text-xs text-slate-500">No cards yet.</p>
        ) : (
          cards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCardClick(c)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm transition hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-white" style={{ background: "var(--tenant-primary)" }}>
                  <CreditCard className="h-4 w-4" />
                </span>
                <span className="truncate font-mono text-slate-700">{c.masked_number || "•••• ••••"}</span>
              </span>
              <span className="ml-3 flex flex-none items-center gap-2 text-xs capitalize text-slate-500">
                {c.card_type} <ChevronRight className="h-4 w-4 text-slate-300" />
              </span>
            </button>
          ))
        )}
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <section>
      <Accordion type="single" collapsible className="w-full">
        {group !== "cards" ? accountItems : null}
        {group !== "accounts" ? cardsItem : null}
      </Accordion>
    </section>
  );
}

function SearchBarSection({ placeholder }: { placeholder: string }) {
  return (
    <section className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
    </section>
  );
}

function SummaryDropdown({
  accounts,
  currency,
  balanceVisible,
  bankName,
  theme,
}: {
  accounts: CustomerAccount[];
  currency: string;
  balanceVisible: boolean;
  bankName: string;
  theme: WebsiteManifest["theme"];
}) {
  const [open, setOpen] = useState(false);
  const total = accounts.reduce((s, a) => s + Number(a.available_balance ?? 0), 0);
  return (
    <section
      className="overflow-hidden rounded-2xl text-white shadow-lg"
      style={{ background: "linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark, var(--tenant-primary)))" }}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">Accounts summary</p>
          <p className="truncate text-base font-semibold" style={{ fontFamily: theme.typography.heading }}>
            {bankName}
          </p>
        </div>
        <div className="flex flex-none items-center gap-3">
          <p className="text-lg font-bold">{balanceVisible ? fmt(total, currency) : "••••••"}</p>
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-white/15 px-5 py-3">
          {accounts.length === 0 ? (
            <p className="py-2 text-xs opacity-80">No accounts yet.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.account_name}</span>
                  <span className="font-mono text-xs opacity-70">•••• {a.account_number.slice(-4)}</span>
                </span>
                <span className="flex-none font-mono font-semibold">
                  {balanceVisible ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function TransactionsTable({
  transactions,
  currency,
  slug,
  searchable,
  compact,
}: {
  transactions: Tx[];
  currency: string;
  slug: string;
  searchable?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const rows = transactions.filter((t) => {
    if (!q) return true;
    const hay = `${t.description ?? ""} ${t.kind} ${t.amount}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">Recent transactions</h2>
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-36 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-44"
              />
            </div>
          )}
          {searchable && (
            <button
              type="button"
              aria-label="Filter options"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
          <Link to="/$slug/portal/transactions" params={{ slug }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
            <ListOrdered className="h-3.5 w-3.5" /> View all
          </Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No transactions yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className={`w-full text-left text-sm ${compact ? "min-w-[360px]" : "min-w-[560px]"}`}>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                {!compact && <th className="px-4 py-2.5 font-semibold">Type</th>}
                {!compact && <th className="px-4 py-2.5 text-right font-semibold">Amount</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 8).map((t) => {
                const isCredit = t.direction === "credit";
                const isDebit = t.direction === "debit";
                return (
                  <tr key={t.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        to="/$slug/portal/transactions/$id"
                        params={{ slug, id: t.id }}
                        search={{ success: false }}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {t.description || t.kind}
                      </Link>
                    </td>
                    {!compact && <td className="px-4 py-3 text-xs capitalize text-slate-500">{t.kind}</td>}
                    {!compact && (
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold" style={{ color: isCredit ? "#16a34a" : isDebit ? "#dc2626" : undefined }}>
                        {isDebit ? "-" : isCredit ? "+" : ""}{fmt(t.amount, t.currency)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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

type FxRow = { pair: string; rate: number; change: number };

const FALLBACK_RATES: FxRow[] = [
  { pair: "USD → EUR", rate: 0.9215, change: -0.15 },
  { pair: "USD → GBP", rate: 0.7931, change: 0.22 },
  { pair: "USD → JPY", rate: 149.48, change: 0.08 },
  { pair: "USD → CAD", rate: 1.3627, change: -0.11 },
];

async function fetchFxRates(): Promise<{ rows: FxRow[]; updatedAt: string }> {
  try {
    const symbols = "EUR,GBP,JPY,CAD";
    const [latestRes, histRes] = await Promise.all([
      fetch(`https://api.frankfurter.app/latest?from=USD&to=${symbols}`, { signal: AbortSignal.timeout(5000) }),
      fetch(
        `https://api.frankfurter.app/${new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)}?from=USD&to=${symbols}`,
        { signal: AbortSignal.timeout(5000) },
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
  } catch {
    return { rows: FALLBACK_RATES, updatedAt: new Date().toISOString() };
  }
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

  const acctNumber = primaryAccount?.account_number ?? "";
  const acctMasked = acctNumber ? formatAccountNumber(acctNumber) : "—";

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const layout = ((manifest as unknown as { dashboard_layout?: DashboardLayout }).dashboard_layout) ?? defaultDashboardLayout();

  return (
    <LayoutDrivenDashboard
      layout={layout}
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
type Card = CustomerCard;

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
  const [deckIndex, setDeckIndex] = useState(0);
  const [deckCard, setDeckCard] = useState<CustomerCard | null>(null);

  const doCardStatus = useServerFn(updateCardStatus);
  const qc = useQueryClient();
  const statusMut = useMutation({
    mutationFn: (v: { id: string; action: "freeze" | "unfreeze" | "replace" | "delete" }) =>
      doCardStatus({ data: { slug, card_id: v.id, action: v.action } }),
    onSuccess: (_d, v) => {
      toast.success(
        v.action === "freeze"
          ? "Card frozen"
          : v.action === "unfreeze"
            ? "Card unfrozen"
            : v.action === "replace"
              ? "New card issued"
              : "Card deleted",
      );
      qc.invalidateQueries({ queryKey: ["portal-cards", slug] });
      if (v.action === "replace" || v.action === "delete") setDeckCard(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Keep the sheet card in sync with the refreshed list (e.g. after freeze).
  useEffect(() => {
    if (!deckCard) return;
    const fresh = cards.find((c) => c.id === deckCard.id);
    if (fresh && fresh !== deckCard) setDeckCard(fresh);
  }, [cards, deckCard]);

  const readStr = (p: DashboardLayout["items"][number]["props"], k: string, fb: string): string => {
    const v = p?.[k]; return typeof v === "string" ? v : fb;
  };
  const readNum = (p: DashboardLayout["items"][number]["props"], k: string, fb: number): number => {
    const v = p?.[k]; return typeof v === "number" ? v : fb;
  };
  const readBool = (p: DashboardLayout["items"][number]["props"], k: string, fb: boolean): boolean => {
    const v = p?.[k]; return typeof v === "boolean" ? v : fb;
  };

  function renderKind(kind: DashboardComponentKind, p: DashboardLayout["items"][number]["props"]) {
    switch (kind) {
      case "header": {
        const style = readStr(p, "style", "welcome");
        const align = ({ left: "text-left", center: "text-center", right: "text-right" } as Record<string, string>)[readStr(p, "alignment", "left")] || "text-left";
        if (style === "bar") {
          const initials = `${session.customer.first_name?.[0] ?? ""}${session.customer.last_name?.[0] ?? ""}`;
          const total = session.accounts.reduce((s, a) => s + Number(a.available_balance ?? 0), 0);
          return (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: "var(--tenant-primary)" }}>{initials}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {session.customer.first_name} {session.customer.last_name}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Verified</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Total balance</span>
                <span className="rounded-lg px-2.5 py-1 font-mono text-sm font-bold text-white" style={{ background: "var(--tenant-primary)" }}>
                  {balanceVisible ? fmt(total, currency) : "••••••"}
                </span>
              </div>
            </section>
          );
        }
        if (style === "minimal") {
          return (
            <section className={align}>
              <p className={labelText}>Customer</p>
              <p className="mt-1 font-mono text-lg text-slate-800">
                {session.customer.first_name} {session.customer.last_name}
              </p>
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
              </div>
            </section>
          );
        }
        if (style === "rewards") {
          const initials = `${session.customer.first_name?.[0] ?? ""}${session.customer.last_name?.[0] ?? ""}`;
          return (
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 flex-none place-items-center rounded-full text-lg font-bold text-white" style={{ background: "var(--tenant-primary)" }}>{initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {session.customer.first_name} {session.customer.last_name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{session.customer.email}</p>
                </div>
              </div>
              <Link
                to="/$slug/portal/accounts"
                params={{ slug }}
                className="inline-flex flex-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--tenant-primary)" }}
              >
                <Star className="h-4 w-4" /> Preferred rewards summary
              </Link>
            </section>
          );
        }
        return (
          <section className={align}>
            <p className={labelText}>Welcome back</p>
            <h1 className="mt-0.5 text-xl font-semibold text-slate-900 md:text-2xl" style={{ fontFamily: theme.typography.heading }}>
              {session.customer.first_name} {session.customer.last_name}
            </h1>
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
        if (style === "solid") {
          const acct = primaryAccount ?? session.accounts[0];
          return (
            <section className="rounded-2xl p-6 text-white" style={{ background: "var(--tenant-primary)" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] opacity-80">
                  {acct?.account_type ?? "Checking"}
                </p>
                <button type="button" onClick={() => setBalanceVisible((v) => !v)} className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                  {balanceVisible ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ fontFamily: theme.typography.heading }}>{balanceEl}</p>
              <p className="mt-1 text-xs opacity-80">Available balance</p>
            </section>
          );
        }
        if (style === "dropdown") {
          return (
            <SummaryDropdown
              accounts={session.accounts}
              currency={currency}
              balanceVisible={balanceVisible}
              bankName={manifest.bank.name}
              theme={theme}
            />
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
        if (style === "list") {
          const accts = session.accounts;
          return (
            <section className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <span>Accounts</span>
                <span>Balance</span>
              </div>
              {accts.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">No accounts yet.</p>
              ) : (
                accts.map((a, idx) => (
                  <div key={a.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t" : ""}`} style={idx > 0 ? dividerColor : undefined}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-8 w-8 flex-none place-items-center rounded-lg text-white"
                        style={idx === 0 ? { background: "var(--tenant-primary)" } : { background: "var(--tenant-dark, #cbd5e1)" }}
                      >
                        <Landmark className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{a.account_name}</p>
                        <p className="font-mono text-xs text-slate-500">{formatAccountNumber(a.account_number ?? "")}</p>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <p className="whitespace-nowrap font-mono text-sm font-semibold text-slate-900">
                        {balanceVisible ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                      </p>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                ))
              )}
            </section>
          );
        }
        if (style === "boxes") {
          const accts = session.accounts;
          return (
            <section className="grid gap-3 sm:grid-cols-2">
              {accts.length === 0 ? (
                <p className="text-xs text-slate-500">No accounts yet.</p>
              ) : (
                accts.map((a) => (
                  <div key={a.id} className="rounded-xl border p-4" style={dividerColor}>
                    <p className={labelText}>{a.account_name}</p>
                    <p className="mt-1 font-mono text-sm text-slate-500">{formatAccountNumber(a.account_number ?? "")}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900" style={{ fontFamily: theme.typography.heading }}>
                      {balanceVisible ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                    </p>
                  </div>
                ))
              )}
            </section>
          );
        }
        if (style === "card_stack") {
          const accts = session.accounts;
          const idx = Math.min(deckIndex, Math.max(accts.length - 1, 0));
          const a = accts[idx];
          const cardVariant = readStr(p, "card_variant", "classic") === "wave" ? ("wave" as const) : undefined;
          const holderName = `${session.customer.first_name} ${session.customer.last_name}`.trim().toUpperCase() || "CARD HOLDER";
          const usableCards = cards.filter(
            (c) => c.status !== "replaced" && c.status !== "expired" && c.status !== "deleted",
          );
          const crd =
            usableCards.find((c) => c.account_id === a?.id) ?? usableCards[0] ?? null;
          const expiry =
            crd?.expiry_month && crd?.expiry_year
              ? `${String(crd.expiry_month).padStart(2, "0")}/${String(crd.expiry_year).slice(-2)}`
              : "••/••";
          return (
            <section className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-1.5">
                {accts.map((acct, i) => (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => setDeckIndex(i)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${i === idx ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    style={i === idx ? { background: "var(--tenant-primary)" } : undefined}
                  >
                    {acct.account_name ?? `Account ${i + 1}`}
                  </button>
                ))}
              </div>
              {crd ? (
                <div className="w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => setDeckCard(crd)}
                    className="group w-full text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none"
                  >
                    <BankCard card={crd} manifest={manifest} revealed={false} variant={cardVariant} />
                  </button>
                  <p className="mt-2 text-center text-xs opacity-60">
                    Tap the card to reveal details or manage it
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-xl border px-4 py-3 text-sm" style={dividerColor}>
                    <span className="font-mono text-slate-500">{formatAccountNumber(a?.account_number ?? "")}</span>
                    <button
                      type="button"
                      onClick={() => setBalanceVisible((v) => !v)}
                      className="font-mono font-semibold text-slate-900 hover:opacity-80"
                    >
                      {balanceVisible && a ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full max-w-sm overflow-hidden rounded-2xl text-white shadow-xl"
                  style={{ background: "linear-gradient(135deg, var(--tenant-primary), var(--tenant-dark, var(--tenant-primary)))" }}
                >
                  <div className="flex items-center justify-between p-5">
                    <span className="text-sm font-semibold tracking-wide opacity-90">{manifest.bank.name}</span>
                    <CreditCard className="h-5 w-5 opacity-80" />
                  </div>
                  <div className="px-5 pb-5">
                    <div className="h-8 w-11 rounded-md" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }} />
                    <div className="mt-4 font-mono text-lg tracking-[0.18em]">{a ? formatAccountNumber(a.account_number ?? "") : "—"}</div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest opacity-70">Card holder</p>
                        <p className="truncate text-xs font-semibold">{holderName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-70">Expires</p>
                        <p className="text-xs font-semibold">{expiry}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest opacity-70">Balance</p>
                        <button type="button" onClick={() => setBalanceVisible((v) => !v)} className="text-base font-bold hover:opacity-80">
                          {balanceVisible && a ? fmt(a.available_balance ?? 0, a.currency ?? currency) : "••••••"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!crd && (
                <p className="text-xs text-slate-500">
                  No card on this account yet.{" "}
                  <Link to="/$slug/portal/cards" params={{ slug }} className="font-medium underline">
                    Issue a card
                  </Link>
                </p>
              )}
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
        type QA = { icon: typeof Send; title: string; to: "/$slug/portal/transfer" | "/$slug/portal/accounts" | "/$slug/portal/beneficiaries" | "/$slug/portal/statements" | "/$slug/portal/cards" | "/$slug/portal/support" };
        const raw: (QA | null)[] = [
          isNavEnabled(enabled, "transfer") ? { icon: Send, title: "Send", to: "/$slug/portal/transfer" } : null,
          { icon: ArrowDownToLine, title: "Deposit", to: "/$slug/portal/accounts" },
          isNavEnabled(enabled, "transfer") ? { icon: ReceiptText, title: "Pay a bill", to: "/$slug/portal/transfer" } : null,
          isNavEnabled(enabled, "beneficiaries") ? { icon: Users, title: "Pay a person", to: "/$slug/portal/beneficiaries" } : null,
          isNavEnabled(enabled, "support") ? { icon: MessageCircle, title: "Message", to: "/$slug/portal/support" } : null,
          isNavEnabled(enabled, "statements") ? { icon: FileText, title: "eStatements", to: "/$slug/portal/statements" } : null,
          isNavEnabled(enabled, "cards") ? { icon: CreditCard, title: "Cards", to: "/$slug/portal/cards" } : null,
        ];
        const items: QA[] = raw.filter((x): x is QA => x !== null);
        const colClass = ({ 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" } as Record<number, string>)[columns] ?? "grid-cols-2 sm:grid-cols-3";
        const wrap = orientation === "horizontal" ? "flex flex-wrap gap-3" : `grid gap-4 ${colClass}`;
        if (orientation === "pills") {
          return (
            <section>
              <div className="flex flex-wrap gap-3">
                {items.map((a) => (
                  <Link
                    key={a.title}
                    to={a.to}
                    params={{ slug }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    <a.icon className="h-4 w-4" /> {a.title}
                  </Link>
                ))}
              </div>
            </section>
          );
        }
        if (orientation === "squares") {
          return (
            <section className="flex flex-wrap justify-center gap-5">
              {items.map((a) => (
                <Link key={a.title} to={a.to} params={{ slug }} className="flex w-[104px] flex-col items-center gap-2 text-center">
                  <span
                    className="grid h-14 w-14 place-items-center rounded-xl text-white shadow-md transition hover:-translate-y-0.5"
                    style={{ background: "var(--tenant-primary)" }}
                  >
                    <a.icon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{a.title}</span>
                </Link>
              ))}
            </section>
          );
        }
        if (orientation === "circle") {
          return (
            <section>
              <div className="flex flex-wrap justify-center gap-6">
                {items.map((a) => (
                  <Link key={a.title} to={a.to} params={{ slug }} className="flex flex-col items-center gap-2">
                    <span
                      className="grid h-14 w-14 place-items-center rounded-full border-2 bg-white transition hover:bg-slate-50"
                      style={{ borderColor: "color-mix(in oklab, var(--tenant-primary) 35%, transparent)", color: "var(--tenant-primary)" }}
                    >
                      <a.icon className="h-6 w-6" />
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{a.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        }
        if (orientation === "tiles") {
          return (
            <section>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Quick actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {items.map((a) => (
                  <Link
                    key={a.title}
                    to={a.to}
                    params={{ slug }}
                    className="group flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md"
                    style={dividerColor}
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: "var(--tenant-primary)" }}>
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{a.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        }
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
      case "recent_transactions": {
        const tStyle = readStr(p, "style", "list");
        const searchable = readBool(p, "searchable", false);
        const relative = readBool(p, "relative_time", false);
        const compact = readStr(p, "variant", "standard") === "compact";
        if (tStyle === "table") {
          return (
            <TransactionsTable
              transactions={transactions}
              currency={currency}
              slug={slug}
              searchable={searchable}
              compact={compact}
            />
          );
        }
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
                        search={{ success: false }}
                        className="flex items-center justify-between gap-3 py-3 text-sm transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${isCredit ? "bg-emerald-50 text-emerald-600" : isDebit ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                            {isCredit ? <ArrowDownToLine className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{t.description || t.kind}</div>
                            <div className="text-xs text-slate-500">{relative ? relTime(t.created_at) : new Date(t.created_at).toLocaleString()} · <span className="capitalize">{t.kind}</span></div>
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
      }
      case "account_carousel":
        return (
          <AccountCarousel
            accounts={session.accounts}
            currency={currency}
            balanceVisible={balanceVisible}
            theme={theme}
          />
        );
      case "promo_card":
        return <PromoCard manifest={manifest} slug={slug} />;
      case "transfers_widget":
        return (
          <TransfersWidget
            accounts={session.accounts}
            slug={slug}
            currency={currency}
            onDone={() => qc.invalidateQueries({ queryKey: ["portal-tx", slug] })}
          />
        );
      case "account_accordions":
        return (
          <AccountAccordions
            accounts={session.accounts}
            cards={cards}
            currency={currency}
            balanceVisible={balanceVisible}
            group={readStr(p, "group", "accounts")}
            showRouting={readBool(p, "show_routing", false)}
            onCardClick={setDeckCard}
            theme={theme}
          />
        );
      case "search_bar":
        return <SearchBarSection placeholder={readStr(p, "placeholder", "Search")} />;
      case "tabs": {
        const accountLabel = readStr(p, "account_label", "Accounts");
        const cardsLabel = readStr(p, "cards_label", "Cards");
        const tabbed = layout.items.filter(
          (it) => it.visible !== false && !!it.tab && isDashboardKindEnabled(manifest, it.kind),
        );
        const renderPane = (tab: string) => (
          <div className="space-y-6">
            {tabbed
              .filter((it) => it.tab === tab)
              .map((it) => (
                <div key={it.id}>{renderKind(it.kind, it.props)}</div>
              ))}
          </div>
        );
        return (
          <section>
            <Tabs defaultValue="accounts">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="accounts">{accountLabel}</TabsTrigger>
                <TabsTrigger value="cards">{cardsLabel}</TabsTrigger>
              </TabsList>
              <TabsContent value="accounts" className="mt-4">{renderPane("accounts")}</TabsContent>
              <TabsContent value="cards" className="mt-4">{renderPane("cards")}</TabsContent>
            </Tabs>
          </section>
        );
      }
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
      <div className="space-y-6">
        {(() => {
          const visible = layout.items
            .filter((it) => it.visible !== false)
            .filter((it) => isDashboardKindEnabled(manifest, it.kind))
            .filter((it) => !it.tab);
          const withCols = visible.filter((it) => it.column);
          const flat = visible.filter((it) => !it.column);
          const stacks: Record<"left" | "right", typeof withCols> = { left: [], right: [] };
          withCols.forEach((it) => stacks[it.column ?? "left"].push(it));
          return (
            <>
              {flat.length > 0 && (
                <div className="grid grid-cols-12 gap-4 sm:gap-6">
                  {flat.map((it) => {
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
              )}
              {(stacks.left.length > 0 || stacks.right.length > 0) && (
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  {(["left", "right"] as const).map((col) => (
                    <div key={col} className="space-y-6">
                      {stacks[col].map((it) => {
                        const kind = it.kind as DashboardComponentKind;
                        const node = renderKind(kind, it.props);
                        if (!node) return null;
                        return <div key={it.id}>{node}</div>;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      <CardOptionsSheet
        card={deckCard}
        manifest={manifest}
        onClose={() => setDeckCard(null)}
        onFreeze={(id) => statusMut.mutate({ id, action: "freeze" })}
        onUnfreeze={(id) => statusMut.mutate({ id, action: "unfreeze" })}
        onReplace={(id) => statusMut.mutate({ id, action: "replace" })}
        onDelete={(id) => statusMut.mutate({ id, action: "delete" })}
        pending={statusMut.isPending}
      />
    </div>
  );
}


