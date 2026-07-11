import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { TenantGateway } from "@/lib/website/tenant-gateway";
import type { WebsiteManifest } from "@/lib/rendering/types";

export const Route = createFileRoute("/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = useLoaderData({ from: "/$slug" }) as {
    bank: { manifest: WebsiteManifest };
  };
  return <TenantGateway manifest={bank.manifest} />;
}
