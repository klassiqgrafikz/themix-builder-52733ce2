import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { ADMIN_SECTIONS } from "@/lib/bank-builder.types";
import { Card, CardContent } from "@/components/ui/card";
import * as Icons from "lucide-react";

export const Route = createFileRoute("/admin/$section")({
  component: AdminSection,
});

function AdminSection() {
  const { section } = useParams({ from: "/admin/$section" });
  const meta = ADMIN_SECTIONS.find((s) => s.slug === section);

  if (!meta) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Unknown section</h1>
        <p className="text-muted-foreground">
          <Link to="/admin" className="underline">Return to overview</Link>
        </p>
      </div>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[meta.icon] ??
    Icons.Circle;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{meta.label}</h1>
          <p className="mt-1 text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icons.Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="font-medium">Select a bank to manage its {meta.label.toLowerCase()}.</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Use the bank switcher in the header to scope this tool to a specific
            generated tenant. Global platform tooling remains here so it never
            has to be duplicated per bank.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
