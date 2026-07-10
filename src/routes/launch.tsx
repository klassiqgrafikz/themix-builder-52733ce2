import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { PlatformPinGate } from "@/components/platform/pin-gate";

export const Route = createFileRoute("/launch")({
  head: () => ({
    meta: [
      { title: "Launch New Bank — TheMixWeb" },
      {
        name: "description",
        content: "Browse the Blueprint Library and launch a new bank on TheMixWeb in minutes.",
      },
    ],
  }),
  component: LaunchLayout,
});

function LaunchLayout() {
  return (
    <PlatformPinGate area="Launch New Bank">
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/launch" activeOptions={{ exact: true }} activeProps={{ className: "text-primary font-semibold" }} className="text-muted-foreground hover:text-foreground">
                Blueprint Library
              </Link>
              <Link to="/admin" activeProps={{ className: "text-primary font-semibold" }} className="text-muted-foreground hover:text-foreground">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <Outlet />
        </main>
      </div>
    </PlatformPinGate>
  );
}
