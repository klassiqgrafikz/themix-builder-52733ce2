import { createFileRoute, notFound, Link, Outlet } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";

export const Route = createFileRoute("/$slug")({
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
    const icon = m.brand.login_logo_url ?? m.brand.dashboard_logo_url;
    return {
      meta: [
        { title: m.bank.name },
        { name: "description", content: m.metadata.description },
      ],
      links: icon ? [{ rel: "icon", href: icon }] : [],
    };
  },
  notFoundComponent: TenantNotFound,
  errorComponent: TenantError,
  component: () => <Outlet />,
});

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
