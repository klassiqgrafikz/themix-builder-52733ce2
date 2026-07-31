import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { TenantSite } from "@/lib/website/tenant-site";
import type { WebsiteManifest } from "@/lib/rendering/types";

export const Route = createFileRoute("/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = useLoaderData({ from: "/$slug" }) as {
    bank: { manifest: WebsiteManifest };
  };
  const manifest = bank.manifest;
  const page =
    manifest.pages.find((p) => p.slug === "home") ??
    manifest.pages[0] ?? { slug: "home", path: "/", title: "Home", module_key: null, system: true };
  return <TenantSite manifest={manifest} page={page} />;
}
