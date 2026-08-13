import express from "express";
import dotenv from "dotenv";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import {
  buildCameraMotionContract,
  cameraValidationPassed,
  formatCameraMovementForLog,
  type CameraViewValidation,
} from "./lib/cameraMovement";
import {
  buildCeilingRepairPrompt,
  ceilingCompletionPassed,
  type CeilingCompletionValidation,
} from "./lib/ceilingCompletion";
import {
  buildDirectionalViewPrompt,
  directionalViewValidationPassed,
  type DirectionalViewValidation,
} from "./lib/directionalView";
import { streamGeneratedImageResponse } from "./lib/streamingResponse";
import type {
  DesignStyle,
  GenerationMode,
  GenerateRequest,
  MasterDesignProfile,
  MasterSpatialProfile,
  OrbitCameraRequest,
  OrbitViewPlan,
  RenovationIntensity,
  RoomType,
  ViewDirection,
} from "./types";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const app = express();
app.use(express.json({ limit: "50mb" }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Initialize Gemini client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL = "gemini-3.1-flash-image";
const STYLE_ANALYSIS_MODEL = "gemini-3.5-flash-lite";
const STRUCTURE_VALIDATION_MODEL = "gemini-3.6-flash";
const STRUCTURE_VALIDATION_ENABLED =
  process.env.STRUCTURE_VALIDATION_ENABLED === "true";
// Gemini intentionally reports conservative visual-comparison confidence.
// Identical-image calibration is ~0.75, so 0.70 avoids rejecting a perfect
// match while every preservation criterion must still be explicitly true.
const STRUCTURE_CONFIDENCE_THRESHOLD = 0.7;

// --- Prompt builder ---

const ROOM_TYPE_GUIDANCE: Record<RoomType, string> = {
  auto: "Infer the room's most plausible function from its architecture, scale, openings, plumbing, and visible context.",
  "living-room": "Design this specifically as a living room with a comfortable social layout, clear circulation, and an appropriate focal point.",
  bedroom: "Design this specifically as a bedroom with a restful layout, practical bedside use, and comfortable circulation.",
  "dining-room": "Design this specifically as a dining room with a well-scaled dining setting, practical lighting, and unobstructed circulation.",
  kitchen: "Design this specifically as a kitchen, respecting all visible plumbing, ventilation, windows, doors, and service locations.",
  bathroom: "Design this specifically as a bathroom, respecting wet-area requirements and all visible plumbing, windows, doors, and ventilation.",
  study: "Design this specifically as a study with a focused workspace, useful storage, comfortable lighting, and uncluttered circulation.",
  other: "Treat this as a flexible multi-purpose interior and choose the most practical function and furniture from the visible spatial cues.",
};

const DESIGN_STYLE_GUIDANCE: Record<Exclude<DesignStyle, "smart">, string> = {
  "modern-minimal": "Modern minimalism: clean geometry, quiet neutral colors, warm wood accents, refined details, and restrained decoration.",
  "natural-wood": "Natural wood: warm timber, tactile natural materials, soft neutral textiles, abundant daylight, and a calm organic atmosphere.",
  cream: "Warm cream style: creamy off-whites, rounded forms, soft fabrics, warm lighting, and a cozy but uncluttered mood.",
  "italian-minimal": "Italian minimalism: elegant proportions, sophisticated stone and wood, low-profile furniture, dark accents, and precise detailing.",
  "light-luxury": "Understated light luxury: premium stone, subtle metal accents, layered lighting, tailored furniture, and restrained elegance without excess ornament.",
  "wabi-sabi": "Eastern wabi-sabi: earthy muted tones, natural imperfect textures, simple forms, generous negative space, and quiet atmospheric lighting.",
};

const INTENSITY_GUIDANCE: Record<RenovationIntensity, string> = {
  conservative: "CONSERVATIVE: Prioritize surface finishes, color, lighting, and only essential furniture. Keep the visual treatment restrained and close to the existing room.",
  standard: "STANDARD: Create a complete, balanced interior with appropriate furniture, layered lighting, textiles, storage, and tasteful accessories.",
  bold: "BOLD: Use more expressive materials, stronger color contrast, statement lighting, and richer decoration while still preserving every architectural element exactly.",
};

interface PaletteRole {
  color: string;
  approximateShare: number;
  semanticUses: string[];
}

interface ReferenceStyleProfile {
  overallStyle: string;
  palette: {
    dominant: PaletteRole;
    secondary: PaletteRole;
    accent: PaletteRole;
  };
  surfaces: {
    walls: string;
    floor: string;
    ceiling: string;
  };
  furniture: {
    seating: string;
    tables: string;
    storageAndMedia: string;
    formLanguage: string;
  };
  lighting: string;
  textiles: string;
  decorDensity: string;
  avoidTransfers: string[];
}

const REFERENCE_STYLE_SCHEMA = {
  type: "object",
  properties: {
    overallStyle: {
      type: "string",
      description: "A concise interior style identity based only on visible visual traits.",
    },
    palette: {
      type: "object",
      description: "Role-aware color distribution. Shares should total approximately 100 and distinguish background surfaces from localized furniture or accents.",
      properties: {
        dominant: {
          type: "object",
          properties: {
            color: { type: "string" },
            approximateShare: { type: "number" },
            semanticUses: { type: "array", items: { type: "string" } },
          },
          required: ["color", "approximateShare", "semanticUses"],
        },
        secondary: {
          type: "object",
          properties: {
            color: { type: "string" },
            approximateShare: { type: "number" },
            semanticUses: { type: "array", items: { type: "string" } },
          },
          required: ["color", "approximateShare", "semanticUses"],
        },
        accent: {
          type: "object",
          properties: {
            color: { type: "string" },
            approximateShare: { type: "number" },
            semanticUses: { type: "array", items: { type: "string" } },
          },
          required: ["color", "approximateShare", "semanticUses"],
        },
      },
      required: ["dominant", "secondary", "accent"],
    },
    surfaces: {
      type: "object",
      description: "Base material, color, sheen, and visual weight for each existing surface. Never describe or transfer geometry, construction, panel layouts, slats, moldings, coves, recesses, or built-in lighting.",
      properties: {
        walls: { type: "string" },
        floor: { type: "string" },
        ceiling: { type: "string" },
      },
      required: ["walls", "floor", "ceiling"],
    },
    furniture: {
      type: "object",
      description: "Transferable furniture design language without counts, positions, layout, or exact product identity.",
      properties: {
        seating: { type: "string" },
        tables: { type: "string" },
        storageAndMedia: { type: "string" },
        formLanguage: { type: "string" },
      },
      required: ["seating", "tables", "storageAndMedia", "formLanguage"],
    },
    lighting: {
      type: "string",
      description: "Light softness, contrast, color temperature, and illumination distribution only. Never name fixtures or copy coves, downlights, pendants, luminaires, recesses, channels, trays, or ceiling construction.",
    },
    textiles: { type: "string" },
    decorDensity: { type: "string" },
    avoidTransfers: {
      type: "array",
      description: "Explicit warnings against applying a localized reference color or material to the wrong semantic role.",
      items: { type: "string" },
    },
  },
  required: [
    "overallStyle",
    "palette",
    "surfaces",
    "furniture",
    "lighting",
    "textiles",
    "decorDensity",
    "avoidTransfers",
  ],
} as const;

function isPaletteRole(value: unknown): value is PaletteRole {
  if (!value || typeof value !== "object") return false;
  const role = value as Record<string, unknown>;
  return (
    typeof role.color === "string" &&
    typeof role.approximateShare === "number" &&
    Number.isFinite(role.approximateShare) &&
    Array.isArray(role.semanticUses) &&
    role.semanticUses.every((item) => typeof item === "string")
  );
}

function isReferenceStyleProfile(value: unknown): value is ReferenceStyleProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, any>;
  return (
    typeof profile.overallStyle === "string" &&
    isPaletteRole(profile.palette?.dominant) &&
    isPaletteRole(profile.palette?.secondary) &&
    isPaletteRole(profile.palette?.accent) &&
    typeof profile.surfaces?.walls === "string" &&
    typeof profile.surfaces?.floor === "string" &&
    typeof profile.surfaces?.ceiling === "string" &&
    typeof profile.furniture?.seating === "string" &&
    typeof profile.furniture?.tables === "string" &&
    typeof profile.furniture?.storageAndMedia === "string" &&
    typeof profile.furniture?.formLanguage === "string" &&
    typeof profile.lighting === "string" &&
    typeof profile.textiles === "string" &&
    typeof profile.decorDensity === "string" &&
    Array.isArray(profile.avoidTransfers) &&
    profile.avoidTransfers.every((item: unknown) => typeof item === "string")
  );
}

function formatReferenceStyleProfile(profile: ReferenceStyleProfile): string {
  const formatPaletteRole = (label: string, role: PaletteRole) =>
    `- ${label} (~${Math.round(role.approximateShare)}%): ${role.color}; use only for ${role.semanticUses.join(", ")}.`;

  return [
    `STYLE IDENTITY: ${profile.overallStyle}`,
    "COLOR DISTRIBUTION — PRESERVE BOTH PROPORTIONS AND SEMANTIC ROLES:",
    formatPaletteRole("Dominant", profile.palette.dominant),
    formatPaletteRole("Secondary", profile.palette.secondary),
    formatPaletteRole("Accent", profile.palette.accent),
    "ROLE-LOCKED SURFACE MAP:",
    `- Existing wall surfaces: ${profile.surfaces.walls}`,
    `- Existing floor surface: ${profile.surfaces.floor}`,
    `- Existing ceiling surface (color and finish only): ${profile.surfaces.ceiling}`,
    "ADAPTABLE FURNITURE DESIGN LANGUAGE:",
    `- Seating: ${profile.furniture.seating}`,
    `- Tables: ${profile.furniture.tables}`,
    `- Storage/media pieces: ${profile.furniture.storageAndMedia}`,
    `- Form language: ${profile.furniture.formLanguage}`,
    `LIGHTING: ${profile.lighting}`,
    `TEXTILES: ${profile.textiles}`,
    `DECOR DENSITY: ${profile.decorDensity}`,
    "DO NOT MISAPPLY REFERENCE TRAITS:",
    ...profile.avoidTransfers.map((item) => `- ${item}`),
  ].join("\n");
}

const MASTER_DESIGN_SCHEMA = {
  type: "object",
  properties: {
    designIdentity: {
      type: "string",
      description: "A concise identity for the confirmed renovation design.",
    },
    surfaces: {
      type: "object",
      properties: {
        walls: { type: "string" },
        floor: { type: "string" },
        ceiling: { type: "string" },
      },
      required: ["walls", "floor", "ceiling"],
    },
    furniture: {
      type: "array",
      description: "Stable reusable furniture identities visible in the master view.",
      items: {
        type: "object",
        properties: {
          identity: { type: "string" },
          appearance: { type: "string" },
          placement: {
            type: "string",
            description: "Placement relative to fixed walls, openings, and other furniture.",
          },
        },
        required: ["identity", "appearance", "placement"],
      },
    },
    lighting: { type: "string" },
    textilesAndDecor: { type: "string" },
    consistencyRules: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "designIdentity",
    "surfaces",
    "furniture",
    "lighting",
    "textilesAndDecor",
    "consistencyRules",
  ],
} as const;

const SPATIAL_ANCHOR_SCHEMA = {
  type: "object",
  properties: {
    identity: { type: "string" },
    description: { type: "string" },
    relationToOrbitTarget: { type: "string" },
  },
  required: ["identity", "description", "relationToOrbitTarget"],
} as const;

const MASTER_SPATIAL_SCHEMA = {
  type: "object",
  properties: {
    orbitTarget: {
      type: "object",
      properties: {
        identity: { type: "string" },
        description: { type: "string" },
      },
      required: ["identity", "description"],
    },
    camera: {
      type: "object",
      properties: {
        estimatedHeight: { type: "string" },
        estimatedDistance: { type: "string" },
        viewingDirection: { type: "string" },
        fieldOfView: { type: "string" },
      },
      required: [
        "estimatedHeight",
        "estimatedDistance",
        "viewingDirection",
        "fieldOfView",
      ],
    },
    roomEnvelope: {
      type: "object",
      properties: {
        walls: { type: "array", items: SPATIAL_ANCHOR_SCHEMA },
        openings: { type: "array", items: SPATIAL_ANCHOR_SCHEMA },
        ceilingFeatures: { type: "array", items: SPATIAL_ANCHOR_SCHEMA },
        floorPattern: { type: "string" },
      },
      required: ["walls", "openings", "ceilingFeatures", "floorPattern"],
    },
    furnitureAnchors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          identity: { type: "string" },
          relationToOrbitTarget: { type: "string" },
          relationToArchitecture: { type: "string" },
        },
        required: [
          "identity",
          "relationToOrbitTarget",
          "relationToArchitecture",
        ],
      },
    },
    hiddenAreaRules: { type: "array", items: { type: "string" } },
  },
  required: [
    "orbitTarget",
    "camera",
    "roomEnvelope",
    "furnitureAnchors",
    "hiddenAreaRules",
  ],
} as const;

