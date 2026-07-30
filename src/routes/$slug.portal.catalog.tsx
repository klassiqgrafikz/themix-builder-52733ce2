import { createFileRoute, useMatch } from "@tanstack/react-router";
import type { WebsiteManifest, ResolvedProductRef } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { isProductEnabled } from "@/lib/customer/product-gating";
import { cn } from "@/lib/utils";
import {
  Wallet, Globe, Lock, Zap, Users, BarChart3, PiggyBank, CreditCard, Repeat,
  ShieldCheck, Sparkles, Landmark, Building2, Crown, ArrowRight,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet, Globe, Lock, Zap, Users, BarChart3, PiggyBank, CreditCard, Repeat,
  ShieldCheck, Sparkles, Landmark, Building2, Crown, ArrowRight,
};

export const Route = createFileRoute("/$slug/portal/catalog")({
  component: CatalogPage,
});

function ProductIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const C = ICON_MAP[iconKey];
  if (!C) return <div className={cn("rounded bg-muted", className)} />;
  return <C className={className} />;
}

function CatalogPage() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primary = theme.colors.primary;
  const cc = manifest.catalog_content;
  const products = (manifest.products ?? []).filter(
    (p) => p.status === "active" && p.visibility !== "internal" && isProductEnabled(manifest, p.code),
  );

  const grouped = products.reduce<Record<string, ResolvedProductRef[]>>((acc, p) => {
    (acc[p.category_slug] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <BrandedCard manifest={manifest}>
        <div className="space-y-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: theme.typography.heading, color: primary }}>
            {cc?.heading?.desktop ?? "Products & Services"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cc?.subtitle?.desktop ?? "Explore our range of banking products."}
          </p>
        </div>
      </BrandedCard>

      {Object.entries(grouped).map(([category, items]) => (
        <BrandedCard key={category} manifest={manifest}>
          <h2 className="mb-4 text-lg font-semibold capitalize" style={{ color: primary }}>
            {category.replace(/_/g, " ")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div
                key={p.code}
                className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <ProductIcon iconKey={p.icon} className="mb-3 h-8 w-8" style={{ color: primary } as React.CSSProperties} />
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
              </div>
            ))}
          </div>
        </BrandedCard>
      ))}

      {products.length === 0 && (
        <BrandedCard manifest={manifest}>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No products available yet.
          </p>
        </BrandedCard>
      )}
    </div>
  );
}
