import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/gboc/platform-settings.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessagesSquare, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/gboc/communications")({
  component: LiveChatPage,
});

function LiveChatPage() {
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
      toast.success("Live chat configuration saved");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Global chat availability for every tenant portal's Support Center.
          </p>
        </div>
        <Badge variant={live ? "default" : "secondary"}>
          {live ? "Live chat enabled" : "Disabled"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Users} label="Online agents" value="—" />
        <MetricCard icon={MessagesSquare} label="Active chats" value="—" />
        <MetricCard icon={Clock} label="Waiting customers" value="—" />
      </div>

      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
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
          <div className="flex items-center justify-between">
            <Link to="/gboc/settings" className="text-xs text-muted-foreground underline">
              Open full platform settings
            </Link>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
