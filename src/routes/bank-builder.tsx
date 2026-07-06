import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listCountries,
  listTemplates,
  createDraft,
  getDraft,
  updateDraft,
  finalizeDraft,
} from "@/lib/bank-builder.functions";
import {
  ADMIN_OPTIONS,
  CATEGORY_OPTIONS,
  FEATURE_OPTIONS,
  SIMULATION_OPTIONS,
  type BankBranding,
  type BankCountry,
  type BankDraft,
  type BankIdentity,
  type BankTemplate,
} from "@/lib/bank-builder.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Monitor,
  Search,
  Smartphone,
  Tablet,
} from "lucide-react";
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
          "Launch New Bank wizard: pick a Blueprint, brand it, configure modules, simulation and admin controls.",
      },
    ],
  }),
  component: BankBuilderPage,
});

const STEP_TITLES = [
  "Create New Bank",
  "Country",
  "Template Marketplace",
  "Template Preview",
  "Bank Identity",
  "Branding",
  "Features",
  "Simulation Controls",
  "Admin Controls",
  "Review",
];

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function BankBuilderPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setAuthed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!authed) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  return <Wizard />;
}

function Wizard() {
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<"template" | "custom">("template");

  const getDraftFn = useServerFn(getDraft);
  const createDraftFn = useServerFn(createDraft);
  const updateDraftFn = useServerFn(updateDraft);
  const finalizeDraftFn = useServerFn(finalizeDraft);
  const listCountriesFn = useServerFn(listCountries);
  const listTemplatesFn = useServerFn(listTemplates);
  const qc = useQueryClient();

  const draftQ = useQuery({
    queryKey: ["bb-draft", draftId],
    queryFn: () => getDraftFn({ data: { id: draftId! } }),
    enabled: !!draftId,
  });
  const draft = draftQ.data as BankDraft | undefined;

  const countriesQ = useQuery({
    queryKey: ["bb-countries"],
    queryFn: () => listCountriesFn(),
    enabled: step >= 2,
  });
  const templatesQ = useQuery({
    queryKey: ["bb-templates", "all"],
    queryFn: () => listTemplatesFn({ data: { country_code: null } }),
    enabled: step >= 3,
  });

  const startMut = useMutation({
    mutationFn: (m: "template" | "custom") => createDraftFn({ data: { mode: m } }),
    onSuccess: (row) => {
      const r = row as BankDraft;
      setDraftId(r.id);
      setStep(2);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const patchMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateDraftFn({ data: { id: draftId!, patch } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bb-draft", draftId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeDraftFn({ data: { id: draftId! } }),
    onSuccess: () => {
      toast.success("Bank configuration saved");
      qc.invalidateQueries({ queryKey: ["bb-draft", draftId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const goto = async (next: number, patch?: Record<string, unknown>) => {
    if (draftId && patch) {
      await patchMut.mutateAsync({ ...patch, current_step: next });
    } else if (draftId) {
      await patchMut.mutateAsync({ current_step: next });
    }
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
          <span className="text-muted-foreground">›</span>
          <span className="truncate text-sm font-medium">{STEP_TITLES[step - 1]}</span>
          <div className="ml-auto text-xs text-muted-foreground">
            Step {step} of 10
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(step / 10) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {step === 1 && (
          <Step1 mode={mode} setMode={setMode} onContinue={() => startMut.mutate(mode)} busy={startMut.isPending} />
        )}
        {step >= 2 && draft && (
          <>
            {step === 2 && (
              <Step2
                countries={(countriesQ.data as BankCountry[]) ?? []}
                selected={draft.country_code}
                onBack={() => setStep(1)}
                onContinue={(code) => {
                  const c = ((countriesQ.data as BankCountry[]) ?? []).find((x) => x.code === code);
                  goto(3, {
                    country_code: code,
                    identity: {
                      ...(draft.identity ?? {}),
                      country_code: code,
                      currency: c?.currency,
                      timezone: c?.timezone,
                      language: c?.default_language,
                    },
                  });
                }}
              />
            )}
            {step === 3 && (
              <Step3
                templates={(templatesQ.data as BankTemplate[]) ?? []}
                countries={(countriesQ.data as BankCountry[]) ?? []}
                loading={templatesQ.isLoading}
                mode={draft.mode}
                defaultCountry={draft.country_code}
                selectedId={draft.template_id}
                onBack={() => goto(2)}
                onSelect={(t) => {
                  const clonedFeatures: Record<string, boolean> = { ...(draft.features ?? {}) };
                  for (const f of t.features ?? []) clonedFeatures[f] = true;
                  goto(5, {
                    template_id: t.id,
                    country_code: t.country_code,
                    identity: {
                      ...(draft.identity ?? {}),
                      country_code: t.country_code,
                      currency: t.currency,
                      language: t.language,
                    },
                    branding: {
                      ...(draft.branding ?? {}),
                      primary_color: t.primary_color,
                      secondary_color: t.secondary_color,
                      accent_color: t.accent_color,
                      dark_mode: t.theme === "dark",
                    },
                    features: clonedFeatures,
                  });
                }}
                onSkip={() => goto(5)}
              />
            )}
            {step === 5 && (
              <Step5
                identity={(draft.identity ?? {}) as Partial<BankIdentity>}
                countries={(countriesQ.data as BankCountry[]) ?? []}
                onBack={() => goto(3)}
                onContinue={(identity) => goto(6, { identity })}
              />
            )}
            {step === 6 && (
              <Step6
                branding={(draft.branding ?? {}) as Partial<BankBranding>}
                onBack={() => goto(5)}
                onContinue={(branding) => goto(7, { branding })}
              />
            )}
            {step === 7 && (
              <Step7
                features={draft.features ?? {}}
                onBack={() => goto(6)}
                onContinue={(features) => goto(8, { features })}
              />
            )}
            {step === 8 && (
              <Step8
                simulation={draft.simulation ?? {}}
                onBack={() => goto(7)}
                onContinue={(simulation) => goto(9, { simulation })}
              />
            )}
            {step === 9 && (
              <Step9
                admin={draft.admin_controls ?? {}}
                onBack={() => goto(8)}
                onContinue={(admin_controls) => goto(10, { admin_controls })}
              />
            )}
            {step === 10 && (
              <Step10
                draft={draft}
                template={((templatesQ.data as BankTemplate[]) ?? []).find(
                  (t) => t.id === draft.template_id,
                )}
                country={((countriesQ.data as BankCountry[]) ?? []).find(
                  (c) => c.code === draft.country_code,
                )}
                onBack={() => goto(9)}
                onGenerate={() => finalizeMut.mutate()}
                busy={finalizeMut.isPending}
                saved={draft.status === "saved"}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------ STEP 1 ------------------ */
function Step1({
  mode,
  setMode,
  onContinue,
  busy,
}: {
  mode: "template" | "custom";
  setMode: (m: "template" | "custom") => void;
  onContinue: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Bank</h1>
        <p className="mt-2 text-muted-foreground">Choose how you'd like to start.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            id: "template" as const,
            title: "① Use Existing Bank Template",
            desc: "Start from a professionally designed template you can customise.",
          },
          {
            id: "custom" as const,
            title: "② Create Custom Bank",
            desc: "Build from a blank canvas and configure everything yourself.",
          },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            className={cn(
              "rounded-xl border-2 bg-card p-6 text-left transition-all hover:shadow-md",
              mode === o.id ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">{o.title}</h3>
              {mode === o.id && <Check className="h-5 w-5 text-primary" />}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{o.desc}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={busy} size="lg">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------ STEP 2 ------------------ */
function Step2({
  countries,
  selected,
  onBack,
  onContinue,
}: {
  countries: BankCountry[];
  selected: string | null;
  onBack: () => void;
  onContinue: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(selected);
  const filtered = countries.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Select Country</h1>
        <p className="mt-2 text-muted-foreground">Templates will be filtered by country.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search countries" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((c) => (
          <button
            key={c.code}
            onClick={() => setPick(c.code)}
            className={cn(
              "flex flex-col items-start rounded-lg border-2 bg-card p-4 text-left transition hover:shadow-sm",
              pick === c.code ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
          >
            <span className="text-3xl">{c.flag_emoji}</span>
            <span className="mt-2 font-medium">{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.currency} · {c.default_language.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={() => pick && onContinue(pick)} disabled={!pick} />
    </div>
  );
}

/* ------------------ STEP 3 ------------------ */
/* ------------------ STEP 3 — Global Banking Library ------------------ */
function Step3({
  templates,
  countries,
  loading,
  mode,
  defaultCountry,
  selectedId,
  onBack,
  onSelect,
  onSkip,
}: {
  templates: BankTemplate[];
  countries: BankCountry[];
  loading: boolean;
  mode: "template" | "custom";
  defaultCountry: string | null;
  selectedId: string | null;
  onBack: () => void;
  onSelect: (t: BankTemplate) => void;
  onSkip: () => void;
}) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>(defaultCountry ?? "all");
  const [region, setRegion] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [currency, setCurrency] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [theme, setTheme] = useState<string>("all");
  const [preview, setPreview] = useState<BankTemplate | null>(null);

  const countryByCode = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.code, c])),
    [countries],
  );

  const regions = useMemo(
    () => Array.from(new Set(countries.map((c) => c.region))).sort(),
    [countries],
  );
  const currencies = useMemo(
    () => Array.from(new Set(templates.map((t) => t.currency))).sort(),
    [templates],
  );
  const languages = useMemo(
    () => Array.from(new Set(templates.map((t) => t.language))).sort(),
    [templates],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return templates.filter((t) => {
      const c = countryByCode[t.country_code];
      if (country !== "all" && t.country_code !== country) return false;
      if (region !== "all" && t.region !== region) return false;
      if (category !== "all" && t.category !== category) return false;
      if (currency !== "all" && t.currency !== currency) return false;
      if (language !== "all" && t.language !== language) return false;
      if (theme !== "all" && t.theme !== theme) return false;
      if (!query) return true;
      return (
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.region.toLowerCase().includes(query) ||
        (c?.name.toLowerCase().includes(query) ?? false) ||
        t.country_code.toLowerCase().includes(query)
      );
    });
  }, [templates, countryByCode, q, country, region, category, currency, language, theme]);

  const grouped = useMemo(() => {
    const map = new Map<string, BankTemplate[]>();
    for (const t of filtered) {
      const arr = map.get(t.country_code) ?? [];
      arr.push(t);
      map.set(t.country_code, arr);
    }
    return Array.from(map.entries())
      .map(([code, list]) => ({ country: countryByCode[code], list }))
      .filter((g) => g.country)
      .sort((a, b) => a.country.name.localeCompare(b.country.name));
  }, [filtered, countryByCode]);

  const resetFilters = () => {
    setQ(""); setCountry("all"); setRegion("all"); setCategory("all");
    setCurrency("all"); setLanguage("all"); setTheme("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Global Banking Library</h1>
          <p className="mt-2 text-muted-foreground">
            {templates.length} templates across {regions.length} regions. Search, filter, preview, then clone one.
          </p>
        </div>
        {mode === "custom" && (
          <Button variant="outline" onClick={onSkip}>Skip — build from scratch</Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search bank name, country, region, or category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <FilterSelect label="Country" value={country} onChange={setCountry}
              options={[{ v: "all", l: "All countries" }, ...countries.map((c) => ({ v: c.code, l: `${c.flag_emoji} ${c.name}` }))]} />
            <FilterSelect label="Region" value={region} onChange={setRegion}
              options={[{ v: "all", l: "All regions" }, ...regions.map((r) => ({ v: r, l: r }))]} />
            <FilterSelect label="Category" value={category} onChange={setCategory}
              options={[{ v: "all", l: "All categories" }, ...CATEGORY_OPTIONS.map((c) => ({ v: c, l: c }))]} />
            <FilterSelect label="Currency" value={currency} onChange={setCurrency}
              options={[{ v: "all", l: "All" }, ...currencies.map((c) => ({ v: c, l: c }))]} />
            <FilterSelect label="Language" value={language} onChange={setLanguage}
              options={[{ v: "all", l: "All" }, ...languages.map((l) => ({ v: l, l: l.toUpperCase() }))]} />
            <FilterSelect label="Theme" value={theme} onChange={setTheme}
              options={[{ v: "all", l: "All" }, { v: "light", l: "Light" }, { v: "dark", l: "Dark" }]} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {templates.length} templates</span>
            <button className="underline" onClick={resetFilters}>Reset filters</button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-muted-foreground">Loading templates…</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No templates match these filters.
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ country: c, list }) => (
            <section key={c.code} className="space-y-4">
              <div className="flex items-center gap-3 border-b pb-2">
                <span className="text-3xl">{c.flag_emoji}</span>
                <div>
                  <h2 className="text-xl font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {c.region} · {c.currency} · {c.default_language.toUpperCase()} · {list.length} templates
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <TemplateCard
                    key={t.id}
                    t={t}
                    country={c}
                    active={selectedId === t.id}
                    onPreview={() => setPreview(t)}
                    onUse={() => onSelect(t)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <NavRow onBack={onBack} hideNext />
      <TemplatePreviewModal
        template={preview}
        country={preview ? countryByCode[preview.country_code] : undefined}
        onClose={() => setPreview(null)}
        onUse={(t) => {
          setPreview(null);
          onSelect(t);
        }}
      />
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TemplateCard({
  t,
  country,
  active,
  onPreview,
  onUse,
}: {
  t: BankTemplate;
  country: BankCountry;
  active: boolean;
  onPreview: () => void;
  onUse: () => void;
}) {
  const updated = new Date(t.updated_at);
  const daysAgo = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
  const isRecent = daysAgo <= 30;
  return (
    <Card className={cn("overflow-hidden transition hover:shadow-lg", active && "ring-2 ring-primary")}>
      <div
        className="relative h-40"
        style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="text-xs opacity-80">{t.category}</div>
            <div className="flex flex-col items-end gap-1">
              {t.is_premium && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Premium</Badge>}
              {isRecent && <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Updated</Badge>}
            </div>
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">{t.name}</div>
            <div className="mt-1 text-xs opacity-90">{country.flag_emoji} {country.name}</div>
            <div className="mt-2 h-2 w-16 rounded-full" style={{ backgroundColor: t.accent_color }} />
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
        <div className="flex flex-wrap gap-1 text-xs">
          <Badge variant="outline">{t.currency}</Badge>
          <Badge variant="outline">{t.language.toUpperCase()}</Badge>
          <Badge variant="outline">{t.theme === "dark" ? "Dark" : "Light"}</Badge>
          {t.mobile_support && <Badge variant="outline">Responsive</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="h-3 w-3" />
          <Tablet className="h-3 w-3" />
          <Smartphone className="h-3 w-3" />
          <span>· {t.pages.length} pages · {t.features.length} features</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {t.features.slice(0, 4).map((f) => (
            <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
          ))}
          {t.features.length > 4 && (
            <Badge variant="outline" className="text-xs">+{t.features.length - 4}</Badge>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onPreview} className="flex-1">
            <Eye className="mr-1 h-4 w-4" /> Preview
          </Button>
          <Button size="sm" onClick={onUse} className="flex-1">Use Template</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------ STEP 4 (modal) ------------------ */
function TemplatePreviewModal({
  template,
  country,
  onClose,
  onUse,
}: {
  template: BankTemplate | null;
  country?: BankCountry;
  onClose: () => void;
  onUse: (t: BankTemplate) => void;
}) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [pageIndex, setPageIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (template) {
      setPageIndex(0);
      setAnimKey((k) => k + 1);
    }
  }, [template]);

  if (!template) return null;
  const pages = template.pages;
  const page = pages[pageIndex] ?? pages[0];
  const frameWidth = device === "desktop" ? 960 : device === "tablet" ? 640 : 320;
  const goPrev = () => { setPageIndex((i) => (i - 1 + pages.length) % pages.length); setAnimKey((k) => k + 1); };
  const goNext = () => { setPageIndex((i) => (i + 1) % pages.length); setAnimKey((k) => k + 1); };

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] p-0 sm:max-w-6xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{template.name}</span>
            {country && <span className="text-sm font-normal text-muted-foreground">— {country.flag_emoji} {country.name}</span>}
            {template.is_premium && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Premium</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Tabs value={device} onValueChange={(v) => setDevice(v as typeof device)}>
            <TabsList>
              <TabsTrigger value="desktop"><Monitor className="mr-1 h-4 w-4" />Desktop</TabsTrigger>
              <TabsTrigger value="tablet"><Tablet className="mr-1 h-4 w-4" />Tablet</TabsTrigger>
              <TabsTrigger value="mobile"><Smartphone className="mr-1 h-4 w-4" />Mobile</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={goPrev} aria-label="Previous page">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[8rem] text-center text-sm font-medium">
              {page} <span className="text-muted-foreground">({pageIndex + 1}/{pages.length})</span>
            </div>
            <Button size="icon" variant="outline" onClick={goNext} aria-label="Next page">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 border-b px-4 py-2">
          {pages.map((p, i) => (
            <button
              key={p}
              onClick={() => { setPageIndex(i); setAnimKey((k) => k + 1); }}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition",
                i === pageIndex ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-auto bg-muted p-4">
          <div
            key={animKey}
            className="mx-auto overflow-hidden rounded-lg border bg-background shadow-sm animate-fade-in"
            style={{ maxWidth: frameWidth }}
          >
            <TemplatePagePreview template={template} page={page} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onUse(template)}>Use this template</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePagePreview({ template, page }: { template: BankTemplate; page: string }) {
  const style = {
    "--tp": template.primary_color,
    "--ts": template.secondary_color,
    "--ta": template.accent_color,
  } as React.CSSProperties;
  const dark = template.theme === "dark";
  return (
    <div style={style} className={cn("min-h-[400px] w-full", dark && "bg-neutral-950 text-neutral-100")}>
      <div
        className="flex items-center justify-between px-4 py-3 text-sm text-white"
        style={{ backgroundColor: template.primary_color }}
      >
        <span className="font-bold">{template.name}</span>
        <span className="opacity-80">{page}</span>
      </div>
      <div className="space-y-3 p-4">
        {page === "Homepage" && (
          <>
            <div
              className="h-32 rounded-lg"
              style={{ background: `linear-gradient(135deg, ${template.primary_color}, ${template.secondary_color})` }}
            />
            <div className="grid grid-cols-3 gap-2">
              {["Save", "Send", "Invest"].map((k) => (
                <div key={k} className="rounded border p-3 text-center text-xs">{k}</div>
              ))}
            </div>
          </>
        )}
        {page === "Dashboard" && (
          <>
            <div className="rounded-lg border p-4">
              <div className="text-xs opacity-70">Total balance</div>
              <div className="text-2xl font-bold">{template.currency} 24,850.32</div>
              <div className="mt-2 h-1 w-24 rounded" style={{ backgroundColor: template.accent_color }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-3 text-xs">Recent activity</div>
              <div className="rounded border p-3 text-xs">Cards on file</div>
            </div>
          </>
        )}
        {(page === "Login" || page === "Registration") && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="text-sm font-medium">{page} form</div>
            <div className="h-8 rounded bg-muted" />
            <div className="h-8 rounded bg-muted" />
            <div className="h-8 rounded" style={{ backgroundColor: template.primary_color }} />
          </div>
        )}
        {page === "Transfer" && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="text-sm font-medium">Send money</div>
            <div className="h-8 rounded bg-muted" />
            <div className="h-8 rounded bg-muted" />
            <div className="h-10 rounded" style={{ backgroundColor: template.accent_color }} />
          </div>
        )}
        {page === "Cards" && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl p-3 text-xs text-white"
                style={{ background: `linear-gradient(135deg, ${template.primary_color}, ${template.accent_color})` }}
              >
                •••• 4{i}12
              </div>
            ))}
          </div>
        )}
        {(page === "Transactions" || page === "Statements" || page === "Notifications" || page === "Profile") && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="text-sm font-medium">{page} item {i + 1}</div>
                  <div className="text-xs opacity-70">Sample content</div>
                </div>
                <div
                  className="h-6 w-14 rounded text-center text-xs leading-6 text-white"
                  style={{ backgroundColor: template.accent_color }}
                >View</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ------------------ STEP 5 ------------------ */
function Step5({
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

/* ------------------ STEP 6 ------------------ */
function Step6({
  branding,
  onBack,
  onContinue,
}: {
  branding: Partial<BankBranding>;
  onBack: () => void;
  onContinue: (b: BankBranding) => void;
}) {
  const [b, setB] = useState<BankBranding>({
    primary_color: branding.primary_color ?? "#0a2540",
    secondary_color: branding.secondary_color ?? "#1e88e5",
    accent_color: branding.accent_color ?? "#00c48c",
    font_heading: branding.font_heading ?? "Inter",
    font_body: branding.font_body ?? "Inter",
    logo_url: branding.logo_url ?? "",
    favicon_url: branding.favicon_url ?? "",
    hero_image_url: branding.hero_image_url ?? "",
    button_style: branding.button_style ?? "rounded",
    border_radius: branding.border_radius ?? 8,
    dark_mode: branding.dark_mode ?? false,
  });
  const set = <K extends keyof BankBranding>(k: K, v: BankBranding[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Branding</h1>
        <p className="mt-2 text-muted-foreground">Style your bank.</p>
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
            <Field label="Logo URL">
              <Input value={b.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Favicon URL">
              <Input value={b.favicon_url} onChange={(e) => set("favicon_url", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Hero Image URL">
              <Input value={b.hero_image_url} onChange={(e) => set("hero_image_url", e.target.value)} placeholder="https://…" />
            </Field>
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
              className={cn("rounded-xl p-4 text-white", b.dark_mode && "text-white")}
              style={{
                background: `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`,
                borderRadius: b.border_radius,
                fontFamily: b.font_body,
              }}
            >
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

/* ------------------ STEP 7/8/9 (toggle grids) ------------------ */
function ToggleGrid({
  title,
  subtitle,
  options,
  values,
  onChange,
}: {
  title: string;
  subtitle: string;
  options: readonly string[];
  values: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const on = !!values[o];
          return (
            <button
              key={o}
              onClick={() => onChange({ ...values, [o]: !on })}
              className={cn(
                "flex items-center justify-between rounded-lg border-2 bg-card p-4 text-left transition hover:shadow-sm",
                on ? "border-primary" : "border-border",
              )}
            >
              <span className="font-medium">{o}</span>
              <Switch checked={on} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step7({
  features,
  onBack,
  onContinue,
}: {
  features: Record<string, boolean>;
  onBack: () => void;
  onContinue: (f: Record<string, boolean>) => void;
}) {
  const [v, setV] = useState(features);
  return (
    <div className="space-y-6">
      <ToggleGrid title="Feature Selection" subtitle="Enable the customer-facing features for this bank." options={FEATURE_OPTIONS} values={v} onChange={setV} />
      <NavRow onBack={onBack} onNext={() => onContinue(v)} />
    </div>
  );
}

function Step8({
  simulation,
  onBack,
  onContinue,
}: {
  simulation: Record<string, boolean>;
  onBack: () => void;
  onContinue: (s: Record<string, boolean>) => void;
}) {
  const [v, setV] = useState(simulation);
  return (
    <div className="space-y-6">
      <ToggleGrid title="Simulation Controls" subtitle="Configure simulated banking behaviours for demos and testing." options={SIMULATION_OPTIONS} values={v} onChange={setV} />
      <NavRow onBack={onBack} onNext={() => onContinue(v)} />
    </div>
  );
}

function Step9({
  admin,
  onBack,
  onContinue,
}: {
  admin: Record<string, boolean>;
  onBack: () => void;
  onContinue: (a: Record<string, boolean>) => void;
}) {
  const [v, setV] = useState(admin);
  return (
    <div className="space-y-6">
      <ToggleGrid title="Admin Controls" subtitle="Enable tools available to the bank's administrators." options={ADMIN_OPTIONS} values={v} onChange={setV} />
      <NavRow onBack={onBack} onNext={() => onContinue(v)} />
    </div>
  );
}

/* ------------------ STEP 10 ------------------ */
function Step10({
  draft,
  template,
  country,
  onBack,
  onGenerate,
  busy,
  saved,
}: {
  draft: BankDraft;
  template?: BankTemplate;
  country?: BankCountry;
  onBack: () => void;
  onGenerate: () => void;
  busy: boolean;
  saved: boolean;
}) {
  const enabled = (o: Record<string, boolean>) =>
    Object.entries(o).filter(([, v]) => v).map(([k]) => k);
  const identity = draft.identity as Partial<BankIdentity>;
  const branding = draft.branding as Partial<BankBranding>;
  const url = identity?.subdomain
    ? `${identity.subdomain}.themixweb.app`
    : "your-bank.themixweb.app";

  const rows = useMemo(
    () => [
      { label: "Mode", value: draft.mode === "template" ? "Template" : "Custom" },
      { label: "Country", value: country ? `${country.flag_emoji} ${country.name}` : "—" },
      { label: "Template", value: template?.name ?? "Custom build" },
      { label: "Bank name", value: identity?.bank_name ?? "—" },
      { label: "URL", value: url },
      { label: "Currency", value: identity?.currency ?? "—" },
      { label: "Timezone", value: identity?.timezone ?? "—" },
      { label: "Language", value: identity?.language ?? "—" },
    ],
    [draft, country, template, identity, url],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review</h1>
        <p className="mt-2 text-muted-foreground">Confirm your configuration and save it. Nothing is published.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 border-b py-1 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-right">{r.value}</span>
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
        <SummaryList title="Features" items={enabled(draft.features)} />
        <SummaryList title="Simulation Settings" items={enabled(draft.simulation)} />
        <SummaryList title="Admin Controls" items={enabled(draft.admin_controls)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="text-sm">
          {saved ? (
            <span className="font-medium text-primary">✓ Configuration saved (not published)</span>
          ) : (
            <span className="text-muted-foreground">Nothing has been published yet. Only your configuration will be saved.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={onGenerate} disabled={busy} size="lg">
            {saved ? "Save changes" : "Generate Bank"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">None enabled</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {items.map((i) => (
              <Badge key={i} variant="secondary">{i}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------ Nav ------------------ */
function NavRow({
  onBack,
  onNext,
  disabled,
  hideNext,
}: {
  onBack: () => void;
  onNext?: () => void;
  disabled?: boolean;
  hideNext?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      {!hideNext && onNext && (
        <Button onClick={onNext} disabled={disabled}>
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
