import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import { ADMIN_SECTIONS } from "@/lib/bank-builder.types";

import { PlatformPinGate } from "@/components/platform/pin-gate";
import { useSelectedBankId } from "@/lib/admin/selected-bank";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Global Admin — TheMixWeb" },
      { name: "description", content: "Centralized administration for every generated bank on TheMixWeb." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const [open, setOpen] = useState(false);
  return (
    <PlatformPinGate area="Global Admin">
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Icons.Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <Sidebar onNav={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
            <span className="text-muted-foreground">›</span>
            <span className="text-sm font-medium">Global Admin</span>
            <div className="ml-auto flex items-center gap-2">
              <BankSwitcher />
              <Button asChild variant="outline" size="sm">
                <Link to="/gboc">Operations Center</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/launch">+ Launch New Bank</Link>
              </Button>
            </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1400px]">
          <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
            <Sidebar />
          </aside>
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PlatformPinGate>
  );
}

function Sidebar({ onNav }: { onNav?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="p-3">
      <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Platform
      </div>
      <Link
        to="/admin"
        onClick={onNav}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
          path === "/admin" && "bg-muted font-medium",
        )}
      >
        <Icons.LayoutDashboard className="h-4 w-4" /> Overview
      </Link>
      <div className="px-2 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tools
      </div>
      {ADMIN_SECTIONS.map((s) => {
        const Icon =
          (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[s.icon] ??
          Icons.Circle;
        const active = path === `/admin/${s.slug}`;
        return (
          <Link
            key={s.slug}
            to="/admin/$section"
            params={{ section: s.slug }}
            onClick={onNav}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
              active && "bg-muted font-medium",
            )}
          >
            <Icon className="h-4 w-4" /> {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BankSwitcher() {
  const fn = useServerFn(gbocListBanks);
  const q = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => fn() });
  const banks = q.data ?? [];
  const [bankId, setBankId] = useSelectedBankId();
  return (
    <Select
      value={bankId ?? ""}
      onValueChange={(id) => setBankId(id || null)}
    >
      <SelectTrigger className="h-9 w-56 text-xs">
        <SelectValue placeholder={banks.length ? "Select a bank…" : "No published banks"} />
      </SelectTrigger>
      <SelectContent>
        {banks.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.bank_name}
            {b.country ? ` · ${b.country}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
