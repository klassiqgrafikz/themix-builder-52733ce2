import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TheMixWeb — Multi-tenant Banking Platform" },
      {
        name: "description",
        content:
          "TheMixWeb is a multi-tenant banking OS: launch branded banks from the Blueprint Library and manage every tenant from one global admin.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="max-w-2xl space-y-6 text-center">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          TheMixWeb
        </div>
        <h1 className="text-4xl font-bold sm:text-5xl">
          The Banking Operating System
        </h1>
        <p className="text-muted-foreground">
          Launch fully branded tenant banks from the Blueprint Library, then
          operate every bank from one centralized administration portal.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Button asChild size="lg" className="w-full">
            <Link to="/launch">Launch New Bank</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/admin">Global Admin</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/gboc">Operations Center</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/products">Products Catalog</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
