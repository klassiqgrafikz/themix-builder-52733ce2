import type { BlueprintInput } from "./types";

// Blueprints are READ-ONLY. This loader returns a defensive deep clone so
// downstream stages can never mutate the source blueprint row.
export function loadBlueprint(blueprint: BlueprintInput): BlueprintInput {
  if (!blueprint) return null;
  return JSON.parse(JSON.stringify(blueprint)) as BlueprintInput;
}
