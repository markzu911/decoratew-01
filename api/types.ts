// --- Types ---

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export type RoomType =
  | "auto"
  | "living-room"
  | "bedroom"
  | "dining-room"
  | "kitchen"
  | "bathroom"
  | "study"
  | "other";

export type DesignStyle =
  | "smart"
  | "modern-minimal"
  | "natural-wood"
  | "cream"
  | "italian-minimal"
  | "light-luxury"
  | "wabi-sabi";

export type RenovationIntensity = "conservative" | "standard" | "bold";

export type GenerationMode =
  | "initial"
  | "refine"
  | "redesign"
  | "directional-view"
  | "camera-view"
  | "refine-view";

export type ViewDirection = "left" | "right";

export type OrbitAngle =
  | "left-45"
  | "left-90"
  | "right-45"
  | "right-90"
  | "back";

export type CameraDistance = "closer" | "same" | "farther";
export type CameraHeight = "lower" | "same" | "higher";
export type CameraFieldOfView = "standard" | "wide";

export interface OrbitCameraRequest {
  orbitAngle: OrbitAngle;
  distance: CameraDistance;
  height: CameraHeight;
  fieldOfView: CameraFieldOfView;
}

export interface UploadedImageMeta {
  width: number;
  height: number;
}

export interface MasterFurnitureItem {
  identity: string;
  appearance: string;
  placement: string;
}

export interface MasterDesignProfile {
  designIdentity: string;
  surfaces: {
    walls: string;
    floor: string;
    ceiling: string;
  };
  furniture: MasterFurnitureItem[];
  lighting: string;
  textilesAndDecor: string;
  consistencyRules: string[];
}

export interface SpatialAnchor {
  identity: string;
  description: string;
  relationToOrbitTarget: string;
}

export interface MasterSpatialProfile {
  orbitTarget: {
    identity: string;
    description: string;
  };
  camera: {
    estimatedHeight: string;
    estimatedDistance: string;
    viewingDirection: string;
    fieldOfView: string;
  };
  roomEnvelope: {
    walls: SpatialAnchor[];
    openings: SpatialAnchor[];
    ceilingFeatures: SpatialAnchor[];
    floorPattern: string;
  };
  furnitureAnchors: Array<{
    identity: string;
    relationToOrbitTarget: string;
    relationToArchitecture: string;
  }>;
  hiddenAreaRules: string[];
}

export interface OrbitViewPlan {
  targetViewSummary: string;
  remainsVisible: string[];
  leavesFrame: string[];
  newlyRevealed: string[];
  parallaxRules: string[];
  furnitureOrientations: string[];
  architectureContinuity: string[];
}

export interface GenerateRequest {
  /** Base64 data URL of the raw/unfinished room */
  rawImage: string;
  /** Base64 data URL of the reference decorated room (optional) */
  referenceImage?: string;
  /** Current generated result used for feedback-driven refinement */
  editImage?: string;
  /** Confirmed primary-view result used to keep secondary views consistent */
  masterImage?: string;
  /** Structured design specification extracted once from the primary result */
  masterDesignProfile?: MasterDesignProfile;
  /** Spatial anchors and virtual orbit target inferred from the master view */
  masterSpatialProfile?: MasterSpatialProfile;
  /** Controls whether the request creates, edits, or moves the camera */
  generationMode?: GenerationMode;
  /** Persistent design requirements for a new design */
  userRequirements?: string;
  /** Feedback that should change only the current result */
  editInstructions?: string;
  /** Orbit-camera movement relative to the confirmed primary result */
  orbitCamera?: OrbitCameraRequest;
  /** Unanchored side of the room to make dominant in a new view */
  viewDirection?: ViewDirection;
  /** Detected aspect ratio of the raw room image */
  aspectRatio: AspectRatio;
  /** Intended room function, or auto detection */
  roomType: RoomType;
  /** Preferred design direction, or smart recommendation */
  designStyle: DesignStyle;
  /** How expressive the surface, furniture, and decor treatment should be */
  renovationIntensity: RenovationIntensity;
}

export interface GenerateResponse {
  success: boolean;
  /** Base64 data URL of the generated decorated room */
  image?: string;
  /** Error message if success is false */
  error?: string;
}

export interface AnalyzeMasterRequest {
  masterImage: string;
  roomType: RoomType;
}

export interface AnalyzeMasterResponse {
  success: boolean;
  profile?: MasterDesignProfile;
  spatialProfile?: MasterSpatialProfile;
  error?: string;
}

export type ViewGenerationStatus = "waiting" | "generating" | "complete" | "error";

export interface RoomViewInput {
  id: string;
  label: string;
  image: string;
  metadata: UploadedImageMeta;
  aspectRatio: AspectRatio;
}

export interface GeneratedRoomView extends RoomViewInput {
  resultImage?: string;
  status: ViewGenerationStatus;
  error?: string;
  orbitCamera?: OrbitCameraRequest;
  viewDirection?: ViewDirection;
  viewRequirements?: string;
}

export interface HealthResponse {
  status: string;
  geminiConfigured: boolean;
  structureValidationEnabled: boolean;
}
