import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="max-w-xl space-y-6 text-center">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          TheMixWeb
        </div>
        <h1 className="text-4xl font-bold sm:text-5xl">Build a bank in minutes</h1>
        <p className="text-muted-foreground">
          Multi-tenant website generation for retail, commercial, corporate, private,
          digital and investment banking.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/bank-builder">Create New Bank</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
