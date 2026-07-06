import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBlueprintCategories,
  listCountries,
  listBlueprints,
  useBlueprint,
} from "@/lib/bank-builder.functions";
import type {
  BankCountry,
  BlueprintCategory,
  BankTemplate,
} from "@/lib/bank-builder.types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ChevronLeft,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Star,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/launch/$category/$country")({
  component: BlueprintsList,
});

function BlueprintsList() {
  const { category, country } = useParams({ from: "/launch/$category/$country" });
  const navigate = useNavigate();
  const catFn = useServerFn(listBlueprintCategories);
  const countriesFn = useServerFn(listCountries);
  const bpFn = useServerFn(listBlueprints);
  const useBpFn = useServerFn(useBlueprint);

  const catsQ = useQuery({ queryKey: ["bp-cats"], queryFn: () => catFn() });
  const countriesQ = useQuery({ queryKey: ["bb-countries"], queryFn: () => countriesFn() });
  const bpQ = useQuery({
    queryKey: ["bp-list", category, country],
    queryFn: () => bpFn({ data: { category, country } }),
  });

  const cat = ((catsQ.data as BlueprintCategory[]) ?? []).find((c) => c.slug === category);
  const countryRow = ((countriesQ.data as BankCountry[]) ?? []).find((c) => c.code === country);
  const list = (bpQ.data as BankTemplate[]) ?? [];

  const [preview, setPreview] = useState<BankTemplate | null>(null);

  const useMut = useMutation({
    mutationFn: (b: BankTemplate) => useBpFn({ data: { blueprintId: b.id } }),
    onSuccess: ({ draftId }) => {
      navigate({ to: "/bank-builder", search: { draftId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <Link
        to="/launch/$category"
        params={{ category }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {cat?.name ?? "Category"}
      </Link>
      <div>
        <h1 className="text-3xl font-bold">
          {countryRow?.flag_emoji} {cat?.name} — {countryRow?.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Country-inspired blueprints. Each is fully editable after selection.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <BlueprintCard
            key={b.id}
            b={b}
            country={countryRow}
            onPreview={() => setPreview(b)}
            onUse={() => useMut.mutate(b)}
            busy={useMut.isPending}
          />
        ))}
        {!list.length && (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No blueprints yet for this combination.
          </div>
        )}
      </div>

      <PreviewModal
        blueprint={preview}
        country={countryRow}
        onClose={() => setPreview(null)}
        onUse={(b) => {
          setPreview(null);
          useMut.mutate(b);
        }}
      />
    </div>
  );
}

function BlueprintCard({
  b, country, onPreview, onUse, busy,
}: {
  b: BankTemplate;
  country?: BankCountry;
  onPreview: () => void;
  onUse: () => void;
  busy: boolean;
}) {
  const updated = new Date(b.updated_at);
  const daysAgo = Math.floor((Date.now() - updated.getTime()) / 86400000);
  return (
    <Card className="overflow-hidden transition hover:shadow-lg">
      <div
        className="relative h-40"
        style={{ background: `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})` }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="text-xs opacity-80">{b.category}</div>
            <div className="flex flex-col items-end gap-1">
              {b.recommended && (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-500 gap-1">
                  <Sparkles className="h-3 w-3" /> Recommended
                </Badge>
              )}
              {b.is_premium && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Premium</Badge>}
            </div>
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">{b.name}</div>
            <div className="mt-1 text-xs opacity-90">
              {country?.flag_emoji} {country?.name}
            </div>
            <div className="mt-2 h-2 w-16 rounded-full" style={{ backgroundColor: b.accent_color }} />
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
        <div className="flex flex-wrap gap-1 text-xs">
          <Badge variant="outline">{b.currency}</Badge>
          <Badge variant="outline">{b.language.toUpperCase()}</Badge>
          <Badge variant="outline">v{b.version}</Badge>
          <Badge variant="outline" className="gap-1">
            <Star className="h-3 w-3" /> {b.popularity}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="h-3 w-3" />
          <Tablet className="h-3 w-3" />
          <Smartphone className="h-3 w-3" />
          <span>
            · {b.supported_modules.length} modules · Updated{" "}
            {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
          </span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onPreview} className="flex-1">
            <Eye className="mr-1 h-4 w-4" /> Preview
          </Button>
          <Button size="sm" onClick={onUse} disabled={busy} className="flex-1">
            {busy ? "Cloning…" : "Use Blueprint"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PREVIEW_PAGES = [
  "home", "login", "register", "dashboard",
  "accounts", "cards", "transfers", "settings", "support",
];

function PreviewModal({
  blueprint, country, onClose, onUse,
}: {
  blueprint: BankTemplate | null;
  country?: BankCountry;
  onClose: () => void;
  onUse: (b: BankTemplate) => void;
}) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [page, setPage] = useState("home");
  if (!blueprint) return null;
  const frameW = device === "desktop" ? "100%" : device === "tablet" ? 768 : 375;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{blueprint.name} — Preview</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={device} onValueChange={(v) => setDevice(v as typeof device)}>
            <TabsList>
              <TabsTrigger value="desktop"><Monitor className="mr-1 h-4 w-4" /> Desktop</TabsTrigger>
              <TabsTrigger value="tablet"><Tablet className="mr-1 h-4 w-4" /> Tablet</TabsTrigger>
              <TabsTrigger value="mobile"><Smartphone className="mr-1 h-4 w-4" /> Mobile</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={page} onValueChange={setPage} className="ml-auto">
            <TabsList className="flex-wrap">
              {PREVIEW_PAGES.map((p) => (
                <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="rounded-lg border bg-muted/40 p-4">
          <div
            className={cn(
              "mx-auto overflow-hidden rounded-md border bg-background shadow-sm transition-all",
            )}
            style={{ width: frameW, maxWidth: "100%" }}
          >
            <div
              className="p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${blueprint.primary_color}, ${blueprint.secondary_color})` }}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{blueprint.name}</div>
                <div className="text-xs opacity-80">{country?.flag_emoji} {country?.name}</div>
              </div>
            </div>
            <PagePreview page={page} blueprint={blueprint} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onUse(blueprint)}>Use Blueprint</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PagePreview({ page, blueprint }: { page: string; blueprint: BankTemplate }) {
  const accent = blueprint.accent_color;
  return (
    <div className="animate-in fade-in-0 space-y-3 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{page}</div>
      {page === "home" && (
        <div className="space-y-3">
          <div className="h-24 rounded-md" style={{ background: `linear-gradient(90deg, ${blueprint.primary_color}22, ${accent}44)` }} />
          <div className="grid grid-cols-3 gap-2">
            {[0,1,2].map(i => <div key={i} className="h-16 rounded-md bg-muted" />)}
          </div>
        </div>
      )}
      {page === "dashboard" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="h-24 rounded-md" style={{ backgroundColor: `${blueprint.primary_color}22` }} />
          <div className="h-24 rounded-md" style={{ backgroundColor: `${accent}33` }} />
          <div className="col-span-2 h-20 rounded-md bg-muted" />
        </div>
      )}
      {["login","register","settings","support"].includes(page) && (
        <div className="space-y-2">
          <div className="h-8 rounded-md bg-muted" />
          <div className="h-8 rounded-md bg-muted" />
          <div className="h-8 w-1/3 rounded-md" style={{ backgroundColor: blueprint.primary_color }} />
        </div>
      )}
      {["accounts","cards","transfers"].includes(page) && (
        <div className="space-y-2">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full" style={{ backgroundColor: `${accent}55` }} />
              <div className="h-3 flex-1 rounded bg-muted" />
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
