import type { ViewDirection } from "../types";

export interface DirectionalViewValidation {
  requestedDirectionMatched: boolean;
  newDirectionalAreaDominates: boolean;
  masterSceneStillRecognizable: boolean;
  designIdentityConsistent: boolean;
  architecturePlausible: boolean;
  nearDuplicate: boolean;
  reason: string;
}

const DIRECTION_COPY: Record<ViewDirection, { side: string; opposite: string }> = {
  left: { side: "LEFT", opposite: "right" },
  right: { side: "RIGHT", opposite: "left" },
};

export function buildDirectionalViewPrompt(
  direction: ViewDirection,
  userRequirements?: string
): string {
  const copy = DIRECTION_COPY[direction];
  return [
    "Create a completely NEW VIEW of the SAME completed interior shown in IMAGE 1.",
    "IMAGE 1 is only the visual reference for the room identity and finished design. It is not a canvas to edit, extend, crop, or preserve in place.",
    "",
    `NEW VIEW DIRECTION: Show the previously unseen ${copy.side} side of the room and make that side the dominant subject of the new image.`,
    `Change the camera position and viewing direction toward the ${copy.side} side. Compose approximately 60% newly revealed ${copy.side} area and retain approximately 40% recognizable context from the completed master scene.`,
    `Do not return IMAGE 1 with small furniture changes, a slight pan, or extra content added at an edge. The new image must clearly face a different part of the room, while some of the old ${copy.opposite} side and core completed scene remain visible as supporting context.`,
    "",
    "NEW-VIEW RULES:",
    "- Perspective, visible wall arrangement, openings, ceiling lines, occlusions, and furniture projection must change naturally because this is a different viewpoint.",
    "- Keep the room identity consistent: overall scale, completed design style, material palette, furniture design language, lighting, and construction quality.",
    "- Retain a recognizable portion of the core completed furniture area and room architecture, re-projected naturally from the new viewpoint.",
    "- Plausibly imagine areas that IMAGE 1 does not show. Do not force unseen space to match the original composition.",
    "- Keep the entire visible ceiling fully renovated and stylistically coherent; never reveal a raw construction ceiling.",
    "- Produce one photorealistic interior image with the same orientation and aspect ratio as IMAGE 1.",
    userRequirements?.trim()
      ? `ADDITIONAL REQUEST:\n${userRequirements.trim()}`
      : "ADDITIONAL REQUEST: None.",
  ].join("\n");
}

export function directionalViewValidationPassed(
  validation: DirectionalViewValidation
): boolean {
  return (
    validation.requestedDirectionMatched &&
    validation.newDirectionalAreaDominates &&
    validation.masterSceneStillRecognizable &&
    validation.designIdentityConsistent &&
    validation.architecturePlausible &&
    !validation.nearDuplicate
  );
}
