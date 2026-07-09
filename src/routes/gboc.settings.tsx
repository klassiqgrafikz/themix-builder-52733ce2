import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/gboc/platform-settings.functions";
import {
  getPlatformPin,
  updatePlatformPin,
} from "@/lib/gboc/platform-pin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/gboc/settings")({
  component: PlatformSettingsPage,
});

function PlatformSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSettings);
  const setFn = useServerFn(updatePlatformSettings);
  const q = useQuery({ queryKey: ["platform-settings"], queryFn: () => getFn() });
  const [live, setLive] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (q.data) {
      setLive(q.data.live_chat_enabled);
      setEmail(q.data.support_email ?? "");
      setPhone(q.data.support_phone ?? "");
    }
  }, [q.data]);
  const mut = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          live_chat_enabled: live,
          support_email: email || null,
          support_phone: phone || null,
        },
      }),
    onSuccess: () => {
      toast.success("Platform settings updated");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global controls that apply to every generated bank's customer portal.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Support Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Live chat available in tenant portals</div>
              <div className="text-xs text-muted-foreground">
                When enabled, every generated bank's Support Center exposes a Start Live Chat action.
              </div>
            </div>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Global support email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@themixweb.dev" />
            </div>
            <div>
              <Label>Global support phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 000 000 0000" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
