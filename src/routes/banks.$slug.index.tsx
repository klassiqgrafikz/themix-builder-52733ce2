import { createFileRoute } from "@tanstack/react-router";
import { TenantSite } from "@/lib/website/tenant-site";
import type { GeneratedPage } from "@/lib/rendering/types";

export const Route = createFileRoute("/banks/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = Route.useLoaderData({
    from: "/banks/$slug",
    select: (d) => d,
  });
  const manifest = bank.manifest;
  const home =
    manifest.pages.find((p) => p.slug === "home") ?? manifest.pages[0];
  return <TenantSite manifest={manifest} page={home as GeneratedPage} />;
}
