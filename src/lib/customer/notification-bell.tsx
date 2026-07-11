import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Check,
  Trash2,
  ArrowLeftRight,
  ShieldAlert,
  Landmark,
  LifeBuoy,
  Info,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  customerClearAllNotifications,
  customerDeleteNotification,
  customerListNotifications,
  customerMarkAllNotificationsRead,
  customerMarkNotificationRead,
  type CustomerNotif,
} from "./activity.functions";

function iconFor(kind: string): { Icon: LucideIcon; tone: string } {
  const k = (kind || "").toLowerCase();
  if (k.includes("transfer")) return { Icon: ArrowLeftRight, tone: "text-sky-600 bg-sky-50" };
  if (k.includes("transaction") || k.includes("payment"))
    return { Icon: Receipt, tone: "text-emerald-600 bg-emerald-50" };
  if (k.includes("security") || k.includes("login") || k.includes("device"))
    return { Icon: ShieldAlert, tone: "text-amber-600 bg-amber-50" };
  if (k.includes("gboc") || k.includes("platform"))
    return { Icon: Landmark, tone: "text-indigo-600 bg-indigo-50" };
  if (k.includes("support") || k.includes("ticket") || k.includes("chat"))
    return { Icon: LifeBuoy, tone: "text-violet-600 bg-violet-50" };
  return { Icon: Info, tone: "text-slate-600 bg-slate-100" };
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.round((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({
  slug,
  tone = "light",
}: {
  slug: string;
  tone?: "light" | "dark" | "gold";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const listFn = useServerFn(customerListNotifications);
  const q = useQuery({
    queryKey: ["portal-notif", slug],
    queryFn: () => listFn({ data: { slug } }),
    refetchInterval: 15000,
  });
  const items: CustomerNotif[] = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const markFn = useServerFn(customerMarkNotificationRead);
  const markAllFn = useServerFn(customerMarkAllNotificationsRead);
  const deleteFn = useServerFn(customerDeleteNotification);
  const clearAllFn = useServerFn(customerClearAllNotifications);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-notif", slug] });

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { slug, id } }),
    onSuccess: invalidate,
  });
  const markAllMut = useMutation({
    mutationFn: () => markAllFn({ data: { slug } }),
    onSuccess: () => {
      invalidate();
      toast.success("All marked as read");
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { slug, id } }),
    onSuccess: invalidate,
  });
  const clearMut = useMutation({
    mutationFn: () => clearAllFn({ data: { slug } }),
    onSuccess: () => {
      invalidate();
      toast.success("Notifications cleared");
    },
  });

  const btnStyle =
    tone === "dark"
      ? "text-white/85 hover:bg-white/10"
      : tone === "gold"
        ? "hover:bg-white/5"
        : "text-slate-700 hover:bg-slate-100";
  const iconColor = tone === "gold" ? "#c9a84c" : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full transition ${btnStyle}`}
        >
          <Bell className="h-5 w-5" style={iconColor ? { color: iconColor } : undefined} />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
              aria-label={`${unread} unread notifications`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 sm:w-[400px]"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Notifications</div>
            <div className="text-xs text-slate-500">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
              >
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => clearMut.mutate()}
                disabled={clearMut.isPending}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {q.isLoading ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-500">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-30" />
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const { Icon, tone: iTone } = iconFor(n.kind);
                const isUnread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className={`group relative px-4 py-3 ${isUnread ? "bg-sky-50/40" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${iTone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-sm font-semibold text-slate-900">
                            {n.title}
                            {isUnread && (
                              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 align-middle" />
                            )}
                          </div>
                          <span className="whitespace-nowrap text-[10px] text-slate-400">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => markMut.mutate(n.id)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                            >
                              <Check className="h-3 w-3" /> Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteMut.mutate(n.id)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t px-4 py-2 text-center">
          <Link
            to="/$slug/portal/notifications"
            params={{ slug }}
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
