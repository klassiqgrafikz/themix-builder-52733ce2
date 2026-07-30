import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { BankDraft } from "@/lib/bank-builder.types";
import type { HomepageContent, CatalogContent, HomepageFeatureCard, WebsiteManifest } from "@/lib/rendering/types";
import { defaultHomepageContent, defaultCatalogContent } from "@/lib/rendering/default-content";
import { updateDraft } from "@/lib/bank-builder.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";

const ICON_OPTIONS = [
  "Sparkles", "ShieldCheck", "Landmark", "Building2", "Crown",
  "Wallet", "Globe", "Lock", "Zap", "Users", "BarChart3",
  "PiggyBank", "CreditCard", "Repeat", "ArrowRight",
];

type EditorContent = {
  homepage: HomepageContent;
  catalog: CatalogContent;
};

function rf(desktop: string, mobile: string) {
  return { desktop, mobile };
}

function cloneContent(m: WebsiteManifest | null): EditorContent {
  const cfg = { id: "", owner_id: "", mode: "template" as const, template_id: null, country_code: null, identity: {}, branding: {}, features: {}, created_at: "", updated_at: "" };
  const defH = defaultHomepageContent(cfg);
  const defC = defaultCatalogContent(cfg);
  const hc = m?.homepage_content;
  const cc = m?.catalog_content;
  return {
    homepage: hc ? JSON.parse(JSON.stringify(hc)) : defH,
    catalog: cc ? JSON.parse(JSON.stringify(cc)) : defC,
  };
}

