import type { RenderLogEntry, RenderStage } from "../rendering/types";

// The Publisher owns the "publishing" step of the lifecycle. It produces log
// entries for the transitions and never touches the manifest itself.

export function publishingStartedLog(): RenderLogEntry {
  return log("publishing_started", "info", "Publishing pipeline started");
}

export function publishingCompletedLog(route: string): RenderLogEntry {
  return log("publishing_completed", "info", `Website published at ${route}`);
}

export function routesRegisteredLog(route: string): RenderLogEntry {
  return log("routes_registered", "info", `Tenant route registered at ${route}`);
}

export function websiteGeneratedLog(pages: number): RenderLogEntry {
  return log("website_generated", "info", `Website generated with ${pages} page(s)`);
}

export function modulesInjectedLog(count: number): RenderLogEntry {
  return log("modules_injected", "info", `${count} module(s) injected into website`);
}

export function manifestLoadedLog(version: number): RenderLogEntry {
  return log("manifest_loaded", "info", `Website manifest v${version} loaded`);
}

export function publishingFailedLog(err: string): RenderLogEntry {
  return log("publishing_failed", "error", err);
}

function log(stage: RenderStage, level: RenderLogEntry["level"], message: string): RenderLogEntry {
  return { stage, level, message, at: new Date().toISOString() };
}

// The canonical public route for a bank short slug. Kept centralised so future
// custom-domain routing can override this without touching call sites.
// Prefers short_slug when available; falls back to the long slug.
export function publicRouteFor(slug: string): string {
  return `/${slug}`;
}