const MASTER_SCENE_SCHEMA = {
  type: "object",
  properties: {
    designProfile: MASTER_DESIGN_SCHEMA,
    spatialProfile: MASTER_SPATIAL_SCHEMA,
  },
  required: ["designProfile", "spatialProfile"],
} as const;

function isMasterDesignProfile(value: unknown): value is MasterDesignProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, any>;
  return (
    typeof profile.designIdentity === "string" &&
    typeof profile.surfaces?.walls === "string" &&
    typeof profile.surfaces?.floor === "string" &&
    typeof profile.surfaces?.ceiling === "string" &&
    Array.isArray(profile.furniture) &&
    profile.furniture.every(
      (item: Record<string, unknown>) =>
        typeof item?.identity === "string" &&
        typeof item?.appearance === "string" &&
        typeof item?.placement === "string"
    ) &&
    typeof profile.lighting === "string" &&
    typeof profile.textilesAndDecor === "string" &&
    Array.isArray(profile.consistencyRules) &&
    profile.consistencyRules.every((item: unknown) => typeof item === "string")
  );
}

function isMasterSpatialProfile(value: unknown): value is MasterSpatialProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, any>;
  const anchorsValid = (anchors: unknown) =>
    Array.isArray(anchors) &&
    anchors.every(
      (anchor: Record<string, unknown>) =>
        typeof anchor?.identity === "string" &&
        typeof anchor?.description === "string" &&
        typeof anchor?.relationToOrbitTarget === "string"
    );
  return (
    typeof profile.orbitTarget?.identity === "string" &&
    typeof profile.orbitTarget?.description === "string" &&
    typeof profile.camera?.estimatedHeight === "string" &&
    typeof profile.camera?.estimatedDistance === "string" &&
    typeof profile.camera?.viewingDirection === "string" &&
    typeof profile.camera?.fieldOfView === "string" &&
    anchorsValid(profile.roomEnvelope?.walls) &&
    anchorsValid(profile.roomEnvelope?.openings) &&
    anchorsValid(profile.roomEnvelope?.ceilingFeatures) &&
    typeof profile.roomEnvelope?.floorPattern === "string" &&
    Array.isArray(profile.furnitureAnchors) &&
    profile.furnitureAnchors.every(
      (anchor: Record<string, unknown>) =>
        typeof anchor?.identity === "string" &&
        typeof anchor?.relationToOrbitTarget === "string" &&
        typeof anchor?.relationToArchitecture === "string"
    ) &&
    Array.isArray(profile.hiddenAreaRules) &&
    profile.hiddenAreaRules.every((rule: unknown) => typeof rule === "string")
  );
}

function formatMasterDesignProfile(profile: MasterDesignProfile): string {
  return [
    `CONFIRMED DESIGN IDENTITY: ${profile.designIdentity}`,
    "LOCKED SURFACE SPECIFICATION:",
    `- Walls: ${profile.surfaces.walls}`,
    `- Floor: ${profile.surfaces.floor}`,
    `- Ceiling: ${profile.surfaces.ceiling}`,
    "LOCKED FURNITURE SET:",
    ...profile.furniture.map(
      (item) =>
        `- ${item.identity}: ${item.appearance}. Placement: ${item.placement}`
    ),
    `LOCKED LIGHTING: ${profile.lighting}`,
    `LOCKED TEXTILES AND DECOR: ${profile.textilesAndDecor}`,
    "CROSS-VIEW CONSISTENCY RULES:",
    ...profile.consistencyRules.map((item) => `- ${item}`),
  ].join("\n");
}

function formatMasterSpatialProfile(profile: MasterSpatialProfile): string {
  const formatAnchors = (label: string, anchors: MasterSpatialProfile["roomEnvelope"]["walls"]) => [
    `${label}:`,
    ...anchors.map(
      (anchor) =>
        `- ${anchor.identity}: ${anchor.description}; relation to orbit target: ${anchor.relationToOrbitTarget}`
    ),
  ];

  return [
    `ORBIT TARGET: ${profile.orbitTarget.identity} — ${profile.orbitTarget.description}`,
    `MASTER CAMERA: height ${profile.camera.estimatedHeight}; distance ${profile.camera.estimatedDistance}; direction ${profile.camera.viewingDirection}; lens ${profile.camera.fieldOfView}`,
    ...formatAnchors("WALL ANCHORS", profile.roomEnvelope.walls),
    ...formatAnchors("OPENING ANCHORS", profile.roomEnvelope.openings),
    ...formatAnchors("CEILING ANCHORS", profile.roomEnvelope.ceilingFeatures),
    `FLOOR PATTERN: ${profile.roomEnvelope.floorPattern}`,
    "FURNITURE WORLD-SPACE ANCHORS:",
    ...profile.furnitureAnchors.map(
      (anchor) =>
        `- ${anchor.identity}: relative to target ${anchor.relationToOrbitTarget}; relative to architecture ${anchor.relationToArchitecture}`
    ),
    "HIDDEN-AREA CONTINUITY RULES:",
    ...profile.hiddenAreaRules.map((rule) => `- ${rule}`),
  ].join("\n");
}

