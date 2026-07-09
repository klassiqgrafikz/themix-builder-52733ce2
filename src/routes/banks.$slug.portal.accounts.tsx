import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerAccount, CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { openAdditionalAccount } from "@/lib/customer/accounts.functions";
import { enabledProductsByCategory } from "@/lib/customer/product-gating";
import {
  countryFieldsToDisplay,
  COUNTRY_FIELD_LABEL,
  type CountryAccountFields,
} from "@/lib/customer/country-formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/banks/$slug/portal/accounts")({
  component: AccountsPage,
});

function fmt(v: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v); }
  catch { return `${currency} ${v.toFixed(2)}`; }
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
  foreign_currency: "Foreign currency",
  corporate: "Corporate",
  joint: "Joint",
  student: "Student",
  fixed_deposit_acct: "Fixed deposit",
};

function AccountsPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primary = theme.colors.primary;
  const qc = useQueryClient();
  const [type, setType] = useState("savings");
  const [currency, setCurrency] = useState(manifest.bank.currency ?? "USD");
  const [nickname, setNickname] = useState("");
  const doOpen = useServerFn(openAdditionalAccount);
  const mut = useMutation({
    mutationFn: () =>
      doOpen({ data: { slug: bank.slug, account_type: type as "savings", currency, nickname: nickname || undefined } }),
    onSuccess: () => {
      toast.success("New account opened");
      setNickname("");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: theme.typography.heading, color: primary }}>Accounts</h1>
        <p className="mt-1 text-sm opacity-80">You can open multiple accounts across products and currencies.</p>
      </div>

      <div className="space-y-3">
        {session.accounts.map((a) => (
          <BrandedCard key={a.id} manifest={manifest}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold" style={{ color: primary }}>{a.account_name}</div>
                <div className="mt-1 text-xs opacity-70">#{a.account_number} · {a.account_type} · {a.status}</div>
                <CountryIdentifierList account={a} country={manifest.bank.country_code ?? ""} />
              </div>
              <div className="text-right">
                <div className="text-xs uppercase opacity-70">Available</div>
                <div className="text-xl font-bold" style={{ color: primary }}>{fmt(a.available_balance, a.currency)}</div>
                <div className="text-xs opacity-70">Current {fmt(a.current_balance, a.currency)}</div>
                <div className="mt-2 flex gap-2">
                  <Link to="/banks/$slug/portal/statements" params={{ slug: bank.slug }} className="text-xs underline" style={{ color: primary }}>Statement</Link>
                  <Link to="/banks/$slug/portal/transactions" params={{ slug: bank.slug }} search={{}} className="text-xs underline" style={{ color: primary }}>History</Link>
                </div>
              </div>
            </div>
          </BrandedCard>
        ))}
      </div>

      <BrandedCard manifest={manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Open a new account</div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
          <div className="md:col-span-2"><Label>Nickname</Label><Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Rainy day savings" /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ backgroundColor: primary }}>
            {mut.isPending ? "Opening…" : "Open account"}
          </Button>
        </div>
      </BrandedCard>
    </div>
  );
}

function CountryIdentifierList({
  account,
  country,
}: {
  account: CustomerAccount;
  country: string;
}) {
  const fields = countryFieldsToDisplay(country).filter((k) => k !== "account_number");
  const rows = fields
    .map((k) => ({ key: k, value: (account as unknown as CountryAccountFields)[k] }))
    .filter((r) => typeof r.value === "string" && r.value.length > 0) as {
    key: keyof CountryAccountFields;
    value: string;
  }[];
  if (!rows.length) return null;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs opacity-80">
      {rows.map((r) => (
        <div key={r.key} className="contents">
          <dt className="uppercase tracking-wide opacity-70">{COUNTRY_FIELD_LABEL[r.key]}</dt>
          <dd className="font-mono">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
