import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { issueCard, listCards, updateCardLimits, updateCardStatus } from "@/lib/customer/cards.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Snowflake, RefreshCcw, Play } from "lucide-react";

export const Route = createFileRoute("/banks/$slug/portal/cards")({
  component: CardsPage,
});

function CardsPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const secondary = bank.manifest.theme.colors.secondary ?? primary;
  const qc = useQueryClient();
  const [openAccount, setOpenAccount] = useState(session.accounts[0]?.id ?? "");
  const [cardType, setCardType] = useState<"virtual" | "physical">("virtual");

  const doList = useServerFn(listCards);
  const doIssue = useServerFn(issueCard);
  const doStatus = useServerFn(updateCardStatus);
  const doLimits = useServerFn(updateCardLimits);

  const listQ = useQuery({ queryKey: ["cards", bank.slug], queryFn: () => doList({ data: { slug: bank.slug } }) });
  const issueMut = useMutation({
    mutationFn: () => doIssue({ data: { slug: bank.slug, account_id: openAccount, card_type: cardType } }),
    onSuccess: () => { toast.success("Card issued"); qc.invalidateQueries({ queryKey: ["cards", bank.slug] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; action: "freeze" | "unfreeze" | "replace" }) =>
      doStatus({ data: { slug: bank.slug, card_id: v.id, action: v.action } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["cards", bank.slug] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Cards</h1>
        <p className="mt-1 text-sm opacity-70">Manage your virtual and physical cards. Card payments run through the Core Banking Engine.</p>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Issue a new card</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Linked account</Label>
            <Select value={openAccount} onValueChange={setOpenAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {session.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={cardType} onValueChange={(v) => setCardType(v as "virtual" | "physical")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button disabled={issueMut.isPending || !openAccount} onClick={() => issueMut.mutate()} style={{ backgroundColor: primary }}>
              {issueMut.isPending ? "Issuing…" : "Issue card"}
            </Button>
          </div>
        </div>
      </BrandedCard>

      <div className="grid gap-4 md:grid-cols-2">
        {(listQ.data ?? []).map((c) => (
          <BrandedCard key={c.id} manifest={bank.manifest}>
            <div
              className="rounded-xl p-5 text-white"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-90">{c.brand.toUpperCase()} · {c.card_type}</span>
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="mt-6 font-mono text-lg tracking-widest">{c.masked_number}</div>
              <div className="mt-4 flex items-end justify-between text-xs">
                <div>
                  <div className="opacity-70">Card holder</div>
                  <div>{c.card_holder}</div>
                </div>
                <div>
                  <div className="opacity-70">Expires</div>
                  <div>{String(c.expiry_month).padStart(2, "0")}/{String(c.expiry_year).slice(-2)}</div>
                </div>
                <div>
                  <div className="opacity-70">Status</div>
                  <div className="capitalize">{c.status}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === "active" ? (
                <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: c.id, action: "freeze" })}>
                  <Snowflake className="mr-1 h-4 w-4" />Freeze
                </Button>
              ) : c.status === "frozen" ? (
                <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: c.id, action: "unfreeze" })}>
                  <Play className="mr-1 h-4 w-4" />Unfreeze
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: c.id, action: "replace" })}>
                <RefreshCcw className="mr-1 h-4 w-4" />Replace
              </Button>
            </div>
            <LimitEditor id={c.id} slug={bank.slug} daily={c.daily_limit} monthly={c.monthly_limit} onSave={doLimits} onSaved={() => qc.invalidateQueries({ queryKey: ["cards", bank.slug] })} />
          </BrandedCard>
        ))}
        {(listQ.data ?? []).length === 0 && (
          <BrandedCard manifest={bank.manifest}><p className="text-sm opacity-70">No cards yet.</p></BrandedCard>
        )}
      </div>
    </div>
  );
}

function LimitEditor({ id, slug, daily, monthly, onSave, onSaved }: {
  id: string; slug: string; daily: number; monthly: number;
  onSave: ReturnType<typeof useServerFn<typeof updateCardLimits>>;
  onSaved: () => void;
}) {
  const [d, setD] = useState(String(daily));
  const [m, setM] = useState(String(monthly));
  const mut = useMutation({
    mutationFn: () => onSave({ data: { slug, card_id: id, daily_limit: Number(d), monthly_limit: Number(m) } }),
    onSuccess: () => { toast.success("Limits updated"); onSaved(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      <div><Label className="text-xs">Daily limit</Label><Input type="number" value={d} onChange={(e) => setD(e.target.value)} /></div>
      <div><Label className="text-xs">Monthly limit</Label><Input type="number" value={m} onChange={(e) => setM(e.target.value)} /></div>
      <div className="flex items-end"><Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>Save limits</Button></div>
    </div>
  );
}
