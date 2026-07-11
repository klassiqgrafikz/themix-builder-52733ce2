import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { customerListNotifications } from "@/lib/customer/activity.functions";

export const Route = createFileRoute("/$slug/portal/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
  };
  const { bank } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const doList = useServerFn(customerListNotifications);
  const q = useQuery({ queryKey: ["notif-full", bank.slug], queryFn: () => doList({ data: { slug: bank.slug } }) });
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: primary }}>Notifications</h1>
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${primary}22`, color: primary }}>
            {unread} unread
          </span>
        </div>
      </BrandedCard>
      <BrandedCard manifest={bank.manifest}>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">No notifications yet.</div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{n.title}</div>
                  <span className="text-xs opacity-60">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                {n.body && <div className="mt-0.5 text-xs opacity-80">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase opacity-60">{n.kind}</div>
              </li>
            ))}
          </ul>
        )}
      </BrandedCard>
    </div>
  );
}
