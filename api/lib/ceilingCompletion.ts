export interface CeilingCompletionValidation {
  ceilingVisible: boolean;
  fullyRenovated: boolean;
  exposedConstructionServices: boolean;
  rawSurfaceRemaining: boolean;
  reason: string;
}

export function ceilingCompletionPassed(
  validation: CeilingCompletionValidation
): boolean {
  return (
    !validation.ceilingVisible ||
    (validation.fullyRenovated &&
      !validation.exposedConstructionServices &&
      !validation.rawSurfaceRemaining)
  );
}

export function buildCeilingRepairPrompt(reason: string): string {
  return [
    "Perform one narrow correction to an existing interior result.",
    "IMAGE 1 is the original source/reference. IMAGE 2 is the generated candidate to repair.",
    `The ceiling failed completion inspection because: ${reason}`,
    "",
    "CEILING-ONLY REPAIR:",
    "- Starting from IMAGE 2, finish every visible ceiling area as a completed residential interior.",
    "- Remove or visually conceal exposed pipes, conduits, cables, hangers, suspension rods, cable trays, and unfinished service hardware.",
    "- Remove raw concrete, cement, substrate, stains, patches, formwork marks, and construction-state texture from ceiling surfaces.",
    "- Preserve load-bearing beams, slab edges, ceiling height, perimeter, planes, and all true structural geometry.",
    "- Preserve exactly the current camera, perspective, crop, walls, openings, floor, furniture, lighting mood, colors, and every completed design choice outside the unfinished ceiling work.",
    "- Do not redesign the room, rearrange furniture, add ornate ceiling geometry, change openings, or reframe the image.",
    "Return only the repaired photorealistic image.",
  ].join("\n");
}
