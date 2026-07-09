import { createFileRoute, useMatch, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { submitTransfer } from "@/lib/customer/transfers.functions";
import { listBeneficiaries } from "@/lib/customer/beneficiaries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/banks/$slug/portal/transfer")({
  component: TransferPage,
});

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

type Kind = "own" | "internal" | "external";

function TransferPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("own");
  const [sourceId, setSourceId] = useState(session.accounts[0]?.id ?? "");
  const [destId, setDestId] = useState(session.accounts[1]?.id ?? "");
  const [beneficiaryId, setBeneficiaryId] = useState<string>("");
  const [name, setName] = useState("");
  const [accNum, setAccNum] = useState("");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [saveBen, setSaveBen] = useState(false);

  const doList = useServerFn(listBeneficiaries);
  const bensQ = useQuery({
    queryKey: ["beneficiaries", bank.slug],
    queryFn: () => doList({ data: { slug: bank.slug } }),
  });

  const doTransfer = useServerFn(submitTransfer);
  const mut = useMutation({
    mutationFn: () =>
      doTransfer({
        data: {
          slug: bank.slug,
          kind,
          source_account_id: sourceId,
          destination_account_id: kind !== "external" ? destId || null : null,
          beneficiary_id: kind !== "own" && beneficiaryId ? beneficiaryId : null,
          beneficiary_name: kind !== "own" && !beneficiaryId ? name : null,
          beneficiary_account_number: kind !== "own" && !beneficiaryId ? accNum : null,
          beneficiary_bank_name: kind === "external" && !beneficiaryId ? bankName : null,
          amount: Number(amount),
          narration: narration || null,
          transfer_date: transferDate,
          reference: reference || null,
          save_beneficiary: saveBen,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Transfer completed. New balance: ${fmt(r.new_balance, r.currency)}`);
      qc.invalidateQueries();
      window.location.href = `/banks/${bank.slug}/portal/transactions/${r.transaction_id}`;
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Transfer failed"),
  });

  const source = session.accounts.find((a) => a.id === sourceId);

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Transfer Center</h1>
        <p className="mt-1 text-sm opacity-70">
          Every transfer is validated and posted through the Core Banking Engine.
        </p>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="grid gap-4 md:grid-cols-3">
          {(["own", "internal", "external"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className="rounded-xl border p-4 text-left transition"
              style={{
                borderColor: kind === k ? primary : `${primary}33`,
                backgroundColor: kind === k ? `${primary}12` : "transparent",
              }}>
              <div className="font-semibold capitalize" style={{ color: primary }}>{k.replace("_", " ")} transfer</div>
              <div className="mt-1 text-xs opacity-70">
                {k === "own" ? "Move funds between your accounts."
                  : k === "internal" ? `Send within ${bank.manifest.bank.name}.`
                  : "Send to another bank (simulation)."}
              </div>
            </button>
          ))}
        </div>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
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
                <Select value={beneficiaryId || "__none"} onValueChange={(v) => setBeneficiaryId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Choose a saved beneficiary (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Enter details manually —</SelectItem>
                    {(bensQ.data ?? [])
                      .filter((b) => (kind === "internal" ? b.kind !== "external" : b.kind !== "internal"))
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.beneficiary_name} — {b.account_number}
                          {b.bank_name ? ` @ ${b.bank_name}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {!beneficiaryId && (
                <>
                  <div>
                    <Label>Beneficiary name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Account number</Label>
                    <Input value={accNum} onChange={(e) => setAccNum(e.target.value)} />
                  </div>
                  {kind === "external" && (
                    <div className="md:col-span-2">
                      <Label>Beneficiary bank</Label>
                      <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm md:col-span-2">
                    <input type="checkbox" checked={saveBen} onChange={(e) => setSaveBen(e.target.checked)} />
                    Save this beneficiary for next time
                  </label>
                </>
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
            disabled={mut.isPending || !sourceId || !amount || Number(amount) <= 0}
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
