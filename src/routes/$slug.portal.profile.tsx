import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { updateCustomerProfile } from "@/lib/customer/customer.functions";
import { uploadCustomerAvatar } from "@/lib/customer/avatar.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  ShieldCheck,
  BadgeCheck,
  Lock,
  KeyRound,
  Settings2,
  Mail,
  Phone,
  MapPin,
  Globe,
  User as UserIcon,
  Calendar,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/$slug/portal/profile")({
  component: ProfilePage,
});

// ---------- helpers ----------

function initials(first: string, last: string): string {
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

function formatMemberSince(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  } catch {
    return "—";
  }
}

function statusPalette(status: string): { bg: string; fg: string; label: string } {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return { bg: "#dcfce7", fg: "#166534", label: "Active" };
  if (s === "frozen") return { bg: "#dbeafe", fg: "#1e40af", label: "Frozen" };
  if (s === "restricted") return { bg: "#fef3c7", fg: "#92400e", label: "Restricted" };
  if (s === "closed" || s === "suspended")
    return { bg: "#fee2e2", fg: "#991b1b", label: s.charAt(0).toUpperCase() + s.slice(1) };
  return { bg: "#e2e8f0", fg: "#334155", label: s.charAt(0).toUpperCase() + s.slice(1) || "—" };
}

// Load a File into an HTMLImageElement (client only).
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Crop centre-square, resize to `size`, output JPEG base64 (no data-URL prefix).
async function processAvatar(
  file: File,
  size = 512,
): Promise<{ base64: string; contentType: string; extension: string }> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.max(0, (img.naturalWidth - side) / 2);
  const sy = Math.max(0, (img.naturalHeight - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      0.9,
    ),
  );
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Base64-encode without spreading huge arrays.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return { base64: btoa(bin), contentType: "image/jpeg", extension: "jpg" };
}

// ---------- component ----------

