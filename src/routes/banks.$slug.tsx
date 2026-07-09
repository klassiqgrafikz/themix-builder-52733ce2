import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { TenantSite } from "@/lib/website/tenant-site";
import type { WebsiteManifest, GeneratedPage } from "@/lib/rendering/types";

export const Route = createFileRoute("/banks/$slug")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    return { bank };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    const m = loaderData.bank.manifest;
    return {
      meta: [
        { title: `${m.bank.name} — ${m.metadata.description}` },
        { name: "description", content: m.metadata.description },
        { property: "og:title", content: m.bank.name },
        { property: "og:description", content: m.metadata.description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: TenantNotFound,
  errorComponent: TenantError,
  component: TenantHomeRoute,
});

function TenantHomeRoute() {
  const { bank } = Route.useLoaderData();
  const home =
    (bank.manifest as WebsiteManifest).pages.find((p) => p.slug === "home") ??
    (bank.manifest as WebsiteManifest).pages[0];
  return <TenantSite manifest={bank.manifest} page={home as GeneratedPage} />;
}

function TenantNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Bank not found</h1>
      <p className="mt-3 text-muted-foreground">
        This bank isn't published yet, or the address is incorrect.
      </p>
      <Link to="/" className="mt-6 inline-block text-primary underline">
        Back to TheMixWeb
      </Link>
    </div>
  );
}

function TenantError({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
    </div>
  );
}
