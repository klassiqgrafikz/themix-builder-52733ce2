import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { TenantSite } from "@/lib/website/tenant-site";
import type { GeneratedPage, WebsiteManifest } from "@/lib/rendering/types";

export const Route = createFileRoute("/banks/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = useLoaderData({ from: "/banks/$slug" }) as {
    bank: { manifest: WebsiteManifest };
  };
  const manifest = bank.manifest;
  const home =
    manifest.pages.find((p) => p.slug === "home") ?? manifest.pages[0];
  return <TenantSite manifest={manifest} page={home as GeneratedPage} />;
}
