import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { verifyPlatformPin } from "@/lib/gboc/platform-pin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

const KEY = "themix.platform-pin.ok";

/** Wraps administration surfaces. Prompts for the Platform PIN once per tab. */
export function PlatformPinGate({ children, area }: { children: React.ReactNode; area: string }) {
  // Read sessionStorage synchronously so client-side navigations between
  // gated pages don't flash the PIN card when it's already unlocked.
  const [ok, setOk] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(KEY) === "1";
  });
  const [pin, setPin] = useState("");
  const verifyFn = useServerFn(verifyPlatformPin);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(KEY) === "1") setOk(true);
  }, []);


  const mut = useMutation({
    mutationFn: () => verifyFn({ data: { pin } }),
    onSuccess: (r) => {
      if (r.ok) {
        window.sessionStorage.setItem(KEY, "1");
        setOk(true);
        toast.success("Access granted");
      } else {
        toast.error("Incorrect PIN");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Verification failed"),
  });

  if (ok) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>Platform PIN required</CardTitle>
          <CardDescription>Enter the Platform PIN to access {area}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length < 4) return toast.error("PIN must be at least 4 digits");
              mut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Platform PIN</Label>
              <PasswordInput
                inputMode="numeric"
                autoFocus
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {mut.isPending ? "Verifying…" : "Unlock"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Default PIN is <code>0499</code>. Change it in Platform Settings → Platform Security.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
