import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { TenantSite } from "@/lib/website/tenant-site";
import type { WebsiteManifest } from "@/lib/rendering/types";

export const Route = createFileRoute("/banks/$slug/$page")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    const manifest = bank.manifest as WebsiteManifest;
    const page = manifest.pages.find((p) => p.slug === params.page);
    if (!page) throw notFound();
    return { bank, page };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    const m = loaderData.bank.manifest;
    return {
      meta: [
        { title: `${loaderData.page.title} — ${m.bank.name}` },
        { name: "description", content: `${loaderData.page.title} at ${m.bank.name}.` },
        { property: "og:title", content: `${loaderData.page.title} — ${m.bank.name}` },
        { property: "og:description", content: m.metadata.description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: TenantPageRoute,
});

function TenantPageRoute() {
  const { bank, page } = Route.useLoaderData();
  return <TenantSite manifest={bank.manifest} page={page} />;
}
