// Public proxy: serves branding assets from the private `bank-branding` bucket.
// URL: /api/public/branding/:draftId/:kind  where kind ∈ login_logo | dashboard_logo
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["login_logo", "dashboard_logo"]);

export const Route = createFileRoute("/api/public/branding/$draftId/$kind")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { draftId, kind } = params;
        if (!ALLOWED.has(kind)) return new Response("Not found", { status: 404 });
        if (!/^[0-9a-f-]{20,40}$/i.test(draftId)) return new Response("Bad id", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: entries } = await supabaseAdmin.storage
          .from("bank-branding")
          .list(draftId, { limit: 20 });
        const file = (entries ?? []).find((f) => f.name.startsWith(`${kind}.`));
        if (!file) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage
          .from("bank-branding")
          .download(`${draftId}/${file.name}`);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=300, s-maxage=3600",
          },
        });
      },
    },
  },
});
