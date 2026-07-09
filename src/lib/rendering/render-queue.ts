import type { RenderStatus } from "./types";

// The render queue is a status-machine abstraction. Actual worker execution
// runs synchronously in the engine today; this module owns the transition
// rules so a future async worker can adopt them without behavioural change.

const TRANSITIONS: Record<RenderStatus, RenderStatus[]> = {
  draft: ["rendering", "archived"],
  rendering: ["ready", "draft", "archived"],
  ready: ["published", "rendering", "archived"],
  published: ["ready", "rendering", "archived"],
  archived: ["draft"],
};

export class RenderQueueError extends Error {}

export function assertTransition(from: RenderStatus, to: RenderStatus): void {
  if (from === to) return;
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new RenderQueueError(`Illegal render status transition: ${from} → ${to}`);
  }
}

// A tiny helper that describes the next status after a successful render.
export function nextAfterRender(): RenderStatus {
  return "ready";
}
