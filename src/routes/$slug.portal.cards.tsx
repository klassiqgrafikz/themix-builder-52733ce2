import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { isNavEnabled, ProductUnavailable } from "@/lib/customer/product-gating";
import {
  issueCard,
  listCards,
  updateCardStatus,
  type CustomerCard,
} from "@/lib/customer/cards.functions";
import { BankCard, CardOptionsSheet } from "@/components/customer/bank-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet } from "lucide-react";

export const Route = createFileRoute("/$slug/portal/cards")({
  component: CardsGate,
});

function CardsGate() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  if (!isNavEnabled(parent.bank.manifest, "cards")) {
    return <ProductUnavailable manifest={parent.bank.manifest} title="Cards unavailable" />;
  }
  return <CardsPage />;
}

/* ---------- main page ---------- */

function CardsPage() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const primary = manifest.theme.colors.primary;
  const qc = useQueryClient();

  const [openAccount, setOpenAccount] = useState(session.accounts[0]?.id ?? "");
  const [cardType, setCardType] = useState<"virtual" | "physical">("virtual");
  const [brand, setBrand] = useState<"visa" | "mastercard">("visa");
  const [activeCard, setActiveCard] = useState<CustomerCard | null>(null);
  const [showIssue, setShowIssue] = useState(false);

  const doList = useServerFn(listCards);
  const doIssue = useServerFn(issueCard);
  const doStatus = useServerFn(updateCardStatus);

  const listQ = useQuery({
    queryKey: ["cards", bank.slug],
    queryFn: () => doList({ data: { slug: bank.slug } }),
  });

  const visibleCards = useMemo(
    () => (listQ.data ?? []).filter((c) => c.status !== "replaced" && c.status !== "expired"),
    [listQ.data],
  );

  const issueMut = useMutation({
    mutationFn: () =>
      doIssue({ data: { slug: bank.slug, account_id: openAccount, card_type: cardType, brand } }),
    onSuccess: () => {
      toast.success("Card issued");
      setShowIssue(false);
      qc.invalidateQueries({ queryKey: ["cards", bank.slug] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; action: "freeze" | "unfreeze" | "replace" }) =>
      doStatus({ data: { slug: bank.slug, card_id: v.id, action: v.action } }),
    onSuccess: (_d, v) => {
      toast.success(
        v.action === "freeze"
          ? "Card frozen"
          : v.action === "unfreeze"
            ? "Card unfrozen"
            : "New card issued",
      );
      qc.invalidateQueries({ queryKey: ["cards", bank.slug] });
      if (v.action === "replace") setActiveCard(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Keep the sheet card in sync with the refreshed list (e.g. after freeze).
  useEffect(() => {
    if (!activeCard) return;
    const fresh = (listQ.data ?? []).find((c) => c.id === activeCard.id);
    if (fresh && fresh !== activeCard) setActiveCard(fresh);
  }, [listQ.data, activeCard]);

  return (
    <div className="space-y-6">
      <BrandedCard manifest={manifest}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: primary }}>
              Your cards
            </h1>
            <p className="mt-1 text-sm opacity-70">
              Tap the card to see more options.
            </p>
          </div>
          <Button
            onClick={() => setShowIssue((s) => !s)}
            style={{ backgroundColor: primary }}
            className="text-white"
          >
            <Plus className="mr-1 h-4 w-4" />
            New card
          </Button>
        </div>

        {showIssue && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 animate-fade-in md:grid-cols-4">
            <div>
              <Label>Linked account</Label>
              <Select value={openAccount} onValueChange={setOpenAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {session.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={cardType} onValueChange={(v) => setCardType(v as "virtual" | "physical")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="physical">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Network</Label>
              <Select value={brand} onValueChange={(v) => setBrand(v as "visa" | "mastercard")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                disabled={issueMut.isPending || !openAccount}
                onClick={() => issueMut.mutate()}
                style={{ backgroundColor: primary }}
                className="w-full text-white"
              >
                {issueMut.isPending ? "Issuing…" : "Issue"}
              </Button>
            </div>
          </div>
        )}
      </BrandedCard>

      {listQ.isLoading ? (
        <BrandedCard manifest={manifest}>
          <p className="text-sm opacity-70">Loading cards…</p>
        </BrandedCard>
      ) : visibleCards.length === 0 ? (
        <BrandedCard manifest={manifest}>
          <div className="py-8 text-center">
            <Wallet className="mx-auto h-8 w-8 opacity-40" />
            <p className="mt-3 text-sm opacity-70">
              You have no cards yet. Tap “New card” to issue your first one.
            </p>
          </div>
        </BrandedCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visibleCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCard(c)}
              className="group text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none"
            >
              <BankCard
                card={c}
                manifest={manifest}
                revealed={false}
              />
              <p className="mt-2 text-center text-xs opacity-60">
                Tap the card to see more options
              </p>
            </button>
          ))}
        </div>
      )}

      <CardOptionsSheet
        card={activeCard}
        manifest={manifest}
        onClose={() => setActiveCard(null)}
        onFreeze={(id) => statusMut.mutate({ id, action: "freeze" })}
        onUnfreeze={(id) => statusMut.mutate({ id, action: "unfreeze" })}
        onReplace={(id) => statusMut.mutate({ id, action: "replace" })}
        pending={statusMut.isPending}
      />
    </div>
  );
}
