import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCountries,
  listModules,
  getDraft,
  updateDraft,
  finalizeDraft,
} from "@/lib/bank-builder.functions";
import { uploadBrandingAsset } from "@/lib/branding/upload.functions";
import {
  type BankBranding,
  type BankCountry,
  type BankDraft,
  type BankIdentity,
  type BankModule,
} from "@/lib/bank-builder.types";
import { RequireAuth } from "@/components/launch/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank-builder")({
  validateSearch: (s: Record<string, unknown>) => ({
    draftId: typeof s.draftId === "string" ? s.draftId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Launch New Bank — TheMixWeb" },
      {
        name: "description",
        content:
          "Configure your new bank: identity, branding, modules, and generate the tenant.",
      },
    ],
  }),
  component: BankBuilderPage,
});

// Wizard sub-steps handled inside this route (steps 4–8 of the full flow).
const STEPS = ["Bank Identity", "Branding", "Bank Modules", "Review", "Generate Bank"] as const;
const TOTAL_STEPS = 8;
const START_OFFSET = 3; // Blueprint category, Country, Blueprint happen before this route.

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function BankBuilderPage() {
  const { draftId } = Route.useSearch();
  if (!draftId) return <Navigate to="/launch" />;
  return (
    <RequireAuth>
      <Wizard draftId={draftId} />
    </RequireAuth>
  );
}