function formatOrbitViewPlan(plan: OrbitViewPlan): string {
  const section = (label: string, values: string[]) => [
    `${label}:`,
    ...values.map((value) => `- ${value}`),
  ];
  return [
    `TARGET VIEW: ${plan.targetViewSummary}`,
    ...section("MUST REMAIN VISIBLE", plan.remainsVisible),
    ...section("MUST LEAVE FRAME", plan.leavesFrame),
    ...section("NEWLY REVEALED", plan.newlyRevealed),
    ...section("REQUIRED PARALLAX", plan.parallaxRules),
    ...section("FURNITURE ORIENTATION", plan.furnitureOrientations),
    ...section("ARCHITECTURE CONTINUITY", plan.architectureContinuity),
  ].join("\n");
}

interface PromptOptions {
  hasReference: boolean;
  referenceStyleProfile?: ReferenceStyleProfile;
  masterDesignProfile?: MasterDesignProfile;
  roomType: RoomType;
  designStyle: DesignStyle;
  renovationIntensity: RenovationIntensity;
  generationMode: GenerationMode;
  userRequirements?: string;
  editInstructions?: string;
  masterSpatialProfile?: MasterSpatialProfile;
  orbitCamera?: OrbitCameraRequest;
  orbitViewPlan?: OrbitViewPlan;
  viewDirection?: ViewDirection;
}

function buildCameraPrompt(
  profile: MasterDesignProfile,
  spatialProfile: MasterSpatialProfile,
  movement: OrbitCameraRequest,
  viewPlan: OrbitViewPlan,
  userRequirements?: string
): string {
  return [
    "You are creating a new photorealistic camera view of the SAME completed interior shown in IMAGE 1.",
    "IMAGE 1 is the confirmed master design and the world-space reference for this request. It is NOT a canvas to edit in place.",
    "",
    buildCameraMotionContract(movement),
    "",
    "CONFIRMED DESIGN TO PRESERVE:",
    formatMasterDesignProfile(profile),
    "",
    "LOCKED ROOM-SPATIAL MODEL:",
    formatMasterSpatialProfile(spatialProfile),
    "",
    "TARGET ORBIT VIEW PLAN:",
    formatOrbitViewPlan(viewPlan),
    "",
    "SPATIAL CONTINUITY RULES:",
    "- Preserve structure, openings, finishes, furniture identities, and relative placement in WORLD SPACE only. Their 2D canvas positions and apparent angles must change under the new camera.",
    "- Render visible objects from the correct new angle; do not substitute furniture or rearrange the confirmed layout.",
    "- Areas hidden in IMAGE 1 may be plausibly invented by extending the same architecture and design language.",
    "- Invent only what the new camera must reveal. Do not contradict anything visible in IMAGE 1.",
    "- The ceiling is a fully renovated, finished surface throughout the entire room. Never reveal bare concrete, construction substrate, exposed unfinished patches, or a raw ceiling in newly imagined areas.",
    "- Keep walls, floor, ceiling, doors, windows, furniture, lighting, textiles, and decor coherent as one continuous room.",
    userRequirements?.trim()
      ? `ADDITIONAL REQUEST FOR THIS VIEW:\n${userRequirements.trim()}`
      : "ADDITIONAL REQUEST FOR THIS VIEW: None.",
    "",
    "Return one new photorealistic interior image at the requested camera view and the same aspect ratio as IMAGE 1.",
  ].join("\n");
}

function buildRefinementPrompt(
  mode: "refine" | "refine-view",
  editInstructions: string,
  masterDesignProfile?: MasterDesignProfile
): string {
  const isPrimary = mode === "refine";
  return [
    "You are revising an existing photorealistic interior result from explicit user feedback.",
    isPrimary
      ? "IMAGE 1 is the original unfinished room and is the immutable truth for architecture, perspective, crop, and openings. IMAGE 2 is the current generated design to revise."
      : "IMAGE 1 is the current generated camera view to revise. IMAGE 2, when supplied, is the confirmed master design used only as a consistency anchor.",
    "",
    "USER FEEDBACK — THIS IS THE ONLY REQUESTED CHANGE:",
    editInstructions.trim(),
    "",
    "REVISION RULES:",
    "- Apply the feedback precisely while preserving every unrelated successful part of the current design.",
    "- Keep the current camera position, perspective, crop, architecture, furniture layout, and object identities unless the feedback explicitly asks to modify a movable object.",
    "- Never mirror, rotate, zoom, crop, extend, or reframe the image.",
    "- Keep the room photorealistic and constructionally coherent.",
    "- The entire visible ceiling must read as a completed renovated finish. Preserve its height, perimeter, beams, and geometry, but remove every raw concrete, unfinished substrate, stain, patch, and construction trace.",
    masterDesignProfile
      ? `CONSISTENCY ANCHOR:\n${formatMasterDesignProfile(masterDesignProfile)}`
      : "",
    "Return only the revised image.",
  ].filter(Boolean).join("\n");
}

