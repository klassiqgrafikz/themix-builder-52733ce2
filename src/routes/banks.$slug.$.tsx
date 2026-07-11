// Back-compat splat: /banks/:slug/* → /:short_slug/*
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublishedBank } from "@/lib/website/registry.functions";

export const Route = createFileRoute("/banks/$slug/$")({
  beforeLoad: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw redirect({ href: "/", statusCode: 301 });
    const target = bank.short_slug ?? bank.slug;
    const splat = params._splat ?? "";
    const suffix = splat ? `/${splat.replace(/^\/+/, "")}` : "";
    throw redirect({ href: `/${target}${suffix}`, statusCode: 301 });
  },
  component: () => null,
});
