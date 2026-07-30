import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import {
  checkPorkbunDomains,
  registerPorkbunDomain,
  TLD_PRICE_ESTIMATES,
  type PorkbunDomainCheck,
  type PorkbunRegistrant,
} from "@/lib/gboc/porkbun.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ShoppingCart,
  Globe,
  Building2,
  ChevronRight,
  ArrowLeft,
  PartyPopper,
  User,
} from "lucide-react";

type Step = "bank" | "search" | "registrant" | "confirm" | "processing" | "success";

type DomainSelection = {
  domain: string;
  tld: string;
  price: number;
  years: number;
};

type CountryOption = { code: string; name: string };

const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "ES", name: "Spain" }, { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" }, { code: "AE", name: "UAE" },
  { code: "NG", name: "Nigeria" }, { code: "ZA", name: "South Africa" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" }, { code: "IN", name: "India" },
];

export function DomainRegisterWizard({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const banksFn = useServerFn(gbocListBanks);
  const searchFn = useServerFn(checkPorkbunDomains);
  const registerFn = useServerFn(registerPorkbunDomain);

  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];

  const [step, setStep] = useState<Step>("bank");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<PorkbunDomainCheck[]>([]);
  const [selection, setSelection] = useState<DomainSelection | null>(null);
  const [registrant, setRegistrant] = useState<PorkbunRegistrant>({
    firstName: "", lastName: "", address1: "", city: "",
    stateProvince: "", postalCode: "", country: "US",
    phone: "", emailAddress: "",
  });
  const [years, setYears] = useState(1);

  const searchMut = useMutation({
    mutationFn: () => searchFn({ data: { keyword } }),
    onSuccess: (results) => {
      setSearchResults(results);
      setStep("search");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Search failed"),
  });

  const registerMut = useMutation({
    mutationFn: () =>
      registerFn({
        data: {
          bank_id: selectedBankId,
          domain: selection!.domain,
          years: selection!.years,
          registrant,
        },
      }),
    onSuccess: (result) => {
      if (result.success) {
        setStep("success");
        qc.invalidateQueries({ queryKey: ["gboc", "banks"] });
      } else {
        toast.error(result.error ?? "Registration failed");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Registration failed"),
    onSettled: () => {
      if (step === "processing") setStep("confirm");
    },
  });

  const selectedBank = banks.find((b) => b.id === selectedBankId);
  const estimatedPrice = selection
    ? TLD_PRICE_ESTIMATES[selection.tld] ?? 15.00
    : 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) { toast.error("Enter a name to search"); return; }
    searchMut.mutate();
  }

  function selectDomain(check: PorkbunDomainCheck) {
    const price = check.price > 0 ? check.price / 100 : (TLD_PRICE_ESTIMATES[check.tld] ?? 15.00);
    setSelection({ domain: check.domain, tld: check.tld, price, years });
    setStep("registrant");
  }

  function handleRegister() {
    if (!selection) return;
    setStep("processing");
    registerMut.mutate();
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to modes
            </Button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Register a Domain</span>
            {selectedBankName ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{selectedBankName}</span>
              </>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["bank", "search", "registrant", "confirm", "success"] as Step[]).map((s, i) => {
              const doneIdx = ["bank", "search", "registrant", "confirm", "success"].indexOf(step);
              const done = i <= doneIdx && step !== "processing";
              const active = i === doneIdx;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      done ? "border-emerald-500 bg-emerald-500 text-white" :
                      active ? "border-primary bg-primary text-primary-foreground" :
                      "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={`text-xs ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                    {s === "bank" ? "Bank" : s === "search" ? "Search" : s === "registrant" ? "Contact" : s === "confirm" ? "Confirm" : "Done"}
                  </span>
                  {i < 4 ? <ChevronRight className="h-3 w-3 text-muted-foreground/50" /> : null}
                </div>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      {/* Step: Select Bank */}
      {step === "bank" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Step 1 · Select a bank
            </CardTitle>
            <CardDescription>Choose which bank the domain will be connected to.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label className="text-xs text-muted-foreground">Bank</Label>
              <Select value={selectedBankId} onValueChange={(v) => {
                setSelectedBankId(v);
                const bank = banks.find((b) => b.id === v);
                setSelectedBankName(bank?.bank_name ?? "");
              }}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={banks.length ? "Select a bank…" : "No banks available"} />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name}{b.country ? ` · ${b.country}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="mt-4"
              disabled={!selectedBankId}
              onClick={() => setStep("search")}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Search */}
      {step === "search" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> Step 2 · Search available domains
            </CardTitle>
            <CardDescription>
              Find the perfect domain name for {selectedBankName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="e.g. mybank, bankname"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={searchMut.isPending}>
                {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((check) => (
                  <div
                    key={check.domain}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {check.available ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                      <span className="text-sm font-medium">{check.domain}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {check.price > 0 ? `~$${(check.price / 100).toFixed(2)}/yr` : check.costDisplay}
                      </span>
                      {check.available ? (
                        <Button size="sm" onClick={() => selectDomain(check)}>
                          Select
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Taken</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchMut.isSuccess && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No results. Try a different name.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Registrant Info */}
      {step === "registrant" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Step 3 · Registrant contact info
            </CardTitle>
            <CardDescription>
              This information is required by ICANN for domain registration. It will be applied to all contacts (Registrant, Admin, Tech, Billing).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">First Name</Label>
                <Input value={registrant.firstName} onChange={(e) => setRegistrant({ ...registrant, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name</Label>
                <Input value={registrant.lastName} onChange={(e) => setRegistrant({ ...registrant, lastName: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={registrant.emailAddress} onChange={(e) => setRegistrant({ ...registrant, emailAddress: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input value={registrant.address1} onChange={(e) => setRegistrant({ ...registrant, address1: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={registrant.city} onChange={(e) => setRegistrant({ ...registrant, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State / Province</Label>
                <Input value={registrant.stateProvince} onChange={(e) => setRegistrant({ ...registrant, stateProvince: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Postal Code</Label>
                <Input value={registrant.postalCode} onChange={(e) => setRegistrant({ ...registrant, postalCode: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Select value={registrant.country} onValueChange={(v) => setRegistrant({ ...registrant, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Phone (format: +NNN.NNNNNNNNNN)</Label>
                <Input value={registrant.phone} onChange={(e) => setRegistrant({ ...registrant, phone: e.target.value })} placeholder="+1.1234567890" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep("search")}>Back</Button>
              <Button onClick={() => setStep("confirm")} disabled={!registrant.firstName || !registrant.lastName || !registrant.emailAddress}>
                Continue to Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Step 4 · Review & Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Domain</span>
                <span className="font-semibold">{selection?.domain}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Registration</span>
                <span>
                  <Select value={String(years)} onValueChange={(v) => {
                    const y = Number(v);
                    setYears(y);
                    if (selection) setSelection({ ...selection, years: y });
                  }}>
                    <SelectTrigger className="h-7 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span>${(estimatedPrice * years).toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${(estimatedPrice * years).toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Registrant</p>
              <p className="text-sm">{registrant.firstName} {registrant.lastName}</p>
              <p className="text-sm">{registrant.emailAddress}</p>
              <p className="text-sm">{registrant.address1}, {registrant.city}, {registrant.stateProvince} {registrant.postalCode}</p>
              <p className="text-sm">{registrant.country} · {registrant.phone}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              By registering this domain, you agree to ICANN's terms and the domain registration
              agreement. DNS will be auto-configured to point to your bank's website.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("registrant")}>Back</Button>
              <Button onClick={handleRegister}>
                Register & Connect — ${(estimatedPrice * years).toFixed(2)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Processing */}
      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium">Registering domain with Porkbun…</p>
            <p className="text-xs text-muted-foreground">This usually takes 10–20 seconds.</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <PartyPopper className="h-10 w-10 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold">Domain Registered & Connected!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selection?.domain} is now connected to <strong>{selectedBankName}</strong>.
            </p>
            <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-left w-full max-w-sm">
              <p className="text-xs text-muted-foreground">Domain</p>
              <p className="text-sm font-medium">{selection?.domain}</p>
              <p className="mt-2 text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Registration</p>
              <p className="text-sm">{years} year{years > 1 ? "s" : ""}</p>
              <p className="mt-2 text-xs text-muted-foreground">DNS</p>
              <p className="text-sm">Auto-configured to point to your bank</p>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={onBack}>
                Manage Another
              </Button>
              <Button onClick={() => setStep("bank")}>
                Register Another Domain
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-px bg-border ${className ?? ""}`} />;
}
