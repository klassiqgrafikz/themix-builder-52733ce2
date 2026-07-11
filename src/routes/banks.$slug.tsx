// Back-compat: /banks/:slug → /:short_slug (permanent redirect).
// The URL segment received here is the legacy long `slug`. We look up the
// bank and 301-redirect to the current public URL, preserving any subpath
// via a splat child route (banks.$slug.$.tsx).
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";

export const Route = createFileRoute("/banks/$slug")({
  beforeLoad: async ({ params, location }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    // If the bank doesn't resolve, let the child route handle the 404.
    if (!bank) return;
    const target = bank.short_slug ?? bank.slug;
    // Only redirect the exact /banks/:slug URL here; splat handles the rest.
    if (location.pathname === `/banks/${params.slug}` || location.pathname === `/banks/${params.slug}/`) {
      throw redirect({ to: "/$slug", params: { slug: target }, statusCode: 301 });
    }
  },
  component: () => <Outlet />,
});
