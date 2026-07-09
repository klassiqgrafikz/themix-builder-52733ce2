// Public proxy: serves customer avatar from the private `customer-avatars` bucket.
// URL: /api/public/customer-avatar/:customerId
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/customer-avatar/$customerId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { customerId } = params;
        if (!/^[0-9a-f-]{20,40}$/i.test(customerId))
          return new Response("Bad id", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: entries } = await supabaseAdmin.storage
          .from("customer-avatars")
          .list(customerId, { limit: 20 });
        const file = (entries ?? []).find((f) => f.name.startsWith("avatar."));
        if (!file) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage
          .from("customer-avatars")
          .download(`${customerId}/${file.name}`);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=60, s-maxage=300",
          },
        });
      },
    },
  },
});