export function buildPrompt({
  hasReference,
  referenceStyleProfile,
  masterDesignProfile,
  roomType,
  designStyle,
  renovationIntensity,
  generationMode,
  userRequirements,
  editInstructions,
  masterSpatialProfile,
  orbitCamera,
  orbitViewPlan,
  viewDirection,
}: PromptOptions): string {
  if (generationMode === "directional-view") {
    if (!viewDirection) throw new Error("INVALID_DIRECTIONAL_VIEW_REQUEST");
    return buildDirectionalViewPrompt(viewDirection, userRequirements);
  }

  if (generationMode === "camera-view") {
    if (
      !masterDesignProfile ||
      !masterSpatialProfile ||
      !orbitCamera ||
      !orbitViewPlan
    ) {
      throw new Error("INVALID_CAMERA_REQUEST");
    }
    return buildCameraPrompt(
      masterDesignProfile,
      masterSpatialProfile,
      orbitCamera,
      orbitViewPlan,
      userRequirements
    );
  }

  if (generationMode === "refine" || generationMode === "refine-view") {
    if (!editInstructions?.trim()) throw new Error("INVALID_EDIT_REQUEST");
    return buildRefinementPrompt(
      generationMode,
      editInstructions,
      masterDesignProfile
    );
  }
  const roomGuidance = ROOM_TYPE_GUIDANCE[roomType] ?? ROOM_TYPE_GUIDANCE.auto;
  const intensityGuidance =
    INTENSITY_GUIDANCE[renovationIntensity] ?? INTENSITY_GUIDANCE.standard;

  const selectedStyleGuidance = designStyle === "smart"
    ? DESIGN_STYLE_GUIDANCE["modern-minimal"]
    : DESIGN_STYLE_GUIDANCE[designStyle] ?? DESIGN_STYLE_GUIDANCE["modern-minimal"];

  const styleGuidance = masterDesignProfile
    ? [
        "The CONFIRMED MASTER DESIGN below is authoritative. Reproduce the same renovation identity in this new source view:",
        formatMasterDesignProfile(masterDesignProfile),
        "Do not redesign, restyle, substitute, simplify, or add a second design direction.",
      ].join("\n")
    : hasReference && referenceStyleProfile
      ? [
        "The REFERENCE STYLE PROFILE below is the primary and authoritative design direction:",
        formatReferenceStyleProfile(referenceStyleProfile),
        designStyle === "smart"
          ? "The style selector is SMART: do not add a separate preset style."
          : `The selected style tag is secondary only. It may add a subtle compatible nuance but must not override any reference color, material, surface, furniture, or lighting assignment: ${selectedStyleGuidance}`,
        ].join("\n")
      : selectedStyleGuidance;

  const referenceInstructions = hasReference && referenceStyleProfile
    ? [
        "REFERENCE PROFILE APPLICATION RULES:",
        "- The profile is abstract metadata, not another room or scene.",
        "- Apply every color and material only to the semantic role assigned to it. Never spread an accent or furniture color across floors, walls, or ceilings unless that surface field explicitly requests it.",
        "- Match the reference's furniture material, color, sheen, proportions, and form language, but adapt item count, scale, and placement to the source room.",
        "- Apply the lighting profile only as illumination, shadow softness, contrast, and color temperature. Never create visible LED strips, coves, luminous reveals, recessed channels, tray ceilings, false ceilings, or new ceiling levels.",
        "- Never copy the reference's architecture, room proportions, camera, openings, ceiling construction, furniture layout, exact product identity, artwork, plants, or individual decorative objects.",
        "",
      ]
    : [];

  const masterInstructions = masterDesignProfile
    ? [
        "MULTI-VIEW IMAGE ROLES:",
        "- IMAGE 1 is the current unfinished SOURCE VIEW. Its architecture, camera, perspective, crop, and openings are the only geometric truth for this output.",
        "- IMAGE 2 is the confirmed MASTER DESIGN VIEW. Use it only to keep surface finishes, furniture identity, material, color, proportions, lighting, textiles, and decor consistent.",
        "- Never copy IMAGE 2's viewpoint, wall geometry, openings, crop, furniture pixel positions, or room proportions into IMAGE 1.",
        "- When a master furniture item should be visible from this source view, render the same identifiable item from the correct new angle. Do not replace it with a different model.",
        "- Preserve furniture relationships from the master specification when supported by visible architectural anchors. Never invent an item solely to fill empty space.",
        "",
        "SHARED-ELEMENT CONSISTENCY — CRITICAL:",
        "- Both images show parts of the SAME room from different angles. Identify every architectural element visible in BOTH images (windows, doors, columns, beams, wall corners, ceiling edges, openings).",
        "- For every shared element, reproduce the EXACT same surface finish, color, material, sheen, and treatment from IMAGE 2 into IMAGE 1's view of that element.",
        "- If a wall is painted a specific color in IMAGE 2, the same wall must be the same color in IMAGE 1 — even if it is seen from a different angle or occupies a different canvas position.",
        "- If a window frame is black metal in IMAGE 2, it must be black metal in IMAGE 1. If a column is wrapped in a specific material in IMAGE 2, it must match in IMAGE 1.",
        "- Do not redesign a shared wall, window, column, ceiling, or floor differently just because the camera angle changed. Surface treatment is angle-independent.",
        "",
        "ORIENTATION LOCK — CRITICAL:",
        "- The output must preserve IMAGE 1's exact left-right and up-down orientation.",
        "- Do not mirror, flip, reflect, or transpose the source view horizontally or vertically.",
        "- When mapping furniture and finishes from IMAGE 2 into IMAGE 1's perspective, maintain correct spatial direction. A window on the left in IMAGE 1 must stay on the left in the output, even if that same window appears on the right in IMAGE 2.",
        "- NEVER output IMAGE 2 as-is or a near-duplicate of it. The output must be a genuine edit of IMAGE 1's pixels and composition.",
        "",
      ]
    : [];

  return [
    "You are a professional interior designer and architectural visualization artist.",
    "",
    ...masterInstructions,
    "EDITING MODE: Use semantic inpainting on the supplied SOURCE ROOM photograph. This is a constrained photo edit, not a request to generate a new or similar room.",
    "TASK: Directly edit this exact source photograph in place. Keep protected regions unchanged and modify only the explicitly editable regions described below.",
    "",
    "ROOM FUNCTION:",
    roomGuidance,
    "",
    "DESIGN DIRECTION:",
    styleGuidance,
    "",
    "USER REQUIREMENTS:",
    userRequirements?.trim() || "No additional user requirements were provided.",
    "Treat these requirements as authoritative unless they conflict with preserving the source architecture.",
    "",
    "RENOVATION INTENSITY:",
    intensityGuidance,
    "",
    ...referenceInstructions,
    "PROTECTED REGIONS — TREAT THESE AS A LOCKED MASK:",
    "- All wall boundaries, corners, junctions, thicknesses, recesses, and the room envelope.",
    "- Every window, door, glass panel, opening, frame, mullion, sill, and the exterior view framed by them.",
    "- Every column, beam, step, ceiling edge, slab edge, and fixed structural line.",
    "- The camera position, camera height, viewing direction, lens perspective, vanishing points, crop, and visible field of view.",
    "Do not repaint, redraw, clean up, replace, cover, add, remove, move, resize, merge, split, or reinterpret protected elements. Their geometry and canvas positions must remain exactly as in the source.",
    "",
    "EDITABLE REGIONS ONLY:",
    "- Change the finish, color, and material appearance inside existing wall, floor, and ceiling surface boundaries without changing those boundaries or adding architectural build-outs.",
    "- Visible exposed pipes, conduits, cables, hangers, suspension rods, cable trays, and unfinished service hardware on or below the ceiling are unfinished non-structural building services, not protected architectural geometry.",
    "- Remove or visually conceal those exposed construction services and complete the ceiling surface, while preserving every load-bearing beam, slab edge, ceiling height, perimeter, plane, and junction exactly.",
    "- Add lighting effects through illumination only, plus movable furniture, textiles, and decor in open areas. Do not add visible light strips, coves, luminous reveals, recessed channels, suspended ceilings, soffits, tray ceilings, partitions, built-in structures, new openings, or new window treatments that conceal an opening.",
    "- New movable objects may cast realistic shadows but must not cause the source architecture to be redrawn or substantially hidden.",
    "",
    "FINAL REQUIREMENTS:",
    "1. The output must be an edit of the supplied pixels and composition, not a reconstruction of a similar room.",
    "2. Preserve the exact original canvas composition, aspect ratio, and orientation. Do not crop, extend, zoom, rotate, mirror, flip, or reframe.",
    "3. The output must visually match IMAGE 1's camera, perspective, crop, and architecture — NOT IMAGE 2. If the output looks like IMAGE 2, it is wrong.",
    "4. Scale and arrange furnishings for the real source space while keeping circulation and all openings usable.",
    "5. Produce a photorealistic interior edit with believable materials, natural lighting, realistic shadows, and coherent scale.",
    "6. Before returning the image, visually compare it with the source and remove any change to a protected element.",
  ].join("\n");
}

interface StructureCriterion {
  preserved: boolean;
  confidence: number;
  reason: string;
}

interface StructureValidation {
  wallsAndCeiling: StructureCriterion;
  ceilingFinish: StructureCriterion;
  openings: StructureCriterion;
  columnsAndBeams: StructureCriterion;
  perspectiveAndCamera: StructureCriterion;
  cropAndComposition: StructureCriterion;
  summary: string;
}

const STRUCTURE_VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    wallsAndCeiling: {
      type: "object",
      description: "Whether all wall boundaries, corners, ceiling outlines, recesses, and junctions preserve the source geometry.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    ceilingFinish: {
      type: "object",
      description: "Whether every visible ceiling surface is fully renovated with no bare concrete, cement, unfinished substrate, construction stains, patches, or raw-building traces remaining.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    openings: {
      type: "object",
      description: "Whether every door, window, glazed panel, opening, frame, mullion, and sill keeps its count, position, size, and proportions.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    columnsAndBeams: {
      type: "object",
      description: "Whether columns, beams, steps, slab edges, and other structural lines remain unchanged, including preserving their absence where none exist.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    perspectiveAndCamera: {
      type: "object",
      description: "Whether camera position, camera height, viewing direction, lens perspective, and vanishing points are unchanged.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    cropAndComposition: {
      type: "object",
      description: "Whether crop, aspect ratio, field of view, and placement of fixed architecture within the canvas are unchanged.",
      properties: {
        preserved: { type: "boolean" },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["preserved", "confidence", "reason"],
    },
    summary: { type: "string" },
  },
  required: [
    "wallsAndCeiling",
    "ceilingFinish",
    "openings",
    "columnsAndBeams",
    "perspectiveAndCamera",
    "cropAndComposition",
    "summary",
  ],
} as const;

const STRUCTURE_CRITERIA: Array<keyof Omit<StructureValidation, "summary">> = [
  "wallsAndCeiling",
  "ceilingFinish",
  "openings",
  "columnsAndBeams",
  "perspectiveAndCamera",
  "cropAndComposition",
];

function isStructureValidation(value: unknown): value is StructureValidation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.summary !== "string") return false;

  return STRUCTURE_CRITERIA.every((key) => {
    const criterion = candidate[key];
    if (!criterion || typeof criterion !== "object") return false;
    const fields = criterion as Record<string, unknown>;
    return (
      typeof fields.preserved === "boolean" &&
      typeof fields.confidence === "number" &&
      Number.isFinite(fields.confidence) &&
      typeof fields.reason === "string"
    );
  });
}

export function structureValidationPassed(validation: StructureValidation): boolean {
  return STRUCTURE_CRITERIA.every((key) => {
    const criterion = validation[key];
    return (
      criterion.preserved &&
      criterion.confidence >= STRUCTURE_CONFIDENCE_THRESHOLD
    );
  });
}

export async function validateStructure(
  sourceImage: { mimeType: string; data: string },
  candidateImage: { mimeType: string; data: string }
): Promise<StructureValidation> {
  const interaction = await ai.interactions.create({
    model: STRUCTURE_VALIDATION_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Act as a strict architectural image-comparison inspector.",
          "Compare SOURCE IMAGE A with EDITED IMAGE B. Ignore permitted changes to surface colors/materials, lighting, movable furniture, textiles, and decor.",
          "The ceilingFinish criterion is different from geometry preservation: pass it only when every visible ceiling area in IMAGE B clearly looks like a completed renovated finish, with no raw concrete, cement, substrate, patches, stains, formwork texture, or construction-state appearance remaining.",
          "Fail a criterion if any fixed geometry changed, if the relevant source feature is missing or redesigned, or if uncertainty prevents a confident match.",
          "Furniture-only occlusion is not itself a geometry change, but fail if it substantially prevents verification of a protected opening or structural boundary.",
          "For openings, compare the exact count, canvas position, width/height proportions, frame divisions, and visible exterior framing of every door, window, and glass panel.",
          "For perspective, compare vanishing directions and the relative canvas positions of fixed architectural intersections. Do not accept a merely similar room.",
          "Confidence must be a number from 0 to 1. Be conservative: when in doubt, set preserved to false.",
        ].join("\n"),
      },
      { type: "text", text: "SOURCE IMAGE A — immutable original room:" },
      {
        type: "image",
        mime_type: sourceImage.mimeType,
        data: sourceImage.data,
      },
      { type: "text", text: "EDITED IMAGE B — candidate to inspect:" },
      {
        type: "image",
        mime_type: candidateImage.mimeType,
        data: candidateImage.data,
      },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: STRUCTURE_VALIDATION_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("STRUCTURE_VALIDATION_UNAVAILABLE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("STRUCTURE_VALIDATION_UNAVAILABLE");
  }

  if (!isStructureValidation(parsed)) {
    throw new Error("STRUCTURE_VALIDATION_UNAVAILABLE");
  }

  return parsed;
}

