// Back-compat splat: /banks/:slug/* → /:short_slug/*
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";

export const Route = createFileRoute("/banks/$slug/$")({
  beforeLoad: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw redirect({ to: "/", statusCode: 301 });
    const target = bank.short_slug ?? bank.slug;
    const splat = params._splat ?? "";
    throw redirect({
      to: `/$slug/${splat}`.replace(/\/+$/g, ""),
      params: { slug: target },
      statusCode: 301,
    });
  },
  component: () => null,
});
