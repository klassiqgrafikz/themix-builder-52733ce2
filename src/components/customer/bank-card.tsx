// Shared customer bank-card visuals + reveal/management sheet.
// Used by the portal Cards page and the dashboard Card Deck layout.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerCard } from "@/lib/customer/cards.functions";
import { CreditCard, Copy, Eye, EyeOff, Lock, RefreshCcw, Snowflake, Play, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

/* ---------- deterministic full number & CVV from card id ---------- */

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

export function fullPan(card: CustomerCard): string {
  const bin =
    card.brand === "mastercard" ? "5300" : card.brand === "amex" ? "3782" : "4539";
  const middle = hashDigits(card.id, 8);
  return `${bin} ${middle.slice(0, 4)} ${middle.slice(4, 8)} ${card.last4}`;
}
export function fullCvv(card: CustomerCard): string {
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

/* ---------- card visual ---------- */

export function BankCard({
  card,
  manifest,
  revealed,
  variant,
}: {
  card: CustomerCard;
  manifest: WebsiteManifest;
  revealed: boolean;
  variant?: "classic" | "wave";
}) {
  const primary = manifest.theme.colors.primary;
  const secondary = manifest.theme.colors.secondary ?? primary;
  const logo = manifest.brand.dashboard_logo_url;
  const frozen = card.status === "frozen";
  const wave = variant === "wave";

  const displayNumber = revealed ? fullPan(card) : card.masked_number;
  const displayCvv = revealed ? fullCvv(card) : "•••";
  const expiry = `${String(card.expiry_month).padStart(2, "0")}/${String(card.expiry_year).slice(-2)}`;

  return (
    <div className="relative aspect-[1.586/1] w-full">
      <div
        className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-xl"
        style={{
          background: wave
            ? `linear-gradient(140deg, color-mix(in oklab, ${primary} 65%, #10b981) 0%, ${primary} 45%, color-mix(in oklab, ${secondary} 70%, black) 100%)`
            : `linear-gradient(135deg, ${primary} 0%, color-mix(in oklab, ${secondary} 70%, black) 100%)`,
        }}
      >
        {wave ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 170 Q 50 110 100 150 T 200 150 T 300 150 T 400 150 V 260 H 0 Z"
              fill="rgba(255,255,255,0.10)"
            />
            <path
              d="M0 190 Q 60 140 120 175 T 260 175 T 400 175 V 260 H 0 Z"
              fill="rgba(255,255,255,0.07)"
            />
            <path
              d="M0 215 Q 80 165 150 205 T 330 205 T 400 200 V 260 H 0 Z"
              fill="rgba(255,255,255,0.05)"
            />
          </svg>
        ) : (
          <>
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/5" />
          </>
        )}

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
    </div>
  );
}

/* ---------- bottom sheet with options ---------- */

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

function ConfirmPanel({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  tone = "default",
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "default" | "success" | "danger";
}) {
  const confirmClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-slate-900 hover:bg-slate-800";
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 animate-fade-in">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs opacity-70">{description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

export function CardOptionsSheet({
  card,
  manifest,
  onClose,
  onFreeze,
  onUnfreeze,
  onReplace,
  onDelete,
  pending,
}: {
  card: CustomerCard | null;
  manifest: WebsiteManifest;
  onClose: () => void;
  onFreeze: (id: string) => void;
  onUnfreeze: (id: string) => void;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmUnfreeze, setConfirmUnfreeze] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setConfirmUnfreeze(false);
      setConfirmDelete(false);
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

              {confirmReveal ? (
                <ConfirmPanel
                  title="Reveal full card details?"
                  description="The full card number and CVV will be visible for about 30 seconds. Make sure no one else can see your screen."
                  confirmLabel="Reveal"
                  onCancel={() => setConfirmReveal(false)}
                  onConfirm={() => {
                    setRevealed(true);
                    setConfirmReveal(false);
                  }}
                />
              ) : confirmUnfreeze ? (
                <ConfirmPanel
                  title="Card is frozen"
                  description="This card is frozen. Unfreeze it to reveal the card number and CVV."
                  confirmLabel="Unfreeze card"
                  tone="success"
                  onCancel={() => setConfirmUnfreeze(false)}
                  onConfirm={() => {
                    if (card) onUnfreeze(card.id);
                    setConfirmUnfreeze(false);
                  }}
                />
              ) : confirmReplace ? (
                <ConfirmPanel
                  title="Replace this card?"
                  description="A new card number, CVV and expiry will be generated. The current card becomes permanently inactive. Your account and balance are unchanged."
                  confirmLabel="Replace"
                  tone="danger"
                  onCancel={() => setConfirmReplace(false)}
                  onConfirm={() => {
                    if (card) onReplace(card.id);
                    setConfirmReplace(false);
                  }}
                />
              ) : confirmDelete ? (
                <ConfirmPanel
                  title="Delete this card?"
                  description="The card will be permanently removed from your account and can no longer be used. Your account and balance are unchanged."
                  confirmLabel="Delete"
                  tone="danger"
                  onCancel={() => setConfirmDelete(false)}
                  onConfirm={() => {
                    if (card) onDelete(card.id);
                    setConfirmDelete(false);
                  }}
                />
              ) : (
                <div className="grid gap-2">
                  <ActionRow
                    icon={revealed ? EyeOff : Eye}
                    label={revealed ? "Hide card details" : "Reveal card details"}
                    onClick={() => {
                      if (revealed) setRevealed(false);
                      else if (frozen) setConfirmUnfreeze(true);
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
                  <ActionRow
                    icon={Trash2}
                    label="Delete card"
                    onClick={() => setConfirmDelete(true)}
                    disabled={pending}
                    tone="danger"
                  />
                </div>
              )}

              {frozen && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-800 animate-fade-in">
                  <Lock className="h-4 w-4" /> Sensitive details are locked while this card is frozen.
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