const ORBIT_VIEW_PLAN_SCHEMA = {
  type: "object",
  properties: {
    targetViewSummary: { type: "string" },
    remainsVisible: { type: "array", items: { type: "string" } },
    leavesFrame: { type: "array", items: { type: "string" } },
    newlyRevealed: { type: "array", items: { type: "string" } },
    parallaxRules: { type: "array", items: { type: "string" } },
    furnitureOrientations: { type: "array", items: { type: "string" } },
    architectureContinuity: { type: "array", items: { type: "string" } },
  },
  required: [
    "targetViewSummary",
    "remainsVisible",
    "leavesFrame",
    "newlyRevealed",
    "parallaxRules",
    "furnitureOrientations",
    "architectureContinuity",
  ],
} as const;

function isOrbitViewPlan(value: unknown): value is OrbitViewPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  const stringList = (field: unknown) =>
    Array.isArray(field) && field.every((item) => typeof item === "string");
  return (
    typeof plan.targetViewSummary === "string" &&
    stringList(plan.remainsVisible) &&
    stringList(plan.leavesFrame) &&
    stringList(plan.newlyRevealed) &&
    stringList(plan.parallaxRules) &&
    stringList(plan.furnitureOrientations) &&
    stringList(plan.architectureContinuity)
  );
}

async function planOrbitView(
  masterImage: { mimeType: string; data: string },
  designProfile: MasterDesignProfile,
  spatialProfile: MasterSpatialProfile,
  movement: OrbitCameraRequest
): Promise<OrbitViewPlan> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Plan a single target view produced by moving a camera on a circular arc around the locked orbit target in this interior.",
          buildCameraMotionContract(movement),
          formatMasterSpatialProfile(spatialProfile),
          formatMasterDesignProfile(designProfile),
          "Use MASTER IMAGE A as visible evidence. Describe world-space consequences, foreground/background parallax, items leaving frame, retained anchors, and only the hidden regions that must be plausibly revealed.",
          "Do not redesign the room, move furniture in world space, or treat a pan/yaw from the original camera position as an orbit.",
          "For hidden regions, extend the simplest architecture consistent with visible evidence and explicitly prevent contradictions.",
        ].join("\n"),
      },
      { type: "text", text: "MASTER IMAGE A:" },
      { type: "image", mime_type: masterImage.mimeType, data: masterImage.data },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: ORBIT_VIEW_PLAN_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("ORBIT_VIEW_PLAN_FAILED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("ORBIT_VIEW_PLAN_FAILED");
  }
  if (!isOrbitViewPlan(parsed)) throw new Error("ORBIT_VIEW_PLAN_FAILED");
  return parsed;
}

const CEILING_COMPLETION_SCHEMA = {
  type: "object",
  properties: {
    ceilingVisible: { type: "boolean" },
    fullyRenovated: { type: "boolean" },
    exposedConstructionServices: { type: "boolean" },
    rawSurfaceRemaining: { type: "boolean" },
    reason: { type: "string" },
  },
  required: [
    "ceilingVisible",
    "fullyRenovated",
    "exposedConstructionServices",
    "rawSurfaceRemaining",
    "reason",
  ],
} as const;

function isCeilingCompletionValidation(
  value: unknown
): value is CeilingCompletionValidation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ceilingVisible === "boolean" &&
    typeof candidate.fullyRenovated === "boolean" &&
    typeof candidate.exposedConstructionServices === "boolean" &&
    typeof candidate.rawSurfaceRemaining === "boolean" &&
    typeof candidate.reason === "string"
  );
}

export async function validateCeilingCompletion(candidateImage: {
  mimeType: string;
  data: string;
}): Promise<CeilingCompletionValidation> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Inspect only the visible ceiling in this generated residential interior.",
          "Set ceilingVisible false only when essentially no ceiling can be judged.",
          "A completed ceiling must have a deliberate finished surface and must not show construction-state elements.",
          "Set exposedConstructionServices true when visible pipes, ducts, conduits, cables, cable trays, suspension rods, hangers, loose wiring, or unfinished service hardware remain exposed on or below the ceiling.",
          "Set rawSurfaceRemaining true when concrete, cement, substrate, formwork marks, construction stains, patches, or other raw-building texture remains.",
          "Ordinary finished decorative lights and clearly intentional finished structural beams are allowed. Do not excuse exposed construction services merely because they are arranged neatly or painted.",
          "Be strict and explain the most visible evidence.",
        ].join("\n"),
      },
      {
        type: "image",
        mime_type: candidateImage.mimeType,
        data: candidateImage.data,
      },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: CEILING_COMPLETION_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("CEILING_COMPLETION_VALIDATION_UNAVAILABLE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("CEILING_COMPLETION_VALIDATION_UNAVAILABLE");
  }
  if (!isCeilingCompletionValidation(parsed)) {
    throw new Error("CEILING_COMPLETION_VALIDATION_UNAVAILABLE");
  }
  return parsed;
}

const DIRECTIONAL_VIEW_VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    requestedDirectionMatched: { type: "boolean" },
    newDirectionalAreaDominates: { type: "boolean" },
    masterSceneStillRecognizable: { type: "boolean" },
    designIdentityConsistent: { type: "boolean" },
    architecturePlausible: { type: "boolean" },
    nearDuplicate: { type: "boolean" },
    reason: { type: "string" },
  },
  required: [
    "requestedDirectionMatched",
    "newDirectionalAreaDominates",
    "masterSceneStillRecognizable",
    "designIdentityConsistent",
    "architecturePlausible",
    "nearDuplicate",
    "reason",
  ],
} as const;

function isDirectionalViewValidation(
  value: unknown
): value is DirectionalViewValidation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.requestedDirectionMatched === "boolean" &&
    typeof candidate.newDirectionalAreaDominates === "boolean" &&
    typeof candidate.masterSceneStillRecognizable === "boolean" &&
    typeof candidate.designIdentityConsistent === "boolean" &&
    typeof candidate.architecturePlausible === "boolean" &&
    typeof candidate.nearDuplicate === "boolean" &&
    typeof candidate.reason === "string"
  );
}

async function validateDirectionalView(
  sourceImage: { mimeType: string; data: string },
  candidateImage: { mimeType: string; data: string },
  direction: ViewDirection
): Promise<DirectionalViewValidation> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Compare two interior images. IMAGE A is the completed master room. IMAGE B should be a new camera view that preserves a recognizable portion of that room while revealing its previously unseen requested side.",
          `Requested side: ${direction.toUpperCase()}.`,
          "The target composition is approximately 60% meaningful newly revealed side area and 40% recognizable completed master-scene context. This is a semantic visual estimate, not a pixel measurement.",
          "Do not require matching canvas positions, perspective, occlusion, furniture projection, or ceiling projection. These must change naturally in a new view.",
          "Pass requestedDirectionMatched only when IMAGE B clearly faces the requested side with a globally different viewpoint, rather than adding objects or a narrow strip at one edge.",
          "Pass newDirectionalAreaDominates only when the requested new side is the main subject and occupies roughly 55% to 65% of IMAGE B.",
          "Pass masterSceneStillRecognizable only when roughly 35% to 45% of IMAGE B retains recognizable completed-room context from IMAGE A, such as part of its core furniture area and architecture, naturally re-projected in the new view.",
          "Judge design identity by style, material palette, furniture language, lighting, finish quality, and believable room scale—not by identical structure.",
          "Set nearDuplicate true if IMAGE B substantially repeats IMAGE A's framing even when furniture was added, removed, or rearranged.",
          "Be strict and concise.",
        ].join("\n"),
      },
      { type: "text", text: "IMAGE A — completed-room reference:" },
      { type: "image", mime_type: sourceImage.mimeType, data: sourceImage.data },
      { type: "text", text: "IMAGE B — candidate directional view:" },
      { type: "image", mime_type: candidateImage.mimeType, data: candidateImage.data },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: DIRECTIONAL_VIEW_VALIDATION_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("DIRECTIONAL_VIEW_VALIDATION_UNAVAILABLE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("DIRECTIONAL_VIEW_VALIDATION_UNAVAILABLE");
  }
  if (!isDirectionalViewValidation(parsed)) {
    throw new Error("DIRECTIONAL_VIEW_VALIDATION_UNAVAILABLE");
  }
  return parsed;
}

