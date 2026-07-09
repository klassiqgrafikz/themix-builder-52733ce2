import { createFileRoute, useMatch, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard, useRestrictions, isFeatureRestricted } from "@/lib/customer/portal-ui";
import { isNavEnabled, ProductUnavailable } from "@/lib/customer/product-gating";
import { lookupDomesticAccount, submitTransfer } from "@/lib/customer/transfers.functions";
import { listBeneficiaries } from "@/lib/customer/beneficiaries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Ban } from "lucide-react";

export const Route = createFileRoute("/banks/$slug/portal/transfer")({
  component: TransferGate,
});

function TransferGate() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  if (!isNavEnabled(parent.bank.manifest, "transfer")) {
    return <ProductUnavailable manifest={parent.bank.manifest} title="Transfers unavailable" />;
  }
  return <TransferPage />;
}

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

type Kind = "own" | "domestic" | "international";
type ApiKind = "own" | "internal" | "external";
const API_KIND: Record<Kind, ApiKind> = { own: "own", domestic: "internal", international: "external" };

function TransferPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const qc = useQueryClient();
  const restrictions = useRestrictions();
  const restricted = isFeatureRestricted(restrictions, "transfer");

  const [kind, setKind] = useState<Kind>("own");
  const [sourceId, setSourceId] = useState(session.accounts[0]?.id ?? "");
  const [destId, setDestId] = useState(session.accounts[1]?.id ?? "");
  const [beneficiaryId, setBeneficiaryId] = useState<string>("");
  const [name, setName] = useState("");
  const [accNum, setAccNum] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [saveBen, setSaveBen] = useState(false);

  // Domestic lookup state
  const [lookupState, setLookupState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "found"; account_name: string; customer_name: string; account_type: string }
    | { status: "not_found" }
  >({ status: "idle" });
  const doLookup = useServerFn(lookupDomesticAccount);

  useEffect(() => {
    if (kind !== "domestic" || beneficiaryId) return;
    const val = accNum.trim();
    if (val.length < 3) { setLookupState({ status: "idle" }); setName(""); return; }
    setLookupState({ status: "loading" });
    const t = setTimeout(async () => {
      try {
        const r = await doLookup({ data: { slug: bank.slug, account_number: val } });
        if (!r.found) { setLookupState({ status: "not_found" }); setName(""); return; }
        setLookupState({
          status: "found",
          account_name: r.account_name,
          customer_name: r.customer_name,
          account_type: r.account_type,
        });
        setName(r.customer_name || r.account_name);
      } catch {
        setLookupState({ status: "not_found" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [accNum, kind, beneficiaryId, bank.slug, doLookup]);

  // International fields
  const [intl, setIntl] = useState({
    beneficiary_address: "",
    bank_name: "",
    bank_address: "",
    iban: "",
    swift: "",
    routing: "",
    sort_code: "",
    transit: "",
    country: "",
    currency: session.accounts[0]?.currency ?? "USD",
    reason: "",
  });
  const setIntlField = <K extends keyof typeof intl>(k: K, v: (typeof intl)[K]) =>
    setIntl((p) => ({ ...p, [k]: v }));

  const doList = useServerFn(listBeneficiaries);
  const bensQ = useQuery({
    queryKey: ["beneficiaries", bank.slug],
    queryFn: () => doList({ data: { slug: bank.slug } }),
  });

  const doTransfer = useServerFn(submitTransfer);
  const mut = useMutation({
    mutationFn: () => {
      const apiKind = API_KIND[kind];
      const composedNarration =
        kind === "international"
          ? [
              narration || `International transfer to ${name || "beneficiary"}`,
              intl.beneficiary_address && `Beneficiary address: ${intl.beneficiary_address}`,
              intl.bank_address && `Bank address: ${intl.bank_address}`,
              intl.iban && `IBAN: ${intl.iban}`,
              intl.routing && `Routing: ${intl.routing}`,
              intl.sort_code && `Sort: ${intl.sort_code}`,
              intl.transit && `Transit: ${intl.transit}`,
              intl.country && `Country: ${intl.country}`,
              intl.reason && `Reason: ${intl.reason}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : narration || null;

      return doTransfer({
        data: {
          slug: bank.slug,
          kind: apiKind,
          source_account_id: sourceId,
          destination_account_id: kind === "own" ? destId || null : null,
          beneficiary_id: kind !== "own" && beneficiaryId ? beneficiaryId : null,
          beneficiary_name: kind !== "own" && !beneficiaryId ? name : null,
          beneficiary_account_number:
            kind === "domestic"
              ? accNum || null
              : kind === "international"
                ? intl.iban || accNum || null
                : null,
          beneficiary_bank_name:
            kind === "international" && !beneficiaryId ? intl.bank_name || null : null,
          beneficiary_bank_code:
            kind === "international" && !beneficiaryId ? intl.swift || null : null,
          amount: Number(amount),
          currency: kind === "international" ? intl.currency : undefined,
          narration: composedNarration,
          transfer_date: transferDate,
          reference: reference || null,
          save_beneficiary: saveBen,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`Transfer completed. New balance: ${fmt(r.new_balance, r.currency)}`);
      qc.invalidateQueries();
      window.location.href = `/banks/${bank.slug}/portal/transactions/${r.transaction_id}`;
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Transfer failed"),
  });

  const source = session.accounts.find((a) => a.id === sourceId);

  const canSubmit = useMemo(() => {
    if (restricted) return false;
    if (!sourceId || !amount || Number(amount) <= 0) return false;
    if (kind === "own" && !destId) return false;
    if (kind === "domestic" && !beneficiaryId) {
      if (lookupState.status !== "found") return false;
    }
    if (kind === "international" && !beneficiaryId) {
      if (!name || !intl.bank_name || !(intl.iban || accNum) || !intl.swift || !intl.country) return false;
    }
    return true;
  }, [restricted, sourceId, amount, kind, destId, beneficiaryId, lookupState.status, name, intl, accNum]);

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Transfer Center</h1>
        <p className="mt-1 text-sm opacity-70">
          Every transfer is validated and posted through the Core Banking Engine.
        </p>
      </BrandedCard>

      {restricted && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">Transfers are temporarily restricted by your bank.</div>
            <div className="opacity-80">Please contact support to resolve this restriction.</div>
          </div>
        </div>
      )}

      <BrandedCard manifest={bank.manifest} className={restricted ? "pointer-events-none opacity-60" : ""}>
        <div className="grid gap-4 md:grid-cols-3">
          {([
            { k: "own", label: "Own accounts", desc: "Move funds between your accounts." },
            { k: "domestic", label: "Domestic Transfer", desc: `Send within ${bank.manifest.bank.name}.` },
            { k: "international", label: "International Transfer", desc: "SWIFT / IBAN — send worldwide." },
          ] as { k: Kind; label: string; desc: string }[]).map((item) => (
            <button key={item.k} type="button" onClick={() => { setKind(item.k); setBeneficiaryId(""); setAccNum(""); setName(""); setLookupState({ status: "idle" }); }}
              className="rounded-xl border p-4 text-left transition"
              style={{
                borderColor: kind === item.k ? primary : `${primary}33`,
                backgroundColor: kind === item.k ? `${primary}12` : "transparent",
              }}>
              <div className="font-semibold" style={{ color: primary }}>{item.label}</div>
              <div className="mt-1 text-xs opacity-70">{item.desc}</div>
            </button>
          ))}
        </div>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest} className={restricted ? "pointer-events-none opacity-60" : ""}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>From account</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {session.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name} · {fmt(a.available_balance, a.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {source && (
              <div className="mt-1 text-xs opacity-70">
                Available {fmt(source.available_balance, source.currency)}
              </div>
            )}
          </div>

          {kind === "own" && (
            <div>
              <Label>To account</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {session.accounts
                    .filter((a) => a.id !== sourceId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind !== "own" && (
            <>
              <div className="md:col-span-2">
                <Label>Saved beneficiary</Label>
                <Select value={beneficiaryId || "__none"} onValueChange={(v) => { setBeneficiaryId(v === "__none" ? "" : v); setLookupState({ status: "idle" }); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a saved beneficiary (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Enter details manually —</SelectItem>
                    {(bensQ.data ?? [])
                      .filter((b) => (kind === "domestic" ? b.kind !== "external" : b.kind !== "internal"))
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.beneficiary_name} — {b.account_number}
                          {b.bank_name ? ` @ ${b.bank_name}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {!beneficiaryId && kind === "domestic" && (
                <>
                  <div className="md:col-span-2">
                    <Label>Recipient account number</Label>
                    <div className="relative">
                      <Input value={accNum} onChange={(e) => setAccNum(e.target.value)} placeholder="Enter account number at this bank" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {lookupState.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                        {lookupState.status === "found" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        {lookupState.status === "not_found" && <XCircle className="h-5 w-5 text-red-600" />}
                      </div>
                    </div>
                    {lookupState.status === "found" && (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <div className="font-medium">{lookupState.customer_name}</div>
                        <div className="text-xs opacity-80">{lookupState.account_name} · {lookupState.account_type}</div>
                      </div>
                    )}
                    {lookupState.status === "not_found" && accNum.length >= 3 && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Account number not found.
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Recipient name</Label>
                    <Input value={name} readOnly placeholder="Auto-filled from account lookup" />
                  </div>
                </>
              )}

              {!beneficiaryId && kind === "international" && (
                <>
                  <div>
                    <Label>Beneficiary name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Beneficiary address</Label>
                    <Input value={intl.beneficiary_address} onChange={(e) => setIntlField("beneficiary_address", e.target.value)} />
                  </div>
                  <div>
                    <Label>Bank name</Label>
                    <Input value={intl.bank_name} onChange={(e) => setIntlField("bank_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Bank address</Label>
                    <Input value={intl.bank_address} onChange={(e) => setIntlField("bank_address", e.target.value)} />
                  </div>
                  <div>
                    <Label>Account number</Label>
                    <Input value={accNum} onChange={(e) => setAccNum(e.target.value)} />
                  </div>
                  <div>
                    <Label>IBAN</Label>
                    <Input value={intl.iban} onChange={(e) => setIntlField("iban", e.target.value)} />
                  </div>
                  <div>
                    <Label>SWIFT / BIC</Label>
                    <Input value={intl.swift} onChange={(e) => setIntlField("swift", e.target.value)} />
                  </div>
                  <div>
                    <Label>Routing number</Label>
                    <Input value={intl.routing} onChange={(e) => setIntlField("routing", e.target.value)} />
                  </div>
                  <div>
                    <Label>Sort code</Label>
                    <Input value={intl.sort_code} onChange={(e) => setIntlField("sort_code", e.target.value)} />
                  </div>
                  <div>
                    <Label>Transit number</Label>
                    <Input value={intl.transit} onChange={(e) => setIntlField("transit", e.target.value)} />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={intl.country} onChange={(e) => setIntlField("country", e.target.value)} />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={intl.currency} onChange={(e) => setIntlField("currency", e.target.value.toUpperCase())} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Reason for transfer</Label>
                    <Input value={intl.reason} onChange={(e) => setIntlField("reason", e.target.value)} />
                  </div>
                </>
              )}

              {!beneficiaryId && (
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={saveBen} onChange={(e) => setSaveBen(e.target.checked)} />
                  Save this beneficiary for next time
                </label>
              )}
            </>
          )}

          <div>
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Transfer date</Label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Narration</Label>
            <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={400} />
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <Link to="/banks/$slug/portal" params={{ slug: bank.slug }} className="text-sm underline" style={{ color: primary }}>
            Cancel
          </Link>
          <Button
            disabled={mut.isPending || !canSubmit}
            onClick={() => mut.mutate()}
            style={{ backgroundColor: primary }}
          >
            {mut.isPending ? "Processing…" : "Submit transfer"}
          </Button>
        </div>
      </BrandedCard>
    </div>
  );
}
