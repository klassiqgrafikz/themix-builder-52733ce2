import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import {
  addTrustedDevice,
  changePassword,
  changePin,
  listActiveSessions,
  listTrustedDevices,
  removeTrustedDevice,
  revokeOtherSessions,
  setTwoFactor,
} from "@/lib/customer/security.functions";
import { getLoginHistory } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/$slug/portal/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const qc = useQueryClient();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pin, setPin] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [twoFA, setTwoFA] = useState(session.customer.notification_prefs?.two_factor === true);

  const pwFn = useServerFn(changePassword);
  const pinFn = useServerFn(changePin);
  const twoFn = useServerFn(setTwoFactor);
  const devFn = useServerFn(listTrustedDevices);
  const addDev = useServerFn(addTrustedDevice);
  const rmDev = useServerFn(removeTrustedDevice);
  const sessFn = useServerFn(listActiveSessions);
  const revokeFn = useServerFn(revokeOtherSessions);
  const histFn = useServerFn(getLoginHistory);

  const devQ = useQuery({ queryKey: ["devices", bank.slug], queryFn: () => devFn({ data: { slug: bank.slug } }) });
  const sessQ = useQuery({ queryKey: ["sessions", bank.slug], queryFn: () => sessFn({ data: { slug: bank.slug } }) });
  const histQ = useQuery({ queryKey: ["hist", bank.slug], queryFn: () => histFn({ data: { slug: bank.slug } }) });

  const pwMut = useMutation({
    mutationFn: () => pwFn({ data: { slug: bank.slug, current_password: current, new_password: next } }),
    onSuccess: () => { toast.success("Password changed"); setCurrent(""); setNext(""); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const pinMut = useMutation({
    mutationFn: () => pinFn({ data: { slug: bank.slug, new_pin: pin } }),
    onSuccess: () => { toast.success("PIN saved"); setPin(""); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const twoMut = useMutation({
    mutationFn: (v: boolean) => twoFn({ data: { slug: bank.slug, enabled: v } }),
    onSuccess: (_r, v) => { setTwoFA(v); toast.success(v ? "2FA enabled" : "2FA disabled"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Security Center</h1>
        <p className="mt-1 text-sm opacity-70">Manage credentials, devices and sessions.</p>
      </BrandedCard>

      <div className="grid gap-6 md:grid-cols-2">
        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Change password</div>
          <div className="space-y-3">
            <div><Label>Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
            <div><Label>New password</Label><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
            <Button disabled={pwMut.isPending || !current || next.length < 8} onClick={() => pwMut.mutate()} style={{ backgroundColor: primary }}>
              {pwMut.isPending ? "Saving…" : "Update password"}
            </Button>
          </div>
        </BrandedCard>

        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Transaction PIN</div>
          <div className="space-y-3">
            <div><Label>New PIN (4-8 digits)</Label><Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></div>
            <Button disabled={pinMut.isPending || pin.length < 4} onClick={() => pinMut.mutate()} style={{ backgroundColor: primary }}>Save PIN</Button>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Two-factor authentication</div>
              <div className="text-xs opacity-70">Foundation — challenge codes coming soon.</div>
            </div>
            <Switch checked={twoFA} onCheckedChange={(v) => twoMut.mutate(v)} />
          </div>
        </BrandedCard>

        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold" style={{ color: primary }}>
            <span>Trusted devices</span>
            <div className="flex gap-2">
              <Input placeholder="Device name" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" onClick={() => { if (!deviceLabel) return; addDev({ data: { slug: bank.slug, label: deviceLabel } }).then(() => { setDeviceLabel(""); qc.invalidateQueries({ queryKey: ["devices", bank.slug] }); }); }}>Add</Button>
            </div>
          </div>
          {(devQ.data ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No trusted devices yet.</p>
          ) : (
            <ul className="divide-y">
              {(devQ.data ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs opacity-70">{d.user_agent ?? "Unknown UA"} · last used {new Date(d.last_used_at).toLocaleString()}</div>
                  </div>
                  <button className="text-xs underline text-red-600" onClick={() => rmDev({ data: { slug: bank.slug, id: d.id } }).then(() => qc.invalidateQueries({ queryKey: ["devices", bank.slug] }))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </BrandedCard>

        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold" style={{ color: primary }}>
            <span>Active sessions</span>
            <Button size="sm" variant="outline" onClick={() => revokeFn({ data: { slug: bank.slug } }).then(() => { toast.success("Other sessions signed out"); qc.invalidateQueries({ queryKey: ["sessions", bank.slug] }); })}>
              Sign out other sessions
            </Button>
          </div>
          <ul className="divide-y">
            {(sessQ.data ?? []).map((s) => (
              <li key={s.token_preview} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-mono">{s.token_preview}</div>
                  <div className="text-xs opacity-70">Expires {new Date(s.expires_at).toLocaleString()}</div>
                </div>
                {s.is_current && <span className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: `${primary}22`, color: primary }}>current</span>}
              </li>
            ))}
          </ul>
        </BrandedCard>
      </div>

      <BrandedCard manifest={bank.manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Login history</div>
        <ul className="divide-y text-sm">
          {(histQ.data ?? []).map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2">
              <span>{h.event}</span>
              <span className="text-xs opacity-70">{new Date(h.at).toLocaleString()}</span>
            </li>
          ))}
          {(histQ.data ?? []).length === 0 && <li className="py-3 text-sm opacity-70">No login events recorded.</li>}
        </ul>
      </BrandedCard>
    </div>
  );
}