const CAMERA_VIEW_VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    cameraPositionChanged: { type: "boolean" },
    orbitDirectionMatched: { type: "boolean" },
    orbitMagnitudeMatched: { type: "boolean" },
    targetRemainsCentered: { type: "boolean" },
    foregroundBackgroundParallax: { type: "boolean" },
    sharedArchitectureConsistent: { type: "boolean" },
    furnitureIdentityConsistent: { type: "boolean" },
    furniturePlacementConsistent: { type: "boolean" },
    hiddenAreaDoesNotContradictMaster: { type: "boolean" },
    compositionSimilarity: {
      type: "number",
      description: "0 means a clearly different projection; 1 means essentially the same camera and composition.",
    },
    reason: { type: "string" },
  },
  required: [
    "cameraPositionChanged",
    "orbitDirectionMatched",
    "orbitMagnitudeMatched",
    "targetRemainsCentered",
    "foregroundBackgroundParallax",
    "sharedArchitectureConsistent",
    "furnitureIdentityConsistent",
    "furniturePlacementConsistent",
    "hiddenAreaDoesNotContradictMaster",
    "compositionSimilarity",
    "reason",
  ],
} as const;

function isCameraViewValidation(value: unknown): value is CameraViewValidation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cameraPositionChanged === "boolean" &&
    typeof candidate.orbitDirectionMatched === "boolean" &&
    typeof candidate.orbitMagnitudeMatched === "boolean" &&
    typeof candidate.targetRemainsCentered === "boolean" &&
    typeof candidate.foregroundBackgroundParallax === "boolean" &&
    typeof candidate.sharedArchitectureConsistent === "boolean" &&
    typeof candidate.furnitureIdentityConsistent === "boolean" &&
    typeof candidate.furniturePlacementConsistent === "boolean" &&
    typeof candidate.hiddenAreaDoesNotContradictMaster === "boolean" &&
    typeof candidate.compositionSimilarity === "number" &&
    Number.isFinite(candidate.compositionSimilarity) &&
    candidate.compositionSimilarity >= 0 &&
    candidate.compositionSimilarity <= 1 &&
    typeof candidate.reason === "string"
  );
}

async function validateCameraView(
  sourceImage: { mimeType: string; data: string },
  candidateImage: { mimeType: string; data: string },
  movement: OrbitCameraRequest,
  spatialProfile: MasterSpatialProfile,
  viewPlan: OrbitViewPlan
): Promise<CameraViewValidation> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Act as a strict camera-view comparison inspector for two interior images of the same room.",
           "Determine whether CANDIDATE IMAGE B is genuinely rendered from the requested new camera position relative to MASTER IMAGE A.",
           buildCameraMotionContract(movement),
           formatMasterSpatialProfile(spatialProfile),
           formatOrbitViewPlan(viewPlan),
           "Judge fixed architectural evidence first: vanishing points, window and wall-edge positions, ceiling outlines, foreground parallax, newly revealed areas, and areas that left the frame.",
          "An in-place yaw or pan does NOT count as orbiting. Require foreground-background parallax proving that the camera position moved along an arc while continuing to look at the same orbit target.",
          "Estimate whether the requested 45/90/180-degree magnitude class is plausible; reject a much smaller move.",
          "Fail sharedArchitectureConsistent when visible walls, openings, ceiling anchors, or floor patterns contradict the master spatial model.",
          "Fail furniture identity or placement when important visible items are substituted, duplicated, deleted without leaving frame, or moved in world space.",
          "Adding, removing, resizing, or rearranging furniture while keeping the same architecture projection does NOT count as moving the camera.",
          "Set compositionSimilarity near 1 when architectural lines and openings occupy nearly the same canvas positions, even if furniture differs.",
          "Be strict. If the requested direction is ambiguous or the result is a near-duplicate, mark both booleans false as appropriate.",
        ].join("\n"),
      },
      { type: "text", text: "MASTER IMAGE A:" },
      { type: "image", mime_type: sourceImage.mimeType, data: sourceImage.data },
      { type: "text", text: "CANDIDATE IMAGE B:" },
      { type: "image", mime_type: candidateImage.mimeType, data: candidateImage.data },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: CAMERA_VIEW_VALIDATION_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("CAMERA_VALIDATION_UNAVAILABLE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("CAMERA_VALIDATION_UNAVAILABLE");
  }
  if (!isCameraViewValidation(parsed)) {
    throw new Error("CAMERA_VALIDATION_UNAVAILABLE");
  }
  return parsed;
}

export async function analyzeReferenceStyle(referenceImage: {
  mimeType: string;
  data: string;
}): Promise<ReferenceStyleProfile> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Analyze the supplied interior reference as a role-aware design system for application to a different source room.",
          "Distinguish dominant background surfaces from secondary materials and localized accent or furniture colors. Estimate their visual shares and bind every color to its actual semantic uses.",
          "Describe wall, floor, and ceiling base appearance separately, including color, material impression, sheen, and visual weight. Do not transfer panel layouts, slats, moldings, grooves, or decorative construction. For the ceiling return only its base color and surface finish; never mention lighting construction, recesses, coves, channels, trays, drops, or perimeter geometry.",
          "Extract transferable furniture design language for seating, tables, and storage/media pieces: material, color, sheen, silhouette, softness, and visual weight. Never provide counts, positions, layout, or exact product identity.",
          "Extract lighting softness, contrast, color temperature, and illumination distribution. Translate all visible fixtures and built-in systems into an equivalent lighting mood only. Do not name downlights, pendants, luminaires, coves, recesses, channels, trays, or any fixture/construction type.",
          "Add explicit avoidTransfers warnings for any localized dark, vivid, glossy, metallic, or patterned trait that would look wrong if spread onto walls, floors, or ceilings.",
          "Ignore room geometry, camera angle, openings, furniture placement, artwork, plants, flowers, and individual decorative objects.",
          "Use concise English. Base every field only on visible evidence; if a category is unclear, describe it as visually unobtrusive rather than inventing details.",
        ].join("\n"),
      },
      {
        type: "image",
        mime_type: referenceImage.mimeType,
        data: referenceImage.data,
      },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: REFERENCE_STYLE_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) {
    throw new Error("REFERENCE_STYLE_ANALYSIS_FAILED");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("REFERENCE_STYLE_ANALYSIS_FAILED");
  }

  if (!isReferenceStyleProfile(parsed)) {
    throw new Error("REFERENCE_STYLE_ANALYSIS_FAILED");
  }

  return parsed;
}

function parseBase64Image(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  return match
    ? { mimeType: match[1], data: match[2] }
    : { mimeType: "image/jpeg", data: dataUrl };
}

function isOrbitCameraRequest(value: unknown): value is OrbitCameraRequest {
  if (!value || typeof value !== "object") return false;
  const movement = value as Record<string, unknown>;
  return (
    ["left-45", "left-90", "right-45", "right-90", "back"].includes(
      String(movement.orbitAngle)
    ) &&
    ["closer", "same", "farther"].includes(String(movement.distance)) &&
    ["lower", "same", "higher"].includes(String(movement.height)) &&
    ["standard", "wide"].includes(String(movement.fieldOfView))
  );
}

export async function analyzeMasterDesign(masterImage: {
  mimeType: string;
  data: string;
}, roomType: RoomType): Promise<{
  designProfile: MasterDesignProfile;
  spatialProfile: MasterSpatialProfile;
}> {
  const interaction = await ai.interactions.create({
    model: STYLE_ANALYSIS_MODEL,
    input: [
      {
        type: "text",
        text: [
          "Analyze this confirmed primary-view renovation as both a design specification and a single-image spatial model for orbit-camera generation.",
          ROOM_TYPE_GUIDANCE[roomType] ?? ROOM_TYPE_GUIDANCE.auto,
          "For designProfile, record exact reusable finishes, furniture identities, lighting, textiles, and consistency rules.",
          "Create stable furniture identities for every visually important movable item. Describe material, color, sheen, silhouette, proportions, and distinctive details so the same item can be rendered from another camera angle.",
          "Describe each furniture item's placement relative to fixed architectural anchors and other furniture, not relative to pixel coordinates.",
          "Record lighting only as illumination, softness, contrast, distribution, and color temperature. Never encode ceiling construction or visible lighting channels.",
          "Record textiles and decor as a restrained reusable set. Include explicit consistency rules that prevent substitutions, count drift, color drift, or style drift across views.",
          "For spatialProfile, choose one stable orbit target: normally the center of the main furniture/activity group, otherwise the usable room center.",
          "Estimate the master camera height, distance, viewing direction, and field of view in qualitative but operational language.",
          "Create stable IDs for visible walls, windows, doors, ceiling features, floor pattern, and important furniture. Describe each anchor relative to the orbit target and fixed architecture, never only by pixel coordinates.",
          "Add hidden-area rules that allow plausible completion while forbidding contradictions with visible walls, openings, furniture, and circulation.",
          "Do not claim metric precision or invent hidden objects as observed facts. Use concise English and visible evidence only.",
        ].join("\n"),
      },
      {
        type: "image",
        mime_type: masterImage.mimeType,
        data: masterImage.data,
      },
    ] as any,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: MASTER_SCENE_SCHEMA,
    } as any,
  });

  const output = (interaction as any).output_text?.trim();
  if (!output) throw new Error("MASTER_DESIGN_ANALYSIS_FAILED");

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("MASTER_DESIGN_ANALYSIS_FAILED");
  }
  const scene = parsed as Record<string, unknown>;
  if (
    !isMasterDesignProfile(scene?.designProfile) ||
    !isMasterSpatialProfile(scene?.spatialProfile)
  ) {
    throw new Error("MASTER_DESIGN_ANALYSIS_FAILED");
  }
  return {
    designProfile: scene.designProfile,
    spatialProfile: scene.spatialProfile,
  };
}

