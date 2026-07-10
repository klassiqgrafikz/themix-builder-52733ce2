import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { resolveCustomDomainSlug } from "./lib/website/custom-domain-router.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosts we serve directly (no tenant-domain rewrite).
const PLATFORM_HOST_SUFFIXES = [".lovable.app", ".lovable.dev", "localhost", "127.0.0.1"];

function isPlatformHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return PLATFORM_HOST_SUFFIXES.some((s) => h === s || h.endsWith(s));
}

// Paths that must never be prefixed with /banks/<slug> — server functions,
// static assets, API routes, etc.
function shouldRewritePath(pathname: string): boolean {
  if (pathname.startsWith("/banks/")) return false;
  if (pathname.startsWith("/_")) return false; // _serverFn, _build, _router
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/assets/")) return false;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return false;
  }
  // Any request that looks like a static file (has an extension).
  if (/\.[a-zA-Z0-9]{1,6}$/.test(pathname)) return false;
  return true;
}

async function rewriteForCustomDomain(request: Request): Promise<Request> {
  const url = new URL(request.url);
  if (isPlatformHost(url.hostname)) return request;

  const slug = await resolveCustomDomainSlug(url.hostname);
  if (!slug) return request;
  if (!shouldRewritePath(url.pathname)) return request;

  const rewritten = new URL(url.toString());
  rewritten.pathname =
    url.pathname === "/" ? `/banks/${slug}` : `/banks/${slug}${url.pathname}`;
  return new Request(rewritten.toString(), request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const routed = await rewriteForCustomDomain(request);
      const response = await handler.fetch(routed, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
