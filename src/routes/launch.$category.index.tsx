import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBlueprintCategories,
  listCountries,
  listBlueprints,
} from "@/lib/bank-builder.functions";
import type {
  BankCountry,
  BlueprintCategory,
  BankTemplate,
} from "@/lib/bank-builder.types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/launch/$category/")({
  component: CategoryCountries,
});

function CategoryCountries() {
  const { category } = useParams({ from: "/launch/$category/" });
  const [q, setQ] = useState("");
  const catFn = useServerFn(listBlueprintCategories);
  const countriesFn = useServerFn(listCountries);
  const blueprintsFn = useServerFn(listBlueprints);

  const catsQ = useQuery({ queryKey: ["bp-cats"], queryFn: () => catFn() });
  const countriesQ = useQuery({ queryKey: ["bb-countries"], queryFn: () => countriesFn() });
  const blueprintsQ = useQuery({
    queryKey: ["bp-list", category, null],
    queryFn: () => blueprintsFn({ data: { category, country: null } }),
  });

  const cat = ((catsQ.data as BlueprintCategory[]) ?? []).find((c) => c.slug === category);
  const countries = (countriesQ.data as BankCountry[]) ?? [];
  const blueprints = (blueprintsQ.data as BankTemplate[]) ?? [];
  const countByCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blueprints) m.set(b.country_code, (m.get(b.country_code) ?? 0) + 1);
    return m;
  }, [blueprints]);

  const filtered = countries
    .filter((c) => (countByCountry.get(c.code) ?? 0) > 0)
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <Link to="/launch" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All categories
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{cat?.name ?? "Category"}</h1>
        <p className="mt-2 text-muted-foreground">
          {cat?.description ?? "Choose a country to see country-inspired blueprints."}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search countries" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((c) => (
          <Link
            key={c.code}
            to="/launch/$category/$country"
            params={{ category, country: c.code }}
            className="group"
          >
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-3xl">{c.flag_emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.region} · {countByCountry.get(c.code) ?? 0} blueprints
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!filtered.length && (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No countries available for this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