function getPublicApiError(err: any): { status: number; message: string } {
  const errStr =
    typeof err?.message === "string" ? err.message : JSON.stringify(err ?? {});
  const status = Number(err?.status ?? err?.statusCode ?? 500);

  if (
    status === 429 ||
    errStr.includes("prepayment credits are depleted") ||
    errStr.includes("too_many_requests")
  ) {
    return {
      status: 429,
      message: "Gemini API 预付费额度已耗尽，请充值或更换可用的 API Key。",
    };
  }
  if (errStr.includes("API Key") || errStr.includes("PERMISSION_DENIED")) {
    return { status: 403, message: "API Key 权限不足，请检查密钥配置。" };
  }
  if (errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
    return { status: 429, message: "API 调用额度已达到上限，请稍后再试。" };
  }
  if (errStr.includes("TIMEOUT") || err?.message === "TIMEOUT") {
    return { status: 504, message: "生成超时，请尝试上传更小尺寸的图片。" };
  }
  if (errStr.includes("MASTER_DESIGN_ANALYSIS_FAILED")) {
    return { status: 422, message: "无法从主视角提取统一设计方案，请重试。" };
  }
  if (errStr.includes("STRUCTURE_VALIDATION_UNAVAILABLE")) {
    return {
      status: 503,
      message: "结构校验暂时不可用，本次结果未返回，请稍后重试。",
    };
  }
  if (errStr.includes("CAMERA_VALIDATION_UNAVAILABLE")) {
    return {
      status: 503,
      message: "镜头变化校验暂时不可用，本次结果未返回，请稍后重试。",
    };
  }
  if (errStr.includes("DIRECTIONAL_VIEW_VALIDATION_UNAVAILABLE")) {
    return {
      status: 503,
      message: "左右视图校验暂时不可用，本次结果未返回，请稍后重试。",
    };
  }
  if (errStr.includes("CEILING_COMPLETION_VALIDATION_UNAVAILABLE")) {
    return {
      status: 503,
      message: "天花板完成度校验暂时不可用，本次结果未返回，请稍后重试。",
    };
  }
  if (errStr.includes("ORBIT_VIEW_PLAN_FAILED")) {
    return {
      status: 422,
      message: "无法规划稳定的环绕视角，请重新确认主方案后再试。",
    };
  }
  if (errStr.includes("INTERNAL") || status >= 500) {
    return { status: 500, message: "服务器内部错误，请稍后重试。" };
  }
  return { status: 500, message: "生成失败，请稍后重试。" };
}

// --- Routes ---

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    geminiConfigured: !!GEMINI_API_KEY,
    structureValidationEnabled: STRUCTURE_VALIDATION_ENABLED,
    streamingImageResponseEnabled: true,
  });
});

app.post("/api/analyze-master", async (req, res) => {
  try {
    const { masterImage, roomType = "auto" } = req.body as {
      masterImage?: string;
      roomType?: RoomType;
    };
    if (!masterImage) {
      res.status(400).json({ success: false, error: "缺少主视角效果图" });
      return;
    }
    if (!GEMINI_API_KEY) {
      res.status(500).json({ success: false, error: "服务端未配置 GEMINI_API_KEY" });
      return;
    }

    console.log(`[master] Extracting confirmed design with ${STYLE_ANALYSIS_MODEL}`);
    const scene = await analyzeMasterDesign(parseBase64Image(masterImage), roomType);
    res.json({
      success: true,
      profile: scene.designProfile,
      spatialProfile: scene.spatialProfile,
    });
  } catch (err: any) {
    console.error("[master] Error:", err);
    const publicError = getPublicApiError(err);
    res.status(publicError.status).json({ success: false, error: publicError.message });
  }
});

