import { createFileRoute } from "@tanstack/react-router";
import { TenantGateway } from "@/lib/website/tenant-gateway";

export const Route = createFileRoute("/banks/$slug/")({
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = Route.useLoaderData();
  return <TenantGateway manifest={bank.manifest} />;
}
