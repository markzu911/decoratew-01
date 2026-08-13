import type { OrbitCameraRequest } from "../types";

export interface CameraViewValidation {
  cameraPositionChanged: boolean;
  orbitDirectionMatched: boolean;
  orbitMagnitudeMatched: boolean;
  targetRemainsCentered: boolean;
  foregroundBackgroundParallax: boolean;
  sharedArchitectureConsistent: boolean;
  furnitureIdentityConsistent: boolean;
  furniturePlacementConsistent: boolean;
  hiddenAreaDoesNotContradictMaster: boolean;
  compositionSimilarity: number;
  reason: string;
}

const MAX_ORBIT_COMPOSITION_SIMILARITY = 0.72;

const ROTATION_CONTRACTS: Record<OrbitCameraRequest["orbitAngle"], string> = {
  "left-45": [
    "Move the camera about 45 degrees LEFT along a horizontal arc around the orbit target.",
    "Reveal a meaningful area previously hidden beyond the LEFT edge of IMAGE 1.",
    "Previously visible architecture and furniture must shift toward the RIGHT side of the new frame, and some content near the old RIGHT edge should leave the frame.",
  ].join(" "),
  "left-90": [
    "Move the camera about 90 degrees LEFT along a horizontal arc around the orbit target.",
    "Reveal the wall or room area previously beyond the LEFT edge and make it the main subject.",
    "Most of IMAGE 1's frontal scene must move toward or beyond the RIGHT edge; the old front-facing windows and furniture cannot remain in the same canvas positions.",
  ].join(" "),
  "right-45": [
    "Move the camera about 45 degrees RIGHT along a horizontal arc around the orbit target.",
    "Reveal a meaningful area previously hidden beyond the RIGHT edge of IMAGE 1.",
    "Previously visible architecture and furniture must shift toward the LEFT side of the new frame, and some content near the old LEFT edge should leave the frame.",
  ].join(" "),
  "right-90": [
    "Move the camera about 90 degrees RIGHT along a horizontal arc around the orbit target.",
    "Reveal the wall or room area previously beyond the RIGHT edge and make it the main subject.",
    "Most of IMAGE 1's frontal scene must move toward or beyond the LEFT edge; the old front-facing windows and furniture cannot remain in the same canvas positions.",
  ].join(" "),
  back: [
    "Move the camera about 180 degrees along a horizontal arc around the orbit target to the opposite side.",
    "The scene centered in IMAGE 1 must be mostly behind the new camera and therefore mostly absent from the output.",
    "Show the plausible opposite side of the same room; returning the original front wall or original composition is invalid.",
  ].join(" "),
};

const DISTANCE_CONTRACTS: Record<OrbitCameraRequest["distance"], string> = {
  closer:
    "Move the camera forward by a clearly visible amount: foreground objects become larger and the field reveals less depth.",
  same:
    "Keep approximately the same radius from the room center, but still use the new rotated camera position and projection.",
  farther:
    "Move the camera backward by a clearly visible amount: reveal more floor and peripheral room area without extending the original pixels.",
};

const HEIGHT_CONTRACTS: Record<OrbitCameraRequest["height"], string> = {
  lower:
    "Lower the camera to seated eye level; the horizon and vertical perspective must visibly reflect the lower viewpoint.",
  same:
    "Keep a natural standing eye level while changing the horizontal viewpoint.",
  higher:
    "Raise the camera visibly; show more top surfaces and floor while keeping verticals architecturally believable.",
};

const FOV_CONTRACTS: Record<OrbitCameraRequest["fieldOfView"], string> = {
  standard: "Use a natural standard interior lens with no fisheye distortion.",
  wide: "Use a visibly wider interior field of view with straight architectural lines and no fisheye distortion.",
};

export function buildCameraMotionContract(movement: OrbitCameraRequest): string {
  return [
    "MANDATORY CAMERA TRANSFORM:",
    "This is a NEW CAMERA POSITION, not an edit of IMAGE 1 and not a furniture rearrangement.",
    "Move the camera on a circular arc around the stated orbit target and keep the lens looking at that same orbit target throughout the move.",
    "Do NOT leave the camera in place and merely yaw, pan, or turn its optical axis.",
    ROTATION_CONTRACTS[movement.orbitAngle],
    DISTANCE_CONTRACTS[movement.distance],
    HEIGHT_CONTRACTS[movement.height],
    FOV_CONTRACTS[movement.fieldOfView],
    "Re-project every retained wall, opening, ceiling edge, light, and furniture item through the new camera. Their world-space identities and relationships stay consistent, but their canvas positions, apparent angles, occlusions, and scale MUST change.",
    "A near-duplicate, same composition, same vanishing points, or result made mainly by adding/removing furniture is INVALID.",
  ].join("\n");
}

export function cameraValidationPassed(
  validation: CameraViewValidation
): boolean {
  return (
    validation.cameraPositionChanged &&
    validation.orbitDirectionMatched &&
    validation.orbitMagnitudeMatched &&
    validation.targetRemainsCentered &&
    validation.foregroundBackgroundParallax &&
    validation.sharedArchitectureConsistent &&
    validation.furnitureIdentityConsistent &&
    validation.furniturePlacementConsistent &&
    validation.hiddenAreaDoesNotContradictMaster &&
    validation.compositionSimilarity < MAX_ORBIT_COMPOSITION_SIMILARITY
  );
}

export function formatCameraMovementForLog(movement: OrbitCameraRequest): string {
  return [
    `orbit=${movement.orbitAngle}`,
    `distance=${movement.distance}`,
    `height=${movement.height}`,
    `fov=${movement.fieldOfView}`,
  ].join(",");
}