function ProfilePage() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primary = theme.colors.primary;
  const accent = theme.colors.accent;
  const c = session.customer;

  const [form, setForm] = useState({
    phone: c.phone ?? "",
    address: c.address ?? "",
    country: c.country ?? "",
    nationality: c.nationality ?? "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(c.profile_picture_url);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const qc = useQueryClient();
  const doUpdate = useServerFn(updateCustomerProfile);
  const doUpload = useServerFn(uploadCustomerAvatar);

  const mut = useMutation({
    mutationFn: () => doUpdate({ data: { slug: bank.slug, ...form } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("Please choose a JPG, PNG or WEBP image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8 MB.");
      const { base64, contentType, extension } = await processAvatar(file);
      return doUpload({
        data: { slug: bank.slug, content_type: contentType, data_base64: base64, extension },
      });
    },
    onSuccess: (res) => {
      toast.success("Photo updated");
      setAvatarPreview(res.url);
      qc.invalidateQueries();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const status = statusPalette(c.status);
  const initialsStr = initials(c.first_name, c.last_name);
  const avatarSrc = avatarPreview
    ? `${avatarPreview}${avatarPreview.includes("?") ? "&" : "?"}cb=${uploadMut.isSuccess ? Date.now() : ""}`
    : null;

  return (
    <div className="space-y-8">
      {/* ============ HEADER ============ */}
      <div
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div
          className="h-28 sm:h-32"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
          }}
        />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <div className="relative">
              <div
                className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-white sm:h-36 sm:w-36"
                style={{ overflow: "hidden" }}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`${c.first_name} ${c.last_name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-4xl font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${primary}, ${accent})`,
                      fontFamily: theme.typography.heading,
                    }}
                  >
                    {initialsStr}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMut.isPending}
                className="absolute bottom-1 right-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition hover:scale-105 disabled:opacity-70"
                style={{ backgroundColor: primary }}
                aria-label="Change profile photo"
                title="Change photo"
              >
                {uploadMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMut.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Identity block */}
            <div className="min-w-0 flex-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="truncate text-2xl font-bold sm:text-3xl"
                  style={{ fontFamily: theme.typography.heading, color: primary }}
                >
                  {c.first_name} {c.last_name}
                </h1>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: status.bg, color: status.fg }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: status.fg }}
                  />
                  {status.label}
                </span>
                {c.email_verified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700"
                    title="Verified email"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 opacity-70" />
                  Customer #{c.customer_number}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-70" />
                  Member since {formatMemberSince(c.created_at)}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-2 sm:pb-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                <Camera className="mr-2 h-4 w-4" />
                {avatarPreview ? "Change photo" : "Upload photo"}
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            JPG, PNG or WEBP · square crop applied automatically · up to 8&nbsp;MB.
          </p>
        </div>
      </div>

      {/* ============ INFO CARDS ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal */}
        <BrandedCard manifest={manifest}>
          <SectionHeader
            icon={<UserIcon className="h-4 w-4" />}
            title="Personal information"
            color={primary}
          />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <ReadRow label="Full name" value={`${c.first_name} ${c.last_name}`} />
            <ReadRow label="Date of birth" value={c.date_of_birth ?? "—"} />
            <ReadRow label="Gender" value={c.gender ?? "—"} />
            <ReadRow label="Nationality" value={c.nationality || "—"} />
          </dl>
        </BrandedCard>

        {/* Contact (editable) */}
        <BrandedCard manifest={manifest}>
          <SectionHeader
            icon={<Mail className="h-4 w-4" />}
            title="Contact information"
            color={primary}
          />
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
          >
            <Field label="Phone number" icon={<Phone className="h-3.5 w-3.5" />}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 000 0000"
              />
            </Field>
            <Field label="Email (read-only)" icon={<Mail className="h-3.5 w-3.5" />}>
              <Input value={c.email} readOnly disabled />
            </Field>
            <Field
              label="Residential address"
              icon={<MapPin className="h-3.5 w-3.5" />}
              className="sm:col-span-2"
            >
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, city, postal code"
              />
            </Field>
            <Field label="Country" icon={<Globe className="h-3.5 w-3.5" />}>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </Field>
            <Field label="Nationality" icon={<Globe className="h-3.5 w-3.5" />}>
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </Field>
            <div className="mt-1 flex items-center justify-end gap-2 sm:col-span-2">
              <Button
                type="submit"
                disabled={mut.isPending}
                style={{ backgroundColor: primary, color: "#fff" }}
              >
                {mut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </BrandedCard>

        {/* Security */}
        <BrandedCard manifest={manifest} className="lg:col-span-2">
          <SectionHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Security"
            color={primary}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <SecurityTile
              icon={<Lock className="h-4 w-4" />}
              label="Password"
              value="••••••••••"
              hint="Change your sign-in password"
            />
            <SecurityTile
              icon={<KeyRound className="h-4 w-4" />}
              label="Transaction PIN"
              value="•• •• ••"
              hint="Confirms sensitive transactions"
            />
            <SecurityTile
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Two-factor authentication"
              value="Managed in Security Center"
              hint="Add an extra layer of protection"
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/$slug/portal/security" params={{ slug: bank.slug }}>
                <Lock className="mr-2 h-3.5 w-3.5" /> Change password
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/$slug/portal/security" params={{ slug: bank.slug }}>
                <KeyRound className="mr-2 h-3.5 w-3.5" /> Change PIN
              </Link>
            </Button>
            <Button asChild size="sm" style={{ backgroundColor: accent, color: "#fff" }}>
              <Link to="/$slug/portal/security" params={{ slug: bank.slug }}>
                <Settings2 className="mr-2 h-3.5 w-3.5" /> Security settings
              </Link>
            </Button>
          </div>
        </BrandedCard>
      </div>
    </div>
  );
}

// ---------- small presentational subcomponents ----------

function SectionHeader({
  icon,
  title,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
    </div>
  );
}

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-dashed border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function SecurityTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-600">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-sm text-slate-800">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
