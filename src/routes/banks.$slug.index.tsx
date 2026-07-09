import { createFileRoute } from "@tanstack/react-router";
import { TenantSite } from "@/lib/website/tenant-site";
import type { WebsiteManifest, GeneratedPage } from "@/lib/rendering/types";

export const Route = createFileRoute("/banks/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = Route.useRouteContext({
    select: () => ({}),
  }) as unknown as { bank: never };
  void bank;
  const parent = Route.useMatch({ select: (m) => m }) as unknown;
  void parent;
  const { bank: loadedBank } = Route.useParentMatches().find(
    (m) => m.routeId === "/banks/$slug",
  )!.loaderData as { bank: { manifest: WebsiteManifest } };
  const manifest = loadedBank.manifest;
  const home =
    manifest.pages.find((p) => p.slug === "home") ?? manifest.pages[0];
  return <TenantSite manifest={manifest} page={home as GeneratedPage} />;
}