// Generate: transform raw room with optional reference style
app.post("/api/generate", async (req, res) => {
  try {
    const {
      rawImage,
      referenceImage,
      editImage,
      masterImage,
      masterDesignProfile,
      masterSpatialProfile,
      generationMode = "initial",
      userRequirements,
      editInstructions,
      orbitCamera,
      viewDirection,
      aspectRatio,
      roomType = "auto",
      designStyle = "smart",
      renovationIntensity = "standard",
    } = req.body as Partial<GenerateRequest>;

    if (!rawImage) {
      res.status(400).json({ success: false, error: "缺少毛坯房图片" });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(500).json({ success: false, error: "服务端未配置 GEMINI_API_KEY" });
      return;
    }

    if (masterImage && !isMasterDesignProfile(masterDesignProfile)) {
      res.status(400).json({
        success: false,
        error: "次视角生成缺少有效的主设计方案",
      });
      return;
    }

    const rawParsed = parseBase64Image(rawImage);

    if (
      (generationMode === "refine" || generationMode === "refine-view") &&
      !editInstructions?.trim()
    ) {
      res.status(400).json({ success: false, error: "请输入本次需要调整的内容" });
      return;
    }

    if (generationMode === "refine" && !editImage) {
      res.status(400).json({ success: false, error: "缺少需要调整的当前结果图" });
      return;
    }

    if (
      generationMode === "directional-view" &&
      viewDirection !== "left" &&
      viewDirection !== "right"
    ) {
      res.status(400).json({ success: false, error: "请选择查看左侧或查看右侧" });
      return;
    }

    if (
      generationMode === "camera-view" &&
      (!isOrbitCameraRequest(orbitCamera) ||
        !isMasterDesignProfile(masterDesignProfile) ||
        !isMasterSpatialProfile(masterSpatialProfile))
    ) {
      res.status(400).json({ success: false, error: "缺少有效的环绕机位、主设计方案或空间档案" });
      return;
    }

    // Convert the reference image to abstract text first so its layout and
    // furniture pixels can never leak into the final image generation.
    let referenceStyleProfile: ReferenceStyleProfile | undefined;
    if (referenceImage && !masterImage) {
      const refParsed = parseBase64Image(referenceImage);
      console.log(`[generate] Extracting style with ${STYLE_ANALYSIS_MODEL}`);
      referenceStyleProfile = await analyzeReferenceStyle(refParsed);
      console.log(`[generate] Reference style: ${referenceStyleProfile.overallStyle}`);
    }

    // Primary generation receives only the source room. Secondary generation
    // also receives the compressed confirmed master as a design-identity anchor.
    const input: Array<Record<string, unknown>> = [];

    const orbitViewPlan =
      generationMode === "camera-view" &&
      orbitCamera &&
      masterDesignProfile &&
      masterSpatialProfile
        ? await planOrbitView(
            rawParsed,
            masterDesignProfile,
            masterSpatialProfile,
            orbitCamera
          )
        : undefined;

    if (orbitViewPlan) {
      console.log("[orbit] Planned target view", orbitViewPlan);
    }

    const generationPrompt = buildPrompt({
      hasReference: !!referenceImage,
      referenceStyleProfile,
      masterDesignProfile,
      masterSpatialProfile,
      roomType,
      designStyle,
      renovationIntensity,
      generationMode,
      userRequirements,
      editInstructions,
      orbitCamera,
      orbitViewPlan,
      viewDirection,
    });

    input.push({
      type: "text",
      text: generationPrompt,
    });

    input.push({
      type: "image",
      mime_type: rawParsed.mimeType,
      data: rawParsed.data,
    });

    if (editImage) {
      const editParsed = parseBase64Image(editImage);
      input.push({
        type: "image",
        mime_type: editParsed.mimeType,
        data: editParsed.data,
      });
    }

    if (masterImage) {
      const masterParsed = parseBase64Image(masterImage);
      input.push({
        type: "image",
        mime_type: masterParsed.mimeType,
        data: masterParsed.data,
      });
    }

    console.log(
      `[generate] Calling Gemini ${MODEL}, mode=${generationMode}, aspectRatio=${aspectRatio}, hasRef=${!!referenceImage}, hasEdit=${!!editImage}, hasMaster=${!!masterImage}, room=${roomType}, style=${designStyle}, intensity=${renovationIntensity}${viewDirection ? `, direction=${viewDirection}` : ""}${orbitCamera ? `, orbit=${formatCameraMovementForLog(orbitCamera)}` : ""}`
    );

    let interaction = await ai.interactions.create({
      model: MODEL,
      input: input as any,
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        image_size: "2K",
      } as any,
    });

    // Extract output image using SDK convenience property
    let imageOutput = (interaction as any).output_image;

    if (generationMode !== "camera-view" && imageOutput?.data) {
      let ceilingValidation = await validateCeilingCompletion({
        mimeType: imageOutput.mime_type || "image/jpeg",
        data: imageOutput.data,
      });

      console.log("[ceiling] Candidate validation", ceilingValidation);

      if (!ceilingCompletionPassed(ceilingValidation)) {
        console.warn("[ceiling] Incomplete ceiling rejected; repairing once", {
          generationMode,
          ceilingValidation,
        });

        const failedCandidate = imageOutput;
        interaction = await ai.interactions.create({
          model: MODEL,
          input: [
            {
              type: "text",
              text: buildCeilingRepairPrompt(ceilingValidation.reason),
            },
            { type: "text", text: "IMAGE 1 — source/reference:" },
            {
              type: "image",
              mime_type: rawParsed.mimeType,
              data: rawParsed.data,
            },
            { type: "text", text: "IMAGE 2 — generated candidate to repair:" },
            {
              type: "image",
              mime_type: failedCandidate.mime_type || "image/jpeg",
              data: failedCandidate.data,
            },
          ] as any,
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            image_size: "2K",
          } as any,
        });
        imageOutput = (interaction as any).output_image;

        if (imageOutput?.data) {
          ceilingValidation = await validateCeilingCompletion({
            mimeType: imageOutput.mime_type || "image/jpeg",
            data: imageOutput.data,
          });
          console.log("[ceiling] Repair validation", ceilingValidation);
          if (!ceilingCompletionPassed(ceilingValidation)) {
            res.status(422).json({
              success: false,
              error:
                "AI 未能完整处理天花板，裸露管线、吊杆或施工痕迹仍然存在，本次结果已拦截，请重试。",
            });
            return;
          }
        }
      }
    }

    if (
      generationMode === "directional-view" &&
      viewDirection &&
      imageOutput?.data
    ) {
      let directionalValidation = await validateDirectionalView(
        rawParsed,
        {
          mimeType: imageOutput.mime_type || "image/jpeg",
          data: imageOutput.data,
        },
        viewDirection
      );

      console.log("[directional] Candidate validation", directionalValidation);

      if (!directionalViewValidationPassed(directionalValidation)) {
        console.warn("[directional] Candidate rejected; retrying once", {
          direction: viewDirection,
          directionalValidation,
        });

        interaction = await ai.interactions.create({
          model: MODEL,
          input: [
            {
              type: "text",
              text: [
                generationPrompt,
                "",
                "CRITICAL RETRY AFTER DIRECTIONAL-VIEW VALIDATION FAILURE:",
                `The previous attempt failed because: ${directionalValidation.reason}`,
                `Generate a substantially different composition dominated by the previously unseen ${viewDirection.toUpperCase()} side.`,
                "Target approximately 60% meaningful new side area and 40% recognizable completed master-scene context.",
                "IMAGE 1 is not a canvas to extend or edit. Re-render the room from the new camera position while retaining part of the completed core scene as supporting context.",
              ].join("\n"),
            },
            {
              type: "image",
              mime_type: rawParsed.mimeType,
              data: rawParsed.data,
            },
          ] as any,
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            image_size: "2K",
          } as any,
        });
        imageOutput = (interaction as any).output_image;

        if (imageOutput?.data) {
          directionalValidation = await validateDirectionalView(
            rawParsed,
            {
              mimeType: imageOutput.mime_type || "image/jpeg",
              data: imageOutput.data,
            },
            viewDirection
          );
          console.log("[directional] Retry validation", directionalValidation);
          if (!directionalViewValidationPassed(directionalValidation)) {
            res.status(422).json({
              success: false,
              error: `AI 未能生成以房间${viewDirection === "left" ? "左侧" : "右侧"}为主体的新画面，本次相似结果已拦截，请重试。`,
            });
            return;
          }
        }
      }
    }

    if (
      generationMode === "camera-view" &&
      orbitCamera &&
      masterSpatialProfile &&
      orbitViewPlan &&
      imageOutput?.data
    ) {
      let cameraValidation = await validateCameraView(
        rawParsed,
        {
          mimeType: imageOutput.mime_type || "image/jpeg",
          data: imageOutput.data,
        },
        orbitCamera,
        masterSpatialProfile,
        orbitViewPlan
      );

      console.log("[camera] Candidate validation", cameraValidation);

      if (!cameraValidationPassed(cameraValidation)) {
        console.warn("[camera] Same-view candidate rejected; retrying once", {
          movement: formatCameraMovementForLog(orbitCamera),
          cameraValidation,
        });

        const failedImage = imageOutput;
        const retryInput: Array<Record<string, unknown>> = [
          {
            type: "text",
            text: [
              generationPrompt,
              "",
              "CRITICAL RETRY AFTER CAMERA VALIDATION FAILURE:",
              `The previous candidate failed because: ${cameraValidation.reason}`,
              "IMAGE 2 below is the rejected candidate. Do not imitate its camera, vanishing points, crop, or composition.",
              "Generate again from IMAGE 1 and make the requested camera transformation unmistakable. Newly revealed architecture and parallax are mandatory.",
            ].join("\n"),
          },
          { type: "text", text: "IMAGE 1 — confirmed master and world reference:" },
          {
            type: "image",
            mime_type: rawParsed.mimeType,
            data: rawParsed.data,
          },
          { type: "text", text: "IMAGE 2 — rejected same-view candidate:" },
          {
            type: "image",
            mime_type: failedImage.mime_type || "image/jpeg",
            data: failedImage.data,
          },
        ];

        interaction = await ai.interactions.create({
          model: MODEL,
          input: retryInput as any,
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            image_size: "2K",
          } as any,
        });
        imageOutput = (interaction as any).output_image;

        if (imageOutput?.data) {
          cameraValidation = await validateCameraView(
            rawParsed,
            {
              mimeType: imageOutput.mime_type || "image/jpeg",
              data: imageOutput.data,
            },
            orbitCamera,
            masterSpatialProfile,
            orbitViewPlan
          );
          console.log("[camera] Retry validation", cameraValidation);
          if (!cameraValidationPassed(cameraValidation)) {
            res.status(422).json({
              success: false,
              error:
                "AI 未能按所选方向真正移动镜头，本次相似机位结果已拦截。请尝试 90° 或反向视角。",
            });
            return;
          }
        }
      }
    }

    if (imageOutput && imageOutput.data) {
      const mimeType = imageOutput.mime_type || "image/jpeg";
      const shouldValidateStructure =
        STRUCTURE_VALIDATION_ENABLED &&
        generationMode !== "camera-view" &&
        generationMode !== "directional-view";

      if (shouldValidateStructure) {
        console.log(`[generate] Validating structure with ${STRUCTURE_VALIDATION_MODEL}`);
        const validation = await validateStructure(rawParsed, {
          mimeType,
          data: imageOutput.data,
        });

        if (!structureValidationPassed(validation)) {
          const failedCriteria = STRUCTURE_CRITERIA.filter((key) => {
            const criterion = validation[key];
            return (
              !criterion.preserved ||
              criterion.confidence < STRUCTURE_CONFIDENCE_THRESHOLD
            );
          });
          console.warn("[generate] Structure validation rejected candidate", {
            failedCriteria,
            validation,
          });
          res.status(422).json({
            success: false,
            error: "本次结果未通过结构校验，墙体、门窗、柱体或透视发生了变化，请重新生成。",
          });
          return;
        }

        console.log("[generate] Success, structure validated, returning image");
      } else {
        console.log("[generate] Structure validation disabled, returning candidate");
      }

      await streamGeneratedImageResponse(res, mimeType, imageOutput.data);
      return;
    }

    // No image found — check for text error
    const errorMsg = (interaction as any).output_text || "AI 未能生成图片，请重试。";
    console.error("[generate] No image in output:", errorMsg);
    res.status(422).json({ success: false, error: errorMsg });
  } catch (err: any) {
    console.error("[generate] Error:", err);
    const publicError = getPublicApiError(err);
    res.status(publicError.status).json({ success: false, error: publicError.message });
  }
});

// --- Vite middleware (dev) / static (prod) / local listen ---
// In dev, serve the app through the Vite middleware. In production local runs,
// serve the built static files in dist/. On Vercel (process.env.VERCEL=true)
// this entire block's listen is skipped and the platform routes /api/* to this
// function and other paths to the static build. The async IIFE keeps the
// awaited Vite import OUT of the module's top level so esbuild can emit a CJS
// serverless bundle (top-level await is invalid in CJS and previously broke
// the Vercel build).
if (process.env.NODE_ENV !== "production") {
  (async () => {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  })().catch((err) => {
    console.error("Dev server startup failed:", err);
    process.exit(1);
  });
} else if (!process.env.VERCEL) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Listen for local non-Vercel runs only
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
