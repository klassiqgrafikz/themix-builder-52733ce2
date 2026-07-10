// GBOC Domain Manager — production-grade Custom Domain Setup Wizard.
//
// Wizard flow: 1) Select bank → 2) Enter domain (auto apex/subdomain) →
// 3) Detect DNS provider → 4) Provider-specific instructions & records →
// live verification checklist, SSL card, connection health, diagnostics,
// activity timeline, success screen. Preserves the existing server-fn
// contracts (getBankDomain / saveBankDomain / verifyBankDomain /
// diagnoseBankDomain / removeBankDomain) and adds listDomainActivity +
// detectDnsProvider.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import {
  getBankDomain,
  saveBankDomain,
  verifyBankDomain,
  removeBankDomain,
  diagnoseBankDomain,
  type BankDomain,
  type DnsRecord,
  type DomainDiagnostics,
  type DiagnosticCheck,
  type DiagnosticStatus,
} from "@/lib/gboc/domains.functions";
import {
  detectDnsProvider,
  listDomainActivity,
  type DnsProvider,
  type DomainActivityEntry,
} from "@/lib/gboc/domain-activity.functions";
import {
  deriveStage,
  stageIsTerminal,
  nextRetryDelayMs,
  getPersistedStart,
  persistStart,
  clearPersistedStart,
  HEALTH_CHECK_INTERVAL_MS,
  LIFECYCLE_LABEL,
  LIFECYCLE_ORDER,
  TIMELINE_ITEMS,
  type LifecycleStage,
} from "@/lib/gboc/domain-lifecycle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Clock,
  CalendarClock,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Info,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Server,
  Route as RouteIcon,
  Timer,
  Pause,
  Play,
  PartyPopper,
  ChevronRight,
  ClipboardList,
  ArrowLeft,
  Building2,
  Cloud,
} from "lucide-react";

const searchSchema = z.object({ bank: z.string().uuid().optional() });

export const Route = createFileRoute("/gboc/domains")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Domain Manager — GBOC" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DomainManagerPage,
});