export function HomepageEditor({
  manifest,
  draftId,
  onSaved,
}: {
  manifest: WebsiteManifest | null;
  draftId: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateDraft);
  const [tab, setTab] = useState("gateway");
  const [content, setContent] = useState<EditorContent>(() => cloneContent(manifest));

  const saveMut = useMutation({
    mutationFn: async () => {
      const draft = qc.getQueryData<BankDraft>(["bb-draft", draftId]);
      const updatedBranding = { ...(draft?.branding ?? {}), homepage_content: content.homepage, catalog_content: content.catalog };
      const patch: Record<string, unknown> = { branding: updatedBranding };
      if (draft?.manifest && typeof draft.manifest === "object" && "version" in draft.manifest) {
        patch.manifest = {
          ...draft.manifest,
          homepage_content: content.homepage,
          catalog_content: content.catalog,
        };
      }
      return updateFn({ data: { id: draftId, patch } });
    },
    onSuccess: () => {
      toast.success("Homepage content saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (!manifest) return null;

  function updateHomepage(path: string, value: unknown) {
    setContent((prev) => {
      const hc = JSON.parse(JSON.stringify(prev.homepage));
      const keys = path.split(".");
      let obj: Record<string, unknown> = hc;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return { ...prev, homepage: hc };
    });
  }

  function updateCatalog(path: string, value: unknown) {
    setContent((prev) => {
      const cc = JSON.parse(JSON.stringify(prev.catalog));
      const keys = path.split(".");
      let obj: Record<string, unknown> = cc;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return { ...prev, catalog: cc };
    });
  }

  function updateFeature(variant: "modern" | "corporate" | "premium", index: number, field: string, value: unknown) {
    setContent((prev) => {
      const hc = JSON.parse(JSON.stringify(prev.homepage));
      hc[variant].features[index][field] = value;
      return { ...prev, homepage: hc };
    });
  }

  function addFeature(variant: "modern" | "corporate" | "premium") {
    setContent((prev) => {
      const hc = JSON.parse(JSON.stringify(prev.homepage));
      hc[variant].features.push({
        id: `f${Date.now()}`,
        icon_key: "Sparkles",
        title: rf("", ""),
        description: rf("", ""),
        visible_desktop: true,
        visible_mobile: true,
      });
      return { ...prev, homepage: hc };
    });
  }

  function removeFeature(variant: "modern" | "corporate" | "premium", index: number) {
    setContent((prev) => {
      const hc = JSON.parse(JSON.stringify(prev.homepage));
      hc[variant].features.splice(index, 1);
      return { ...prev, homepage: hc };
    });
  }

  function moveFeature(variant: "modern" | "corporate" | "premium", index: number, dir: -1 | 1) {
    setContent((prev) => {
      const hc = JSON.parse(JSON.stringify(prev.homepage));
      const features = hc[variant].features as HomepageFeatureCard[];
      const to = index + dir;
      if (to < 0 || to >= features.length) return prev;
      [features[index], features[to]] = [features[to], features[index]];
      return { ...prev, homepage: hc };
    });
  }

  function RfInput({ label, path }: { label: string; path: string }) {
    const hc = content.homepage;
    const keys = path.split(".");
    let obj: Record<string, unknown> = hc;
    for (let i = 0; i < keys.length; i++) {
      obj = obj?.[keys[i]] as Record<string, unknown>;
    }
    const field = obj as { desktop: string; mobile: string } | undefined;
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">Desktop</span>
            <Input
              value={field?.desktop ?? ""}
              onChange={(e) => updateHomepage(path + ".desktop", e.target.value)}
              className="h-8 text-sm"
              placeholder={`Desktop ${label}`}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Mobile</span>
            <Input
              value={field?.mobile ?? ""}
              onChange={(e) => updateHomepage(path + ".mobile", e.target.value)}
              className="h-8 text-sm"
              placeholder={`Mobile ${label}`}
            />
          </div>
        </div>
      </div>
    );
  }

  function CatalogInput({ label, field }: { label: string; field: "heading" | "subtitle" }) {
    const cc = content.catalog;
    const f = cc[field];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">Desktop</span>
            <Input
              value={f?.desktop ?? ""}
              onChange={(e) => updateCatalog(field + ".desktop", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Mobile</span>
            <Input
              value={f?.mobile ?? ""}
              onChange={(e) => updateCatalog(field + ".mobile", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  function FeaturesEditor({ variant }: { variant: "modern" | "corporate" | "premium" }) {
    const features = content.homepage[variant]?.features ?? [];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Feature Cards</Label>
          <Button size="sm" variant="outline" onClick={() => addFeature(variant)} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Card
          </Button>
        </div>
        {features.map((f, i) => (
          <div key={f.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => moveFeature(variant, i, -1)} className="text-muted-foreground hover:text-foreground p-0.5">
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-semibold">Card {i + 1}</span>
              <button onClick={() => removeFeature(variant, i)} className="ml-auto text-rose-500 hover:text-rose-700 p-0.5">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Icon</Label>
                <select
                  value={f.icon_key}
                  onChange={(e) => updateFeature(variant, i, "icon_key", e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  {ICON_OPTIONS.map((ik) => <option key={ik} value={ik}>{ik}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-[10px]">
                  <input type="checkbox" checked={f.visible_desktop} onChange={(e) => updateFeature(variant, i, "visible_desktop", e.target.checked)} />
                  Desktop
                </label>
                <label className="flex items-center gap-1 text-[10px]">
                  <input type="checkbox" checked={f.visible_mobile} onChange={(e) => updateFeature(variant, i, "visible_mobile", e.target.checked)} />
                  Mobile
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={f.title.desktop}
                onChange={(e) => updateFeature(variant, i, "title", { ...f.title, desktop: e.target.value })}
                className="h-7 text-xs"
                placeholder="Title (desktop)"
              />
              <Input
                value={f.title.mobile}
                onChange={(e) => updateFeature(variant, i, "title", { ...f.title, mobile: e.target.value })}
                className="h-7 text-xs"
                placeholder="Title (mobile)"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={f.description.desktop}
                onChange={(e) => updateFeature(variant, i, "description", { ...f.description, desktop: e.target.value })}
                className="h-7 text-xs"
                placeholder="Description (desktop)"
              />
              <Input
                value={f.description.mobile}
                onChange={(e) => updateFeature(variant, i, "description", { ...f.description, mobile: e.target.value })}
                className="h-7 text-xs"
                placeholder="Description (mobile)"
              />
            </div>
          </div>
        ))}
        {features.length === 0 && (
          <p className="text-xs text-muted-foreground">No feature cards. Click "Add Card" to create one.</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Homepage & Catalog Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="gateway" className="text-xs">Gateway</TabsTrigger>
            <TabsTrigger value="modern" className="text-xs">Modern</TabsTrigger>
            <TabsTrigger value="corporate" className="text-xs">Corporate</TabsTrigger>
            <TabsTrigger value="premium" className="text-xs">Premium</TabsTrigger>
            <TabsTrigger value="catalog" className="text-xs">Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="gateway" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">The minimal gateway page shown at /$slug/ before login.</p>
            <RfInput label="Heading / Tagline" path="gateway.heading" />
            <RfInput label="Subtitle" path="gateway.subtitle" />
          </TabsContent>

          <TabsContent value="modern" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Modern fintech variant — rounded design, big balance card.</p>
            <RfInput label="Badge" path="modern.badge" />
            <RfInput label="Hero Title" path="modern.hero_title" />
            <RfInput label="Hero Subtitle" path="modern.hero_subtitle" />
            <RfInput label="Primary CTA Label" path="modern.cta_primary" />
            <RfInput label="Secondary CTA Label" path="modern.cta_secondary" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={content.homepage.modern?.show_balance_card ?? true} onChange={(e) => updateHomepage("modern.show_balance_card", e.target.checked)} />
              Show balance card mock
            </label>
            <FeaturesEditor variant="modern" />
          </TabsContent>

          <TabsContent value="corporate" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Corporate variant — formal nav, dense layout, rates table.</p>
            <RfInput label="Badge" path="corporate.badge" />
            <RfInput label="Hero Title" path="corporate.hero_title" />
            <RfInput label="Hero Subtitle" path="corporate.hero_subtitle" />
            <RfInput label="Primary CTA Label" path="corporate.cta_primary" />
            <RfInput label="Secondary CTA Label" path="corporate.cta_secondary" />
            <FeaturesEditor variant="corporate" />
          </TabsContent>

          <TabsContent value="premium" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Premium variant — dark executive, serif display, luxury cards.</p>
            <RfInput label="Badge" path="premium.badge" />
            <RfInput label="Hero Title" path="premium.hero_title" />
            <RfInput label="Hero Subtitle" path="premium.hero_subtitle" />
            <RfInput label="Primary CTA Label" path="premium.cta_primary" />
            <RfInput label="Secondary CTA Label" path="premium.cta_secondary" />
            <FeaturesEditor variant="premium" />
          </TabsContent>

          <TabsContent value="catalog" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Customer-facing product catalog page (inside the portal).</p>
            <CatalogInput label="Page Heading" field="heading" />
            <CatalogInput label="Page Subtitle" field="subtitle" />
          </TabsContent>
        </Tabs>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="w-full"
          size="sm"
        >
          {saveMut.isPending ? "Saving…" : "Save Homepage Content"}
        </Button>
      </CardContent>
    </Card>
  );
}
