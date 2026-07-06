import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBlueprintCategories } from "@/lib/bank-builder.functions";
import { Card, CardContent } from "@/components/ui/card";
import * as Icons from "lucide-react";
import type { BlueprintCategory } from "@/lib/bank-builder.types";

export const Route = createFileRoute("/launch/")({
  component: LaunchIndex,
});

function LaunchIndex() {
  const fn = useServerFn(listBlueprintCategories);
  const q = useQuery({ queryKey: ["bp-cats"], queryFn: () => fn() });
  const cats = (q.data as BlueprintCategory[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Blueprint Library</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a banking sector to explore country-inspired blueprints.
        </p>
      </div>

      {q.isLoading ? (
        <div className="text-muted-foreground">Loading categories…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => {
            const Icon =
              (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ??
              Icons.Building2;
            return (
              <Link
                key={c.slug}
                to="/launch/$category"
                params={{ category: c.slug }}
                className="group"
              >
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg">
                  <CardContent className="space-y-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    <div className="pt-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      Explore blueprints →
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
