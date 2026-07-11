import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { getCurrentCustomer } from "@/lib/customer/customer.functions";
import { listMyRestrictions } from "@/lib/customer/restrictions.functions";
import { PortalShell } from "@/lib/customer/portal-ui";

export const Route = createFileRoute("/$slug/portal")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    const session = await getCurrentCustomer({ data: { slug: params.slug } });
    if (!session) {
      throw redirect({ to: "/$slug/login", params: { slug: params.slug } });
    }
    const restrictions = await listMyRestrictions({ data: { slug: params.slug } }).catch(() => []);
    return { bank, session, restrictions };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Customer portal — ${loaderData.bank.manifest.bank.name}`
          : "Customer portal",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  const { bank, session, restrictions } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${bank.slug}/portal`;
  const activePath = pathname === base ? "" : pathname.slice(base.length);
  return (
    <PortalShell
      manifest={bank.manifest}
      customer={session.customer}
      activePath={activePath}
      restrictions={restrictions}
    >
      <Outlet />
    </PortalShell>
  );
}
