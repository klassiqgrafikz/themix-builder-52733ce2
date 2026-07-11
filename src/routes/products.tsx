import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCatalogProducts,
  listProductCategories,
} from "@/lib/products/catalog.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as Icons from "lucide-react";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Banking Products & Services — TheMixWeb" },
      {
        name: "description",
        content:
          "The centralized master catalog of every banking product available to generated banks on TheMixWeb.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
      <Catalog />
  );
}

function Catalog() {
  const catFn = useServerFn(listProductCategories);
  const prodFn = useServerFn(listCatalogProducts);
  const catQ = useQuery({ queryKey: ["bp-categories"], queryFn: () => catFn() });
  const prodQ = useQuery({ queryKey: ["bp-products"], queryFn: () => prodFn() });

  const categories = catQ.data ?? [];
  const products = prodQ.data ?? [];
  const byCat = new Map<string, typeof products>();
  for (const p of products) {
    const arr = byCat.get(p.category_slug) ?? [];
    arr.push(p);
    byCat.set(p.category_slug, arr);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
          <span className="text-muted-foreground">›</span>
          <span className="text-sm font-medium">Banking Products & Services</span>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <Link className="rounded-md border px-3 py-1.5 hover:bg-muted" to="/admin">Global Admin</Link>
            <Link className="rounded-md border px-3 py-1.5 hover:bg-muted" to="/gboc">Operations</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Banking Products & Services Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Master source of every banking product available to generated banks. Blueprints and
            individual bank owners reference these products — they never duplicate them.
          </p>
        </div>

        {catQ.isLoading || prodQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading catalog…</div>
        ) : (
          <div className="space-y-8">
            {categories.map((c) => {
              const CatIcon = ((Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon ?? "Circle"]) ?? Icons.Circle;
              const list = byCat.get(c.slug) ?? [];
              return (
                <section key={c.slug}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{c.name}</h2>
                      {c.description && (
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto">{list.length} products</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => {
                      const Icon = ((Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[p.icon]) ?? Icons.Circle;
                      return (
                        <Card key={p.code}>
                          <CardContent className="flex items-start gap-3 p-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold">{p.name}</div>
                                <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px]">
                                  {p.status}
                                </Badge>
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{p.code}</div>
                              {p.description && (
                                <p className="mt-1 line-clamp-2 text-xs opacity-80">{p.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                <span>Visibility: {p.visibility}</span>
                                {p.supported_countries.length > 0 && (
                                  <span>· Countries: {p.supported_countries.length}</span>
                                )}
                                {p.supported_currencies.length > 0 && (
                                  <span>· Currencies: {p.supported_currencies.length}</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