function Wizard({ draftId }: { draftId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getDraftFn = useServerFn(getDraft);
  const updateDraftFn = useServerFn(updateDraft);
  const finalizeDraftFn = useServerFn(finalizeDraft);
  const listCountriesFn = useServerFn(listCountries);
  const listModulesFn = useServerFn(listModules);

  const draftQ = useQuery({
    queryKey: ["bb-draft", draftId],
    queryFn: () => getDraftFn({ data: { id: draftId } }),
  });
  const countriesQ = useQuery({ queryKey: ["bb-countries"], queryFn: () => listCountriesFn() });
  const modulesQ = useQuery({ queryKey: ["bb-modules"], queryFn: () => listModulesFn() });

  const [step, setStep] = useState(1); // 1..5 local

  const draft = draftQ.data as BankDraft | undefined;
  const countries = (countriesQ.data as BankCountry[]) ?? [];
  const modules = (modulesQ.data as BankModule[]) ?? [];

  const patchMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateDraftFn({ data: { id: draftId, patch } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bb-draft", draftId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeDraftFn({ data: { id: draftId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bb-draft", draftId] });
      qc.invalidateQueries({ queryKey: ["bb-drafts"] });
      toast.success("Bank generated and published");
      navigate({ to: "/manage/banks/$id", params: { id: draftId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to generate"),
  });

  const goto = async (next: number, patch?: Record<string, unknown>) => {
    if (patch) await patchMut.mutateAsync({ ...patch, current_step: START_OFFSET + next });
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  if (!draft) {
    return <div className="p-8 text-center text-muted-foreground">Loading draft…</div>;
  }

  const label = STEPS[step - 1];
  const globalStep = START_OFFSET + step;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
          <span className="text-muted-foreground">›</span>
          <Link to="/launch" className="text-sm text-muted-foreground hover:text-foreground">Launch</Link>
          <span className="text-muted-foreground">›</span>
          <span className="truncate text-sm font-medium">{label}</span>
          <div className="ml-auto text-xs text-muted-foreground">
            Step {globalStep} of {TOTAL_STEPS}
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(globalStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {step === 1 && (
          <StepIdentity
            identity={(draft.identity ?? {}) as Partial<BankIdentity>}
            countries={countries}
            onBack={() => navigate({ to: "/launch" })}
            onContinue={(identity) => goto(2, { identity })}
          />
        )}
        {step === 2 && (
          <StepBranding
            branding={(draft.branding ?? {}) as Partial<BankBranding>}
            onBack={() => setStep(1)}
            onContinue={(branding) => goto(3, { branding })}
          />
        )}
        {step === 3 && (
          <StepModules
            modules={modules}
            features={draft.features ?? {}}
            onBack={() => setStep(2)}
            onContinue={(features) => goto(4, { features })}
          />
        )}
        {step === 4 && (
          <StepReview
            draft={draft}
            country={countries.find((c) => c.code === draft.country_code)}
            modules={modules}
            onBack={() => setStep(3)}
            onContinue={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <StepGenerate
            draft={draft}
            onBack={() => setStep(4)}
            onGenerate={() => finalizeMut.mutate()}
            busy={finalizeMut.isPending}
          />
        )}
      </main>
    </div>
  );
}

/* ---------------- Step: Identity ---------------- */
function StepIdentity({
  identity,
  countries,
  onBack,
  onContinue,
}: {
  identity: Partial<BankIdentity>;
  countries: BankCountry[];
  onBack: () => void;
  onContinue: (i: BankIdentity) => void;
}) {
  const [bankName, setBankName] = useState(identity.bank_name ?? "");
  const [subdomain, setSubdomain] = useState(identity.subdomain ?? "");
  const [country, setCountry] = useState(identity.country_code ?? "");
  const [currency, setCurrency] = useState(identity.currency ?? "");
  const [timezone, setTimezone] = useState(identity.timezone ?? "");
  const [language, setLanguage] = useState(identity.language ?? "");

  useEffect(() => {
    if (bankName && !identity.subdomain) setSubdomain(slugify(bankName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankName]);

  useEffect(() => {
    const c = countries.find((x) => x.code === country);
    if (c) {
      if (!currency) setCurrency(c.currency);
      if (!timezone) setTimezone(c.timezone);
      if (!language) setLanguage(c.default_language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, countries]);

  const url = subdomain ? `${subdomain}.themixweb.app` : "your-bank.themixweb.app";
  const valid = bankName && subdomain && country && currency && timezone && language;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bank Identity</h1>
        <p className="mt-2 text-muted-foreground">Give your bank a name and address.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Bank Name">
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="PrimeTrust" />
          </Field>
          <Field label="Subdomain">
            <Input value={subdomain} onChange={(e) => setSubdomain(slugify(e.target.value))} />
          </Field>
          <Field label="Country">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Choose country" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Timezone">
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </Field>
          <Field label="Language">
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </Field>
          <div className="sm:col-span-2 rounded-lg border bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">Your bank will live at</div>
            <div className="font-mono text-lg">{url}</div>
          </div>
        </CardContent>
      </Card>
      <NavRow
        onBack={onBack}
        onNext={() =>
          onContinue({
            bank_name: bankName,
            subdomain,
            country_code: country,
            currency,
            timezone,
            language,
          })
        }
        disabled={!valid}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------- Step: Branding ---------------- */
function StepBranding({
  branding,
  onBack,
  onContinue,
}: {
  branding: Partial<BankBranding>;
  onBack: () => void;
  onContinue: (b: BankBranding) => void;
}) {
  const { draftId } = Route.useSearch();
  const uploadFn = useServerFn(uploadBrandingAsset);
  const [b, setB] = useState<BankBranding>({
    primary_color: branding.primary_color ?? "#0a2540",
    secondary_color: branding.secondary_color ?? "#1e88e5",
    accent_color: branding.accent_color ?? "#00c48c",
    font_heading: branding.font_heading ?? "Inter",
    font_body: branding.font_body ?? "Inter",
    login_logo_url: branding.login_logo_url ?? "",
    dashboard_logo_url: branding.dashboard_logo_url ?? "",
    button_style: branding.button_style ?? "rounded",
    border_radius: branding.border_radius ?? 8,
    dark_mode: branding.dark_mode ?? false,
  });
  const set = <K extends keyof BankBranding>(k: K, v: BankBranding[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="mt-2 text-muted-foreground">Style your bank and upload brand assets.</p>
        </div>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>Preview branding</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <ColorField label="Primary Color" value={b.primary_color} onChange={(v) => set("primary_color", v)} />
            <ColorField label="Secondary Color" value={b.secondary_color} onChange={(v) => set("secondary_color", v)} />
            <ColorField label="Accent Color" value={b.accent_color} onChange={(v) => set("accent_color", v)} />
            <Field label="Heading Font">
              <Select value={b.font_heading} onValueChange={(v) => set("font_heading", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Inter", "Poppins", "Roboto", "Playfair Display", "Manrope", "DM Sans"].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Body Font">
              <Select value={b.font_body} onValueChange={(v) => set("font_body", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Inter", "Roboto", "Open Sans", "Lato", "Source Sans 3"].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2 space-y-1">
              <div className="text-sm font-semibold">Bank logos</div>
              <p className="text-xs text-muted-foreground">
                Upload two versions of your bank's logo. JPG, PNG or WEBP. Max 5&nbsp;MB each.
              </p>
            </div>
            <UploadField
              label="Login Page Logo"
              hint="Shown on Sign in, Register and Forgot password pages."
              kind="login_logo"
              draftId={draftId!}
              url={b.login_logo_url}
              uploadFn={uploadFn}
              onUrl={(u) => set("login_logo_url", u)}
              accept="image/png,image/jpeg,image/webp"
              maxMB={5}
              wide
              previewClass="h-20 w-20 rounded-lg bg-slate-100 object-contain p-2"
            />
            <UploadField
              label="Customer Dashboard Logo"
              hint="Shown in the sidebar, mobile nav and every authenticated banking screen."
              kind="dashboard_logo"
              draftId={draftId!}
              url={b.dashboard_logo_url}
              uploadFn={uploadFn}
              onUrl={(u) => set("dashboard_logo_url", u)}
              accept="image/png,image/jpeg,image/webp"
              maxMB={5}
              wide
              previewClass="h-20 w-20 rounded-lg bg-slate-100 object-contain p-2"
            />
            <Field label="Button Style">
              <Select value={b.button_style} onValueChange={(v) => set("button_style", v as BankBranding["button_style"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="pill">Pill</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2 space-y-2">
              <Label>Border Radius: {b.border_radius}px</Label>
              <Slider value={[b.border_radius]} min={0} max={24} step={1} onValueChange={(v) => set("border_radius", v[0])} />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="dm" className="cursor-pointer">Dark Mode</Label>
              <Switch id="dm" checked={b.dark_mode} onCheckedChange={(v) => set("dark_mode", v)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Live preview</CardTitle></CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`,
                borderRadius: b.border_radius,
                fontFamily: b.font_body,
              }}
            >
              {b.login_logo_url && (
                <img src={b.login_logo_url} alt="" className="mb-3 h-10 w-10 rounded bg-white/10 object-contain p-1" />
              )}
              <div style={{ fontFamily: b.font_heading }} className="text-xl font-bold">
                Your bank
              </div>
              <p className="mt-1 text-sm opacity-90">Hero preview text</p>
              <button
                className="mt-4 px-4 py-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: b.accent_color,
                  borderRadius: b.button_style === "pill" ? 999 : b.button_style === "square" ? 0 : b.border_radius,
                }}
              >
                Open account
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <NavRow onBack={onBack} onNext={() => onContinue(b)} />
      {previewOpen && (
        <BrandingPreviewModal branding={b} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function UploadField({
  label,
  kind,
  draftId,
  url,
  onUrl,
  uploadFn,
  accept,
  maxMB,
  previewClass,
  wide,
}: {
  label: string;
  kind: "logo" | "favicon" | "hero";
  draftId: string;
  url: string;
  onUrl: (u: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadFn: (args: { data: any }) => Promise<{ url: string }>;
  accept: string;
  maxMB: number;
  previewClass: string;
  wide?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const handleFile = async (file: File) => {
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Max size ${maxMB} MB`);
      return;
    }
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => {
          const s = String(fr.result);
          const i = s.indexOf(",");
          res(i >= 0 ? s.slice(i + 1) : s);
        };
        fr.onerror = () => rej(new Error("Read failed"));
        fr.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const r = await uploadFn({
        data: {
          draft_id: draftId,
          kind,
          content_type: file.type || "application/octet-stream",
          data_base64: b64,
          extension: ext,
        },
      });
      onUrl(r.url);
      toast.success(`${label} uploaded`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn("space-y-2", wide && "sm:col-span-2")}>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" className={previewClass} />
        ) : (
          <div className={cn(previewClass, "flex items-center justify-center text-xs text-muted-foreground")}>
            No file
          </div>
        )}
        <div className="flex-1">
          <Input
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="mt-1 text-xs text-muted-foreground">
            {busy ? "Uploading…" : url ? "Uploaded — choose another file to replace" : `Max ${maxMB} MB`}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandingPreviewModal({
  branding,
  onClose,
}: {
  branding: BankBranding;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"homepage" | "login" | "register" | "dashboard" | "sidebar" | "statement" | "email" | "favicon">("homepage");
  const p = branding.primary_color;
  const a = branding.accent_color;
  const tabs = [
    ["homepage", "Homepage"],
    ["login", "Login"],
    ["register", "Register"],
    ["dashboard", "Dashboard"],
    ["sidebar", "Sidebar"],
    ["statement", "PDF header"],
    ["email", "Email"],
    ["favicon", "Favicon"],
  ] as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h3 className="text-lg font-semibold">Branding preview</h3>
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-wrap gap-1 border-b bg-slate-50 px-4 py-2">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                tab === k ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6" style={{ fontFamily: branding.font_body }}>
          {tab === "homepage" && (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between px-6 py-3" style={{ backgroundColor: p, color: "#fff" }}>
                {branding.logo_url ? <img src={branding.logo_url} alt="" className="h-8" /> : <span className="font-bold" style={{ fontFamily: branding.font_heading }}>Your Bank</span>}
                <button className="rounded px-3 py-1 text-sm font-medium" style={{ backgroundColor: a }}>Open account</button>
              </div>
              {branding.hero_image_url && <img src={branding.hero_image_url} alt="" className="h-40 w-full object-cover" />}
              <div className="p-6">
                <h1 style={{ fontFamily: branding.font_heading, color: p }} className="text-3xl font-bold">Banking, redesigned.</h1>
                <p className="mt-2 text-sm text-slate-600">Everything you need in one place.</p>
              </div>
            </div>
          )}
          {tab === "login" && (
            <div className="mx-auto max-w-sm rounded-xl border p-6 text-center">
              {branding.logo_url && <img src={branding.logo_url} alt="" className="mx-auto mb-4 h-12" />}
              <h2 style={{ fontFamily: branding.font_heading, color: p }} className="text-xl font-bold">Sign in</h2>
              <div className="mt-4 space-y-2 text-left">
                <div className="h-10 rounded border bg-slate-50" />
                <div className="h-10 rounded border bg-slate-50" />
                <button className="mt-2 w-full rounded py-2 text-sm font-medium text-white" style={{ backgroundColor: p }}>Sign in</button>
              </div>
            </div>
          )}
          {tab === "register" && (
            <div className="mx-auto max-w-md rounded-xl border p-6">
              <h2 style={{ fontFamily: branding.font_heading, color: p }} className="text-xl font-bold">Open your account</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[..."abcdefgh"].map((k) => <div key={k} className="h-10 rounded border bg-slate-50" />)}
              </div>
              <button className="mt-4 w-full rounded py-2 text-sm font-medium text-white" style={{ backgroundColor: a }}>Create account</button>
            </div>
          )}
          {tab === "dashboard" && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="col-span-2 rounded-xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${p}, ${branding.secondary_color})` }}>
                <div className="text-xs opacity-80">Total balance</div>
                <div className="mt-1 text-3xl font-bold">$12,480.55</div>
              </div>
              <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">Send</div><div className="mt-1 font-semibold">Transfer worldwide</div></div>
              <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">Receive</div><div className="mt-1 font-semibold">Log incoming funds</div></div>
              <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">Withdraw</div><div className="mt-1 font-semibold">Cash or transfer</div></div>
            </div>
          )}
          {tab === "sidebar" && (
            <div className="mx-auto max-w-xs overflow-hidden rounded-xl" style={{ backgroundColor: p, color: "#fff" }}>
              <div className="px-6 py-6">
                {branding.logo_url ? <img src={branding.logo_url} alt="" className="h-10" /> : <div className="font-bold" style={{ fontFamily: branding.font_heading }}>Your Bank</div>}
              </div>
              {["Dashboard", "Accounts", "Transfer", "Cards", "Statements"].map((n, i) => (
                <div key={n} className={cn("px-6 py-3 text-sm", i === 0 && "bg-white/10 font-semibold")}>{n}</div>
              ))}
            </div>
          )}
          {tab === "statement" && (
            <div className="rounded-xl border">
              <div className="flex items-center gap-4 px-6 py-4" style={{ backgroundColor: p, color: "#fff" }}>
                {branding.logo_url && <img src={branding.logo_url} alt="" className="h-10" />}
                <div>
                  <div className="text-lg font-bold" style={{ fontFamily: branding.font_heading }}>Your Bank</div>
                  <div className="text-xs opacity-80">Official account statement</div>
                </div>
                <div className="ml-auto text-right text-lg font-bold">Account Statement</div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 text-sm">
                <div><div className="font-semibold">Customer</div><div>Jane Doe</div><div className="text-xs text-slate-500">C-1A2B3C</div></div>
                <div><div className="font-semibold">Account</div><div>Personal · 1234567890</div><div className="text-xs text-slate-500">USD</div></div>
              </div>
            </div>
          )}
          {tab === "email" && (
            <div className="mx-auto max-w-md overflow-hidden rounded-xl border">
              <div className="px-6 py-4 text-white" style={{ backgroundColor: p }}>
                {branding.logo_url && <img src={branding.logo_url} alt="" className="h-8" />}
                <div className="mt-2 font-semibold" style={{ fontFamily: branding.font_heading }}>Welcome to Your Bank</div>
              </div>
              <div className="p-6 text-sm">
                <p>Hi Jane,</p>
                <p className="mt-2">Your account has been created. Sign in to explore your dashboard.</p>
                <button className="mt-4 rounded px-4 py-2 text-sm text-white" style={{ backgroundColor: a }}>Go to your dashboard</button>
              </div>
            </div>
          )}
          {tab === "favicon" && (
            <div className="flex flex-col items-center gap-3 py-8">
              {branding.favicon_url ? (
                <img src={branding.favicon_url} alt="" className="h-16 w-16" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">None</div>
              )}
              <p className="text-xs text-muted-foreground">Displayed in browser tabs and bookmarks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step: Modules ---------------- */
function StepModules({
  modules,
  features,
  onBack,
  onContinue,
}: {
  modules: BankModule[];
  features: Record<string, boolean>;
  onBack: () => void;
  onContinue: (v: Record<string, boolean>) => void;
}) {
  const [v, setV] = useState<Record<string, boolean>>(features);
  const grouped = useMemo(() => {
    const map = new Map<string, BankModule[]>();
    for (const m of modules) {
      const arr = map.get(m.group_name) ?? [];
      arr.push(m);
      map.set(m.group_name, arr);
    }
    return Array.from(map.entries());
  }, [modules]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bank Modules</h1>
        <p className="mt-2 text-muted-foreground">
          Toggle the customer-facing capabilities your bank will ship with.
        </p>
      </div>
      {grouped.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No modules available.
        </div>
      )}
      {grouped.map(([group, list]) => (
        <div key={group} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => {
              const on = !!v[m.key];
              return (
                <button
                  key={m.key}
                  onClick={() => setV({ ...v, [m.key]: !on })}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border-2 bg-card p-4 text-left transition hover:shadow-sm",
                    on ? "border-primary" : "border-border",
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                  <Switch checked={on} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <NavRow onBack={onBack} onNext={() => onContinue(v)} />
    </div>
  );
}

/* ---------------- Step: Review ---------------- */
function StepReview({
  draft,
  country,
  modules,
  onBack,
  onContinue,
}: {
  draft: BankDraft;
  country?: BankCountry;
  modules: BankModule[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const identity = draft.identity as Partial<BankIdentity>;
  const branding = draft.branding as Partial<BankBranding>;
  const url = identity?.subdomain
    ? `${identity.subdomain}.themixweb.app`
    : "your-bank.themixweb.app";
  const enabledKeys = Object.entries(draft.features ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k);
  const enabledModules = modules.filter((m) => enabledKeys.includes(m.key));

  const rows = [
    { label: "Country", value: country ? `${country.flag_emoji} ${country.name}` : "—" },
    { label: "Bank name", value: identity?.bank_name ?? "—" },
    { label: "URL", value: url },
    { label: "Currency", value: identity?.currency ?? "—" },
    { label: "Timezone", value: identity?.timezone ?? "—" },
    { label: "Language", value: identity?.language ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review</h1>
        <p className="mt-2 text-muted-foreground">Confirm your configuration before generating.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 border-b py-1 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="text-right font-medium">{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              {(["primary_color","secondary_color","accent_color"] as const).map((k) => (
                <div key={k} className="flex-1 rounded border p-2 text-center">
                  <div className="mx-auto h-8 w-8 rounded" style={{ backgroundColor: (branding[k] as string) || "#ccc" }} />
                  <div className="mt-1 text-xs text-muted-foreground">{k.replace("_color","")}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Fonts: {branding.font_heading} / {branding.font_body}</div>
            <div className="text-xs text-muted-foreground">Radius: {branding.border_radius}px · {branding.button_style} · {branding.dark_mode ? "Dark" : "Light"}</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Bank Modules</CardTitle></CardHeader>
          <CardContent>
            {enabledModules.length === 0 ? (
              <div className="text-sm text-muted-foreground">No modules enabled</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {enabledModules.map((m) => (
                  <Badge key={m.key} variant="secondary">{m.label}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <NavRow onBack={onBack} onNext={onContinue} nextLabel="Continue to Generate" />
    </div>
  );
}

/* ---------------- Step: Generate ---------------- */
function StepGenerate({
  draft,
  onBack,
  onGenerate,
  busy,
}: {
  draft: BankDraft;
  onBack: () => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  const identity = draft.identity as Partial<BankIdentity>;
  const url = identity?.subdomain ? `${identity.subdomain}.themixweb.app` : "—";
  const alreadyGenerated = draft.status === "saved";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Bank</h1>
        <p className="mt-2 text-muted-foreground">
          Publish {identity.bank_name || "your bank"} at <span className="font-mono">{url}</span>.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6 text-sm">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check className="h-4 w-4" /> Blueprint, identity, branding and modules are configured.
          </div>
          <p className="text-muted-foreground">
            Clicking Generate Bank creates the tenant record, applies branding, activates the
            selected modules, marks the bank as published, and opens the Bank Overview.
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button size="lg" onClick={onGenerate} disabled={busy}>
          {busy ? "Generating…" : alreadyGenerated ? "Re-publish Bank" : "Generate Bank"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Nav ---------------- */
function NavRow({
  onBack,
  onNext,
  disabled,
  nextLabel,
}: {
  onBack: () => void;
  onNext?: () => void;
  disabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      {onNext && (
        <Button onClick={onNext} disabled={disabled}>
          {nextLabel ?? "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

