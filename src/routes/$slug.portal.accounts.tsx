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
import { useT, useFormatCurrency } from "@/lib/i18n";

export const Route = createFileRoute("/$slug/portal/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const t = useT();
  const fmt = useFormatCurrency();
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primary = theme.colors.primary;
  const qc = useQueryClient();

  const TYPE_LABELS: Record<string, string> = {
    checking: t("accounts.current"),
    savings: t("accounts.current"),
    current: t("accounts.current"),
    business: t("accounts.type"),
    foreign_currency: t("accounts.currency"),
    corporate: t("accounts.type"),
    joint: t("accounts.type"),
    student: t("accounts.type"),
    fixed_deposit_acct: t("accounts.type"),
  };

  const accountProducts = enabledProductsByCategory(manifest, "accounts");
  const types = accountProducts
    .map((p) => ({ v: p.code, l: p.name || TYPE_LABELS[p.code] || p.code }))
    .filter((x) => x.l);
  const [type, setType] = useState(types[0]?.v ?? "savings");
  const [currency, setCurrency] = useState(manifest.bank.currency ?? "USD");
  const [nickname, setNickname] = useState("");
  const doOpen = useServerFn(openAdditionalAccount);
  const mut = useMutation({
    mutationFn: () =>
      doOpen({ data: { slug: bank.slug, account_type: type as "savings", currency, nickname: nickname || undefined } }),
    onSuccess: () => {
      toast.success(t("accounts.opened"));
      setNickname("");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : t("toast.failed")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: theme.typography.heading, color: primary }}>{t("accounts.title")}</h1>
        <p className="mt-1 text-sm opacity-80">{t("accounts.subtitle")}</p>
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
                <div className="text-xs uppercase opacity-70">{t("accounts.available")}</div>
                <div className="text-xl font-bold" style={{ color: primary }}>{fmt(a.available_balance, { currency: a.currency })}</div>
                <div className="text-xs opacity-70">{t("accounts.current")} {fmt(a.current_balance, { currency: a.currency })}</div>
                <div className="mt-2 flex gap-2">
                  <Link to="/$slug/portal/statements" params={{ slug: bank.slug }} className="text-xs underline" style={{ color: primary }}>{t("accounts.statement")}</Link>
                  <Link to="/$slug/portal/transactions" params={{ slug: bank.slug }} search={{}} className="text-xs underline" style={{ color: primary }}>{t("accounts.history")}</Link>
                </div>
              </div>
            </div>
          </BrandedCard>
        ))}
      </div>

      <BrandedCard manifest={manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>{t("accounts.open_new")}</div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>{t("accounts.type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{types.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("accounts.currency")}</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
          <div className="md:col-span-2"><Label>{t("accounts.nickname")}</Label><Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("accounts.nickname_placeholder")} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ backgroundColor: primary }}>
            {mut.isPending ? t("accounts.opening") : t("accounts.open")}
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
