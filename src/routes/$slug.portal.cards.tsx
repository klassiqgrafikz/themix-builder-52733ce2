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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCcw,
  Snowflake,
  Play,
  Wallet,
} from "lucide-react";

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

/* ---------- helpers: deterministic full number & CVV from card id ---------- */

function hashDigits(seed: string, count: number): string {
  // Simple deterministic digit sequence (simulation only — not a real PAN).
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out += ((h >>> 8) % 10).toString();
  }
  return out;
}

function fullPan(card: CustomerCard): string {
  const bin =
    card.brand === "mastercard" ? "5300" : card.brand === "amex" ? "3782" : "4539";
  const middle = hashDigits(card.id, 8);
  return `${bin} ${middle.slice(0, 4)} ${middle.slice(4, 8)} ${card.last4}`;
}
function fullCvv(card: CustomerCard): string {
  return hashDigits(card.id + ":cvv", 3);
}

/* ---------- brand logos ---------- */

function VisaLogo({ className = "h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" className={className} aria-label="Visa">
      <text
        x="0"
        y="13"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="16"
        letterSpacing="1"
        fill="#ffffff"
      >
        VISA
      </text>
    </svg>
  );
}
function MastercardLogo({ className = "h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-label="Mastercard">
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="25" cy="12" r="9" fill="#F79E1B" />
      <path
        d="M20 5.4A9 9 0 0 1 20 18.6 9 9 0 0 1 20 5.4Z"
        fill="#FF5F00"
      />
    </svg>
  );
}
function BrandMark({ brand, className }: { brand: string; className?: string }) {
  if (brand === "mastercard") return <MastercardLogo className={className} />;
  return <VisaLogo className={className} />;
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

/* ---------- card visual with flip animation ---------- */

function BankCard({
  card,
  manifest,
  revealed,
}: {
  card: CustomerCard;
  manifest: WebsiteManifest;
  revealed: boolean;
}) {
  const primary = manifest.theme.colors.primary;
  const secondary = manifest.theme.colors.secondary ?? primary;
  const logo = manifest.brand.dashboard_logo_url;
  const frozen = card.status === "frozen";

  const displayNumber = revealed ? fullPan(card) : card.masked_number;
  const displayCvv = revealed ? fullCvv(card) : "•••";
  const expiry = `${String(card.expiry_month).padStart(2, "0")}/${String(card.expiry_year).slice(-2)}`;

  return (
    <div
      className="relative aspect-[1.586/1] w-full [perspective:1200px]"
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-xl [backface-visibility:hidden]"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, color-mix(in oklab, ${secondary} 70%, black) 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/5" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2">
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="h-8 w-8 rounded-md bg-white/95 object-contain p-1"
                />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-md bg-white/20">
                  <CreditCard className="h-4 w-4" />
                </div>
              )}
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                {manifest.bank.name}
              </div>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
              {card.card_type === "physical" ? "Debit" : "Virtual"}
            </div>
          </div>

          <div className="relative">
            <div className="font-mono text-lg tracking-[0.18em] md:text-xl">
              {displayNumber}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-widest opacity-70">Card holder</div>
                <div className="text-xs font-semibold uppercase tracking-wide">
                  {card.card_holder}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest opacity-70">Valid thru</div>
                <div className="font-mono text-xs">{expiry}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest opacity-70">CVV</div>
                <div className="font-mono text-xs">{displayCvv}</div>
              </div>
              <BrandMark brand={card.brand} className="h-6" />
            </div>
          </div>

          {frozen && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/55 backdrop-blur-sm animate-fade-in">
              <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-800">
                <Snowflake className="h-4 w-4 text-sky-500" /> Card frozen
              </div>
            </div>
          )}
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl text-white shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${secondary} 80%, black) 0%, ${primary} 100%)`,
          }}
        >
          <div className="mt-6 h-10 w-full bg-slate-900/70" />
          <div className="p-5">
            <div className="text-[10px] uppercase tracking-widest opacity-80">Card number</div>
            <div className="mt-1 font-mono text-base tracking-[0.18em] md:text-lg">
              {displayNumber}
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-widest opacity-70">Valid thru</div>
                <div className="font-mono text-sm">{expiry}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest opacity-70">CVV</div>
                <div className="rounded bg-white/95 px-2 py-0.5 font-mono text-sm text-slate-900">
                  {displayCvv}
                </div>
              </div>
              <BrandMark brand={card.brand} className="h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- bottom sheet with options ---------- */

function CardOptionsSheet({
  card,
  manifest,
  onClose,
  onFreeze,
  onUnfreeze,
  onReplace,
  pending,
}: {
  card: CustomerCard | null;
  manifest: WebsiteManifest;
  onClose: () => void;
  onFreeze: (id: string) => void;
  onUnfreeze: (id: string) => void;
  onReplace: (id: string) => void;
  pending: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Auto-hide reveal after ~30s.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), 30_000);
    return () => clearTimeout(t);
  }, [revealed]);

  // Reset state when sheet closes / different card opens.
  useEffect(() => {
    if (!card) {
      setRevealed(false);
      setConfirmReveal(false);
      setConfirmReplace(false);
    }
  }, [card]);

  // If the card is frozen, hide sensitive info immediately.
  useEffect(() => {
    if (card?.status === "frozen") setRevealed(false);
  }, [card?.status]);

  const frozen = card?.status === "frozen";

  const copy = async (v: string, label: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <>
      <Sheet open={!!card} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-0">
          {card && (
            <div className="p-5">
              <SheetHeader className="mb-4 text-left">
                <SheetTitle>Card options</SheetTitle>
                <SheetDescription>
                  {frozen
                    ? "This card is frozen. Unfreeze to use or reveal details."
                    : "Reveal card details or manage this card."}
                </SheetDescription>
              </SheetHeader>

              <div className="mx-auto mb-5 max-w-sm">
                <BankCard card={card} manifest={manifest} revealed={revealed && !frozen} />
              </div>

              <div className="grid gap-2">
                <ActionRow
                  icon={revealed ? EyeOff : Eye}
                  label={revealed ? "Hide card details" : "Reveal card details"}
                  disabled={frozen}
                  onClick={() => {
                    if (revealed) setRevealed(false);
                    else setConfirmReveal(true);
                  }}
                />
                <ActionRow
                  icon={Copy}
                  label="Copy card number"
                  disabled={frozen || !revealed}
                  onClick={() => copy(fullPan(card).replace(/\s/g, ""), "Card number")}
                />
                <ActionRow
                  icon={Copy}
                  label="Copy CVV"
                  disabled={frozen || !revealed}
                  onClick={() => copy(fullCvv(card), "CVV")}
                />
                {frozen ? (
                  <ActionRow
                    icon={Play}
                    label={pending ? "Unfreezing…" : "Unfreeze card"}
                    onClick={() => onUnfreeze(card.id)}
                    disabled={pending}
                    tone="success"
                  />
                ) : (
                  <ActionRow
                    icon={Snowflake}
                    label={pending ? "Freezing…" : "Freeze card"}
                    onClick={() => onFreeze(card.id)}
                    disabled={pending}
                  />
                )}
                <ActionRow
                  icon={RefreshCcw}
                  label="Replace card"
                  onClick={() => setConfirmReplace(true)}
                  disabled={pending}
                  tone="danger"
                />
              </div>

              {frozen && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-800 animate-fade-in">
                  <Lock className="h-4 w-4" /> Sensitive details are locked while this card is frozen.
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmReveal} onOpenChange={setConfirmReveal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal full card details?</AlertDialogTitle>
            <AlertDialogDescription>
              The full card number and CVV will be visible for about 30 seconds.
              Make sure no one else can see your screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRevealed(true);
                setConfirmReveal(false);
              }}
            >
              Reveal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this card?</AlertDialogTitle>
            <AlertDialogDescription>
              A new card number, CVV and expiry will be generated. The current
              card becomes permanently inactive. Your account and balance are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (card) onReplace(card.id);
                setConfirmReplace(false);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-slate-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-40 disabled:hover:translate-y-0 ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