function DomainManagerPage() {
  const { bank } = Route.useSearch();
  const navigate = useNavigate();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];
  const selectedBank = banks.find((b) => b.id === bank) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Domain Setup Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guided, enterprise-grade custom domain onboarding for every generated
          bank. Auto-detects apex vs subdomain and your DNS provider, then walks
          you through verification, SSL and routing.
        </p>
      </div>

      {!selectedBank ? (
        <BankPickerStep
          banks={banks}
          loading={banksQ.isLoading}
          onPick={(id) =>
            navigate({ to: "/gboc/domains", search: { bank: id || undefined } })
          }
        />
      ) : (
        <Wizard
          bankId={selectedBank.id}
          bankName={selectedBank.bank_name}
          onChangeBank={() =>
            navigate({ to: "/gboc/domains", search: { bank: undefined } })
          }
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 1 — Bank picker
function BankPickerStep({
  banks,
  loading,
  onPick,
}: {
  banks: Array<{ id: string; bank_name: string; country?: string | null }>;
  loading: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" /> Step 1 · Select a bank
        </CardTitle>
        <CardDescription>
          Choose which generated bank you want to connect a custom domain to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-md">
          <Label className="text-xs text-muted-foreground">Bank</Label>
          <Select value="" onValueChange={onPick}>
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading banks…"
                    : banks.length
                      ? "Select a generated bank…"
                      : "No published banks yet"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.country ? ` · ${b.country}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function Wizard({
  bankId,
  bankName,
  onChangeBank,
}: {
  bankId: string;
  bankName: string;
  onChangeBank: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getBankDomain);
  const saveFn = useServerFn(saveBankDomain);
  const verifyFn = useServerFn(verifyBankDomain);
  const removeFn = useServerFn(removeBankDomain);
  const diagnoseFn = useServerFn(diagnoseBankDomain);
  const providerFn = useServerFn(detectDnsProvider);
  const activityFn = useServerFn(listDomainActivity);

  const q = useQuery({
    queryKey: ["gboc", "domain", bankId],
    queryFn: () => getFn({ data: { bank_id: bankId } }),
  });

  const row: BankDomain | null = q.data ?? null;

  const activityQ = useQuery({
    queryKey: ["gboc", "domain", bankId, "activity"],
    queryFn: () => activityFn({ data: { bank_id: bankId, limit: 30 } }),
  });

  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [diagnostics, setDiagnostics] = useState<DomainDiagnostics | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [provider, setProvider] = useState<DnsProvider | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [, forceTick] = useState(0);
  const propagationStartRef = useRef<number | null>(null);

  useEffect(() => {
    setDomain(row?.domain ?? "");
    setIsPrimary(row?.is_primary ?? true);
    setDiagnostics(null);
    setLastCheckedAt(null);
    setProvider(null);
    setShowSuccess(false);
    setAutoPaused(false);
  }, [bankId, row?.domain, row?.is_primary]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });
  }, [qc, bankId]);
  const invalidateActivity = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId, "activity"] });
  }, [qc, bankId]);

  const detectedKind = useMemo<"apex" | "subdomain" | null>(() => {
    const d = domain.trim().toLowerCase();
    if (!d) return null;
    const labels = d.split(".").filter(Boolean);
    if (labels.length < 2) return null;
    if (labels.length <= 2) return "apex";
    const lastTwo = labels.slice(-2).join(".");
    const twoPart = new Set([
      "co.uk","org.uk","gov.uk","ac.uk","co.jp","or.jp","ne.jp","com.au",
      "net.au","org.au","com.br","com.mx","co.nz","co.za","co.in","co.kr",
      "com.sg","com.hk","com.tr","com.tw","com.cn","com.ar","com.co",
    ]);
    if (twoPart.has(lastTwo) && labels.length === 3) return "apex";
    return "subdomain";
  }, [domain]);

  const runProviderDetection = useCallback(
    async (targetDomain: string) => {
      if (!targetDomain) return;
      try {
        const p = await providerFn({ data: { domain: targetDomain } });
        setProvider(p);
      } catch {
        // non-fatal
      }
    },
    [providerFn],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({ data: { bank_id: bankId, domain: domain.trim(), is_primary: isPrimary } }),
    onSuccess: async (saved) => {
      toast.success("Domain saved. Publish the DNS records below, then Verify.");
      invalidate();
      invalidateActivity();
      if (saved?.domain) runProviderDetection(saved.domain);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const verifyMut = useMutation({
    mutationFn: () =>
      verifyFn({ data: { bank_id: bankId } }) as unknown as Promise<{
        domain: BankDomain;
        diagnostics: DomainDiagnostics;
      }>,
    onSuccess: (res) => {
      setDiagnostics(res.diagnostics);
      setLastCheckedAt(Date.now());
      if (res.diagnostics.overall === "verified") {
        toast.success("Domain verified. Custom domain is live.");
        setShowSuccess(true);
      } else if (res.diagnostics.overall === "propagating") {
        toast.info("DNS is still propagating. We'll auto-recheck every 60s.");
        if (!propagationStartRef.current) propagationStartRef.current = Date.now();
      } else {
        toast.error("Verification failed. See the checklist below.");
      }
      invalidate();
      invalidateActivity();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Verification failed");
      invalidate();
      invalidateActivity();
    },
  });

  const diagnoseMut = useMutation({
    mutationFn: () =>
      diagnoseFn({ data: { bank_id: bankId } }) as unknown as Promise<DomainDiagnostics | null>,
    onSuccess: (res) => {
      if (res) {
        setDiagnostics(res);
        setLastCheckedAt(Date.now());
        if (res.overall === "propagating" && !propagationStartRef.current) {
          propagationStartRef.current = Date.now();
        }
        if (res.overall === "verified") setShowSuccess(true);
      }
    },
  });

  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Custom domain removed. The fallback URL still works.");
      setDomain("");
      setDiagnostics(null);
      setProvider(null);
      setShowSuccess(false);
      invalidate();
      invalidateActivity();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const domainSaved = Boolean(row?.domain);
  const propagating =
    !autoPaused &&
    (diagnostics?.overall === "propagating" || row?.dns_status === "propagating");

  // Auto-recheck every 60s while propagating.
  useEffect(() => {
    if (!domainSaved || !propagating) return;
    const id = window.setInterval(() => diagnoseMut.mutate(), 60_000);
    return () => window.clearInterval(id);
  }, [domainSaved, propagating, diagnoseMut]);

  // Ticking clock for "Last checked: Xs ago" + propagation remaining.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Kick provider detection when we already have a saved domain.
  useEffect(() => {
    if (row?.domain && !provider) runProviderDetection(row.domain);
  }, [row?.domain, provider, runProviderDetection]);

  const overallVerified =
    row?.status === "connected" && row?.dns_status === "verified";

  if (showSuccess && overallVerified && row?.domain) {
    return (
      <SuccessScreen
        bankName={bankName}
        domain={row.domain}
        onManageAnother={onChangeBank}
        onContinue={() => setShowSuccess(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <WizardHeader
        bankName={bankName}
        row={row}
        provider={provider}
        detectedKind={detectedKind}
        onChangeBank={onChangeBank}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-1">
          <OverviewCard bankName={bankName} row={row} diagnostics={diagnostics} />
          <SslCard row={row} />
          <HealthCard
            diagnostics={diagnostics}
            row={row}
            lastCheckedAt={lastCheckedAt}
            onRecheck={() => diagnoseMut.mutate()}
            isChecking={diagnoseMut.isPending || verifyMut.isPending}
            canRecheck={domainSaved}
          />
          <DiagnosticsCard diagnostics={diagnostics} row={row} />
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          <StepDomainCard
            domain={domain}
            setDomain={setDomain}
            isPrimary={isPrimary}
            setIsPrimary={setIsPrimary}
            detectedKind={detectedKind}
            saveMut={saveMut}
            verifyMut={verifyMut}
            diagnoseMut={diagnoseMut}
            removeMut={removeMut}
            domainSaved={domainSaved}
            bankName={bankName}
          />

          <ProviderCard
            provider={provider}
            detecting={false}
            domain={row?.domain ?? null}
            onRedetect={() => row?.domain && runProviderDetection(row.domain)}
          />

          <DnsInstructionsCard row={row} provider={provider} />

          <ChecklistCard
            row={row}
            diagnostics={diagnostics}
            propagationStart={propagationStartRef.current}
            autoPaused={autoPaused}
            onToggleAuto={() => setAutoPaused((v) => !v)}
            onVerifyNow={() => verifyMut.mutate()}
            onForceRecheck={() => diagnoseMut.mutate()}
            verifying={verifyMut.isPending}
            rechecking={diagnoseMut.isPending}
            canVerify={domainSaved}
          />

          <DiagnosticsBreakdown diagnostics={diagnostics} />

          <ResolverPanel diagnostics={diagnostics} />


          <ActivityCard
            entries={activityQ.data ?? []}
            loading={activityQ.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Header with breadcrumb + high-level stepper.
function WizardHeader({
  bankName,
  row,
  provider,
  detectedKind,
  onChangeBank,
}: {
  bankName: string;
  row: BankDomain | null;
  provider: DnsProvider | null;
  detectedKind: "apex" | "subdomain" | null;
  onChangeBank: () => void;
}) {
  const domainKind = row?.domain_kind ?? detectedKind ?? null;
  const verified = row?.status === "connected" && row?.dns_status === "verified";
  const steps = [
    { key: "bank", label: "Select bank", done: true },
    { key: "domain", label: "Enter domain", done: Boolean(row?.domain) },
    {
      key: "provider",
      label: "Detect provider",
      done: Boolean(provider && provider.id !== "unknown"),
    },
    { key: "records", label: "Publish DNS", done: (row?.dns_records?.length ?? 0) > 0 },
    { key: "verify", label: "Verify", done: verified },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={onChangeBank}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Change bank
          </Button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{bankName}</span>
          {domainKind ? (
            <Badge variant="outline" className="ml-1 capitalize">
              <Check className="mr-1 h-3 w-3" />
              {domainKind === "apex" ? "Apex Domain" : "Subdomain"}
            </Badge>
          ) : null}
          {provider ? (
            <Badge
              variant={provider.id === "unknown" ? "secondary" : "default"}
              className="ml-1"
            >
              <Cloud className="mr-1 h-3 w-3" />
              {provider.name}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  s.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-xs ${s.done ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 ? (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              ) : null}
            </div>
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}

// -----------------------------------------------------------------------------
type SaveMut = ReturnType<typeof useMutation<BankDomain, unknown, void, unknown>>;
type VoidMut = { mutate: () => void; isPending: boolean };

function StepDomainCard({
  domain,
  setDomain,
  isPrimary,
  setIsPrimary,
  detectedKind,
  saveMut,
  verifyMut,
  diagnoseMut,
  removeMut,
  domainSaved,
  bankName,
}: {
  domain: string;
  setDomain: (v: string) => void;
  isPrimary: boolean;
  setIsPrimary: (v: boolean) => void;
  detectedKind: "apex" | "subdomain" | null;
  saveMut: SaveMut;
  verifyMut: VoidMut;
  diagnoseMut: VoidMut;
  removeMut: VoidMut;
  domainSaved: boolean;
  bankName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Step 2 · Enter your custom domain</CardTitle>
        <CardDescription>
          Use an apex like <code>bankofa.online</code> or a subdomain like{" "}
          <code>portal.bankofa.online</code>. We'll auto-detect and generate the
          right DNS records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!domain.trim()) {
              toast.error("Enter a domain");
              return;
            }
            saveMut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="domain">Custom Domain</Label>
            <div className="flex gap-2">
              <Input
                id="domain"
                autoComplete="off"
                spellCheck={false}
                placeholder="portal.example.com or example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              {detectedKind ? (
                <Badge variant="outline" className="shrink-0 self-center">
                  <Check className="mr-1 h-3 w-3 text-emerald-600" />
                  {detectedKind === "apex" ? "Apex Domain" : "Subdomain"}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {detectedKind === "apex"
                ? "Apex domains use A records pointing to TheMixWeb's edge."
                : detectedKind === "subdomain"
                  ? "Subdomains use a CNAME to themix-builder.lovable.app."
                  : "We auto-detect apex vs subdomain as you type."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Prefer this domain as the primary route once verified
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : domainSaved ? "Update Domain" : "Save Domain"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!domainSaved || verifyMut.isPending}
              onClick={() => verifyMut.mutate()}
            >
              {verifyMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify Now
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!domainSaved || diagnoseMut.isPending}
              onClick={() => diagnoseMut.mutate()}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${diagnoseMut.isPending ? "animate-spin" : ""}`}
              />
              Force Recheck
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={!domainSaved || removeMut.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Domain
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove custom domain?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The custom domain for <strong>{bankName}</strong> will be
                    deleted. Your Lovable fallback URL keeps working.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeMut.mutate()}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function ProviderCard({
  provider,
  detecting,
  domain,
  onRedetect,
}: {
  provider: DnsProvider | null;
  detecting: boolean;
  domain: string | null;
  onRedetect: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Step 3 · Detected DNS provider</CardTitle>
          <CardDescription>
            {domain
              ? "We auto-detect your provider from live nameserver records."
              : "Save a domain to detect your DNS provider."}
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!domain || detecting}
          onClick={onRedetect}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} />
          Redetect
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!domain ? (
          <p className="text-sm text-muted-foreground">No domain saved yet.</p>
        ) : !provider ? (
          <p className="text-sm text-muted-foreground">Detecting…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={provider.id === "unknown" ? "secondary" : "default"}
                className="text-sm"
              >
                <Cloud className="mr-1 h-3.5 w-3.5" />
                {provider.name}
              </Badge>
              {provider.nameservers.length ? (
                <span className="text-xs text-muted-foreground truncate">
                  NS: {provider.nameservers.slice(0, 2).join(", ")}
                  {provider.nameservers.length > 2 ? "…" : ""}
                </span>
              ) : null}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {provider.instructions.title}
              </div>
              <ol className="ml-5 list-decimal space-y-1 text-sm">
                {provider.instructions.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function ChecklistCard({
  row,
  diagnostics,
  propagationStart,
  autoPaused,
  onToggleAuto,
  onVerifyNow,
  onForceRecheck,
  verifying,
  rechecking,
  canVerify,
}: {
  row: BankDomain | null;
  diagnostics: DomainDiagnostics | null;
  propagationStart: number | null;
  autoPaused: boolean;
  onToggleAuto: () => void;
  onVerifyNow: () => void;
  onForceRecheck: () => void;
  verifying: boolean;
  rechecking: boolean;
  canVerify: boolean;
}) {
  const ssl = row?.ssl_status ?? "inactive";
  const propagation = diagnostics?.meta.propagation_percent ?? 0;
  const propagating = diagnostics?.overall === "propagating" || row?.dns_status === "propagating";

  // Estimated remaining time (rough): assumes ~30 min avg propagation.
  const remainingText = useMemo(() => {
    if (!propagating) return null;
    if (propagation >= 100) return "Almost done";
    const elapsedMs = propagationStart ? Date.now() - propagationStart : 0;
    const totalGuess = Math.max(15 * 60_000, elapsedMs * (100 / Math.max(propagation, 5)));
    const remaining = Math.max(1 * 60_000, totalGuess - elapsedMs);
    const minutes = Math.round(remaining / 60_000);
    if (minutes < 60) return `~${minutes} min remaining`;
    return `~${Math.round(minutes / 60)}h remaining`;
  }, [propagating, propagation, propagationStart]);

  const items: Array<{ label: string; status: DiagnosticStatus; hint?: string }> = [
    {
      label: "Domain saved",
      status: row?.domain ? "pass" : "pending",
      hint: row?.domain ?? "Enter and save a domain",
    },
    {
      label: "Nameservers reachable",
      status: diagnostics?.meta.ttl != null ? "pass" : "pending",
      hint: diagnostics?.meta.ttl != null ? `TTL ${diagnostics.meta.ttl}s` : "—",
    },
    {
      label: "DNS propagated",
      status: propagation >= 80 ? "pass" : propagation > 0 ? "warn" : "pending",
      hint: `${propagation}%`,
    },
    {
      label: "TXT verified",
      status: statusFromCheck(diagnostics, ["txt"]),
    },
    {
      label: row?.domain_kind === "apex" ? "A records verified" : "CNAME verified",
      status: statusFromCheck(diagnostics, ["a", "cname"]),
    },
    {
      label: "SSL certificate requested",
      status:
        ssl === "active" || ssl === "issuing" || ssl === "requesting" || ssl === "pending"
          ? "pass"
          : "pending",
      hint: ssl,
    },
    {
      label: "SSL active",
      status: ssl === "active" ? "pass" : ssl === "error" || ssl === "expired" ? "fail" : "pending",
      hint: ssl,
    },
    {
      label: "Routing connected",
      status: statusFromCheck(diagnostics, ["routing"]),
      hint: diagnostics?.meta.routing_active ? "Active" : "—",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Live verification checklist</CardTitle>
          <CardDescription>
            Real-time DNS, SSL and routing status. Auto-rechecks every 60s while
            propagating.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={!canVerify || verifying} onClick={onVerifyNow}>
            {verifying ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            )}
            Verify Now
          </Button>
          <Button size="sm" variant="ghost" disabled={!canVerify || rechecking} onClick={onForceRecheck}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${rechecking ? "animate-spin" : ""}`} />
            Force Recheck
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleAuto} disabled={!canVerify}>
            {autoPaused ? (
              <>
                <Play className="mr-1 h-3.5 w-3.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="mr-1 h-3.5 w-3.5" /> Pause Auto
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Propagation</span>
            <span>
              {propagation}%{remainingText ? ` · ${remainingText}` : ""}
            </span>
          </div>
          <Progress value={propagation} />
          {propagating ? (
            <p className="text-xs text-muted-foreground">
              Still propagating worldwide. DNS changes typically take 15–60 minutes.
            </p>
          ) : null}
        </div>

        <Separator />

        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <StatusDot status={it.status} />
                {it.label}
              </span>
              {it.hint ? (
                <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                  {it.hint}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {diagnostics && diagnostics.overall === "failed" ? (
          <FriendlyError diagnostics={diagnostics} onRetry={onVerifyNow} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function FriendlyError({
  diagnostics,
  onRetry,
}: {
  diagnostics: DomainDiagnostics;
  onRetry: () => void;
}) {
  const failed = diagnostics.checks.find((c) => c.status === "fail");
  if (!failed) return null;
  const expected = failed.expected?.join(", ") || "—";
  const found = failed.found?.length ? failed.found.join(", ") : "None";
  const hint =
    failed.key === "txt" || failed.key === "cname" || failed.key === "a"
      ? "This usually means your DNS has not propagated yet. Estimated propagation: 15–60 minutes."
      : "Check the record above and try again.";
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <XCircle className="h-4 w-4" />
        {failed.label} failed
      </div>
      <div className="mt-1 grid gap-0.5 font-mono text-xs">
        <div>
          <span className="text-muted-foreground">Expected:</span> {expected}
        </div>
        <div>
          <span className="text-muted-foreground">Found:</span> {found}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
function ActivityCard({
  entries,
  loading,
}: {
  entries: DomainActivityEntry[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" /> Domain activity
        </CardTitle>
        <CardDescription>Every action taken on this domain.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm"
              >
                <div className="flex items-start gap-2">
                  <ActivityDot result={e.result} />
                  <div>
                    <div className="font-medium capitalize">
                      {e.action.replace(/_/g, " ")}
                    </div>
                    {e.message ? (
                      <div className="text-xs text-muted-foreground">{e.message}</div>
                    ) : null}
                    {e.domain ? (
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {e.domain}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <div>{new Date(e.created_at).toLocaleString()}</div>
                  <div className="truncate">{e.actor_id ? e.actor_id.slice(0, 8) : "system"}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityDot({ result }: { result: string }) {
  if (result === "success") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />;
  if (result === "error") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (result === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />;
  return <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}

// -----------------------------------------------------------------------------
function SuccessScreen({
  bankName,
  domain,
  onManageAnother,
  onContinue,
}: {
  bankName: string;
  domain: string;
  onManageAnother: () => void;
  onContinue: () => void;
}) {
  const url = `https://${domain}`;
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <PartyPopper className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">🎉 Domain connected successfully</CardTitle>
        <CardDescription>
          <strong>{bankName}</strong> is now live at your custom domain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-lg text-primary hover:underline"
        >
          {url}
          <ExternalLink className="h-4 w-4" />
        </a>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Open website
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success("Copied!");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy URL
          </Button>
          <Button variant="outline" onClick={onManageAnother}>
            Manage another domain
          </Button>
          <Button variant="ghost" onClick={onContinue}>
            Continue managing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function OverviewCard({
  bankName,
  row,
  diagnostics,
}: {
  bankName: string;
  row: BankDomain | null;
  diagnostics: DomainDiagnostics | null;
}) {
  const verified = row?.status === "connected" && row?.dns_status === "verified";
  const ssl = row?.ssl_status ?? "inactive";
  const dnsStatus = diagnostics?.overall ?? row?.dns_status ?? "not_configured";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" /> Domain overview
        </CardTitle>
        <CardDescription>{bankName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InfoRow label="Primary Domain" value={verified && row?.domain ? row.domain : row?.domain ?? "—"} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Fallback URL</span>
          {row?.fallback_url ? (
            <a
              href={row.fallback_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-primary hover:underline"
              title={row.fallback_url}
            >
              <span className="truncate">{row.fallback_url.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : (
            <span className="font-medium">—</span>
          )}
        </div>
        <StatusRow label="Verification" value={verified ? "verified" : dnsStatus} />
        <StatusRow label="DNS Status" value={dnsStatus} />
        <SslRow ssl={ssl} />
        <InfoRow
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Last Verification"
          value={fmtDate(row?.last_verified_at)}
        />
        <InfoRow
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Connected Since"
          value={fmtDate(row?.connected_since)}
        />
      </CardContent>
    </Card>
  );
}

function SslCard({ row }: { row: BankDomain | null }) {
  const ssl = row?.ssl_status ?? "inactive";
  const state =
    ssl === "active"
      ? "Issued"
      : ssl === "issuing" || ssl === "requesting"
        ? "Issuing"
        : ssl === "pending"
          ? "Pending"
          : ssl === "expired"
            ? "Expired"
            : ssl === "error"
              ? "Error"
              : "Inactive";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> SSL certificate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <InfoRow label="Certificate" value={state} />
        <InfoRow label="Issuer" value="Let's Encrypt (via platform)" />
        <InfoRow label="Encryption" value="TLS 1.3 · ECDSA" />
        <InfoRow label="Auto renewal" value="Enabled" />
        <InfoRow label="Last renewal" value={fmtDate(row?.last_verified_at)} />
      </CardContent>
    </Card>
  );
}

function HealthCard({
  diagnostics,
  row,
  lastCheckedAt,
  onRecheck,
  isChecking,
  canRecheck,
}: {
  diagnostics: DomainDiagnostics | null;
  row: BankDomain | null;
  lastCheckedAt: number | null;
  onRecheck: () => void;
  isChecking: boolean;
  canRecheck: boolean;
}) {
  const cards: Array<{ label: string; status: DiagnosticStatus; icon: React.ReactNode; hint: string }> = [
    {
      label: "DNS",
      status: statusFromCheck(diagnostics, ["cname", "a"]),
      icon: <Server className="h-3.5 w-3.5" />,
      hint: row?.dns_status ?? "not_configured",
    },
    {
      label: "Routing",
      status: statusFromCheck(diagnostics, ["routing"]),
      icon: <RouteIcon className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.routing_active ? "active" : "—",
    },
    {
      label: "SSL",
      status: sslToStatus(row?.ssl_status),
      icon: <Shield className="h-3.5 w-3.5" />,
      hint: row?.ssl_status ?? "inactive",
    },
    {
      label: "HTTP",
      status: statusFromCheck(diagnostics, ["http"]),
      icon: <Activity className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.http_status ? `${diagnostics.meta.http_status}` : "—",
    },
    {
      label: "HTTPS",
      status: statusFromCheck(diagnostics, ["https"]),
      icon: <Activity className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.https_status ? `${diagnostics.meta.https_status}` : "—",
    },
    {
      label: "Redirects",
      status:
        diagnostics?.meta.http_status && diagnostics.meta.http_status >= 300 && diagnostics.meta.http_status < 400
          ? "pass"
          : diagnostics?.meta.http_status
            ? "warn"
            : "pending",
      icon: <RouteIcon className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.http_status ? `HTTP ${diagnostics.meta.http_status}` : "—",
    },
    {
      label: "Latency",
      status:
        diagnostics?.meta.response_time_ms == null
          ? "pending"
          : diagnostics.meta.response_time_ms < 800
            ? "pass"
            : diagnostics.meta.response_time_ms < 2000
              ? "warn"
              : "fail",
      icon: <Timer className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.response_time_ms != null ? `${diagnostics.meta.response_time_ms} ms` : "—",
    },
    {
      label: "CDN",
      status: diagnostics?.meta.https_status ? "pass" : "pending",
      icon: <Cloud className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.https_status ? "reachable" : "—",
    },
    {
      label: "TXT",
      status: statusFromCheck(diagnostics, ["txt"]),
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.txt_records.length ? "present" : "—",
    },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Connection health</CardTitle>
          <CardDescription>
            {lastCheckedAt ? (
              <>Last checked {formatAgo(lastCheckedAt)}</>
            ) : (
              "Run Verify or Force Recheck to gather live status."
            )}
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRecheck}
          disabled={!canRecheck || isChecking}
          title="Force Recheck"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Propagation</span>
              <span>{diagnostics.meta.propagation_percent}%</span>
            </div>
            <Progress value={diagnostics.meta.propagation_percent} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c) => (
            <HealthPill key={c.label} {...c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthPill({
  label,
  status,
  icon,
  hint,
}: {
  label: string;
  status: DiagnosticStatus;
  icon: React.ReactNode;
  hint: string;
}) {
  const color =
    status === "pass"
      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      : status === "fail"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : status === "warn"
          ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          : "border-muted bg-muted/30 text-muted-foreground";
  return (
    <div className={`rounded-md border px-2.5 py-2 ${color}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
        <StatusDot status={status} />
      </div>
      <div className="mt-0.5 truncate text-[11px] opacity-80" title={hint}>
        {hint}
      </div>
    </div>
  );
}

function DiagnosticsCard({
  diagnostics,
  row,
}: {
  diagnostics: DomainDiagnostics | null;
  row: BankDomain | null;
}) {
  if (!diagnostics && !row?.domain) return null;
  const meta = diagnostics?.meta;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform diagnostics</CardTitle>
        <CardDescription>Live resolver + reachability data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <InfoRow label="Domain type" value={diagnostics?.domain_kind ?? row?.domain_kind ?? "—"} />
        <InfoRow
          label="Resolved A"
          value={meta?.resolved_a.length ? meta.resolved_a.join(", ") : "—"}
        />
        <InfoRow
          label="Resolved CNAME"
          value={meta?.resolved_cname.length ? meta.resolved_cname.join(", ") : "—"}
        />
        <InfoRow
          label="TXT Found"
          value={meta?.txt_records.length ? "Present" : "—"}
        />
        <InfoRow label="TTL" value={meta?.ttl ? `${meta.ttl}s` : "—"} />
        <InfoRow
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Server response time"
          value={meta?.response_time_ms != null ? `${meta.response_time_ms} ms` : "—"}
        />
        <InfoRow
          label="HTTP / HTTPS"
          value={`${meta?.http_status ?? "—"} / ${meta?.https_status ?? "—"}`}
        />
        <InfoRow label="Routing match" value={meta?.routing_active ? "Yes" : "No"} />
        <InfoRow label="Worker status" value={meta?.https_status ? "Active" : "—"} />
        <InfoRow label="Last verification" value={fmtDate(row?.last_verified_at)} />
      </CardContent>
    </Card>
  );
}

function DiagnosticsBreakdown({ diagnostics }: { diagnostics: DomainDiagnostics | null }) {
  if (!diagnostics) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verification check details</CardTitle>
        <CardDescription>
          Detailed per-check results from the last DNS + reachability probe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {diagnostics.checks.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
      </CardContent>
    </Card>
  );
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <StatusDot status={check.status} />
        {check.label}
        <Badge variant="outline" className="ml-auto capitalize">
          {check.status}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
      {(check.expected?.length || check.found?.length) ? (
        <div className="mt-2 grid gap-1 text-xs font-mono">
          {check.expected?.length ? (
            <div>
              <span className="text-muted-foreground">Expected: </span>
              {check.expected.join(", ")}
            </div>
          ) : null}
          {check.found?.length ? (
            <div>
              <span className="text-muted-foreground">Found: </span>
              {check.found.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DnsInstructionsCard({
  row,
  provider,
}: {
  row: BankDomain | null;
  provider: DnsProvider | null;
}) {
  const copyAll = async () => {
    if (!row?.dns_records?.length) return;
    const text = row.dns_records
      .map((r) => `${r.type}\t${r.host}\t${r.value}\t${r.ttl}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied!");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Step 4 · DNS records to publish</CardTitle>
          <CardDescription>
            {row?.domain_kind === "apex"
              ? "Apex domain — add these A records plus the TXT verification record."
              : row?.domain_kind === "subdomain"
                ? "Subdomain — add the CNAME plus the TXT verification record."
                : "Save a domain to generate the right DNS records."}
            {provider && provider.id !== "unknown"
              ? ` Provider: ${provider.name}.`
              : ""}
          </CardDescription>
        </div>
        {row?.dns_records?.length ? (
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy all
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {row?.dns_records?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-20">TTL</TableHead>
                  <TableHead className="w-24 text-right">Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.dns_records.map((r, i) => (
                  <DnsRow key={`${r.type}-${i}`} record={r} />
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              DNS changes can take a few minutes to a few hours to propagate.
              After publishing the records, use <strong>Verify Now</strong> or{" "}
              <strong>Force Recheck</strong>. We auto-recheck every 60s while
              propagating.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Save a custom domain to generate the DNS records for this bank.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function DnsRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState<null | "host" | "value" | "row">(null);
  const copy = async (text: string, tag: "host" | "value" | "row") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      toast.success("Copied!");
      setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <TableRow>
      <TableCell>
        <Badge variant="secondary">{record.type}</Badge>
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => copy(record.host, "host")}
          className="group inline-flex max-w-[220px] items-center gap-1.5 truncate text-left font-mono text-xs hover:text-primary"
          title={`Copy ${record.host}`}
        >
          <span className="truncate">{record.host}</span>
          {copied === "host" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
          )}
        </button>
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => copy(record.value, "value")}
          className="group inline-flex max-w-[320px] items-center gap-1.5 truncate text-left font-mono text-xs hover:text-primary"
          title={`Copy ${record.value}`}
        >
          <span className="truncate">{record.value}</span>
          {copied === "value" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
          )}
        </button>
      </TableCell>
      <TableCell className="font-mono text-xs">{record.ttl}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            copy(
              `${record.type}\t${record.host}\t${record.value}\t${record.ttl}`,
              "row",
            )
          }
        >
          {copied === "row" ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// -----------------------------------------------------------------------------
function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const v = value.toLowerCase();
  const variant: "default" | "secondary" | "destructive" =
    v === "verified" || v === "connected"
      ? "default"
      : v === "failed" || v === "incorrect" || v === "error"
        ? "destructive"
        : "secondary";
  const display =
    v === "verified" || v === "connected"
      ? "Verified"
      : v === "failed" || v === "incorrect"
        ? "Failed"
        : v === "propagating"
          ? "Propagating"
          : v === "not_configured"
            ? "Not configured"
            : "Pending";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant}>{display}</Badge>
    </div>
  );
}

function SslRow({ ssl }: { ssl: string }) {
  const icon =
    ssl === "active" ? (
      <ShieldCheck className="h-4 w-4 text-emerald-600" />
    ) : ssl === "error" || ssl === "expired" ? (
      <ShieldAlert className="h-4 w-4 text-destructive" />
    ) : (
      <Shield className="h-4 w-4 text-muted-foreground" />
    );
  const hint =
    ssl === "active"
      ? "Certificate active."
      : ssl === "issuing" || ssl === "requesting" || ssl === "pending"
        ? "Being issued — usually 5–30 min after DNS propagation."
        : ssl === "expired"
          ? "Certificate expired — recheck to reissue."
          : ssl === "error"
            ? "Issuance failed — check DNS."
            : "SSL inactive until the domain is verified.";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">SSL Status</span>
      <span className="flex items-center gap-1.5 text-right capitalize" title={hint}>
        {icon}
        {ssl}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: DiagnosticStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusFromCheck(
  diagnostics: DomainDiagnostics | null,
  keys: string[],
): DiagnosticStatus {
  if (!diagnostics) return "pending";
  for (const k of keys) {
    const c = diagnostics.checks.find((x) => x.key === k);
    if (c) return c.status;
  }
  return "pending";
}

function sslToStatus(ssl: string | undefined): DiagnosticStatus {
  if (ssl === "active") return "pass";
  if (ssl === "error" || ssl === "expired") return "fail";
  if (ssl === "issuing" || ssl === "requesting" || ssl === "pending") return "warn";
  return "pending";
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function formatAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// -----------------------------------------------------------------------------
// Resolver panel — shows every DNS lookup we performed across public resolvers
// (Google, Cloudflare, Quad9) with the raw + parsed response, TTL, latency and
// agreement summary. Lets operators diagnose propagation, DNSSEC and provider
// caching without leaving the app.
function ResolverPanel({ diagnostics }: { diagnostics: DomainDiagnostics | null }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!diagnostics) return null;
  const { resolver_results, dns_logs, next_retry_at, failure_reason } =
    diagnostics.meta;
  if (!dns_logs?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolver diagnostics</CardTitle>
        <CardDescription>
          Every DNS lookup performed across public resolvers. Use this to spot
          propagation lag, DNSSEC issues, or provider caching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failure_reason ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <div className="font-medium">Current blocker: {failure_reason.replace(/_/g, " ")}</div>
            {next_retry_at ? (
              <div className="text-xs text-muted-foreground mt-1">
                Next automatic retry: {new Date(next_retry_at).toLocaleTimeString()}
              </div>
            ) : null}
          </div>
        ) : null}

        {resolver_results.map((r) => (
          <div key={`${r.type}-${r.hostname}`} className="rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Badge variant="outline">{r.type}</Badge>
              <span className="font-mono">{r.hostname}</span>
              <Badge
                variant="outline"
                className="ml-auto capitalize"
              >
                {r.agreement}
              </Badge>
            </div>
            <div className="mt-2 grid gap-1 text-xs">
              {r.per_resolver.map((p) => (
                <div key={p.resolver} className="flex items-start gap-2">
                  <span className="w-40 shrink-0 text-muted-foreground">{p.resolver}</span>
                  <span className="font-mono break-all">
                    {p.status === "ok"
                      ? p.parsed.length
                        ? p.parsed.join(", ")
                        : "(no records)"
                      : p.status}
                    {p.ttl != null ? ` · TTL ${p.ttl}s` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <div className="text-sm font-medium mb-2">Raw DNS responses</div>
          <div className="space-y-1.5">
            {dns_logs.map((log, i) => (
              <div key={i} className="rounded border">
                <button
                  type="button"
                  onClick={() => setOpen((s) => ({ ...s, [i]: !s[i] }))}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted/40"
                >
                  <Badge variant="outline">{log.type}</Badge>
                  <span className="font-mono">{log.hostname}</span>
                  <span className="text-muted-foreground">via {log.resolver}</span>
                  <span className="ml-auto text-muted-foreground">
                    {log.status} · {log.latency_ms}ms
                    {log.ttl != null ? ` · TTL ${log.ttl}s` : ""}
                  </span>
                </button>
                {open[i] ? (
                  <div className="border-t bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
                    {log.parsed.length ? (
                      <div className="mb-2">
                        <span className="text-muted-foreground">Parsed: </span>
                        {log.parsed.join(", ")}
                      </div>
                    ) : null}
                    {log.error ? (
                      <div className="mb-2 text-destructive">Error: {log.error}</div>
                    ) : null}
                    <div className="text-muted-foreground mb-1">Raw response:</div>
                    <div>{log.raw || "(empty)"}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
