// Back-compat: /banks/:slug → /:short_slug (permanent redirect).
// The URL segment received here is the legacy long `slug`. We look up the
// bank and 301-redirect to the current public URL.
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";

export const Route = createFileRoute("/banks/$slug")({
  beforeLoad: async ({ params, location }) => {
    // Only redirect the exact /banks/:slug URL here; the splat child
    // banks.$slug.$.tsx handles every path below it.
    if (
      location.pathname !== `/banks/${params.slug}` &&
      location.pathname !== `/banks/${params.slug}/`
    ) {
      return;
    }
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw redirect({ href: "/", statusCode: 301 });
    const target = bank.short_slug ?? bank.slug;
    throw redirect({ href: `/${target}`, statusCode: 301 });
  },
  component: () => <Outlet />,
});

