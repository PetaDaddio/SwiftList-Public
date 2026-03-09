/**
 * ThreadLogic Fabric Engine Types
 * 8-Agent DAG Architecture for Fashion/Textile Processing
 *
 * Competitive positioning:
 * - Photoroom "Product Beautifier" → Lighting normalization while preserving true color
 * - Claid.ai "Product Preservation" → Zero tolerance for logo/print hallucination
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

/**
 * Supported fabric categories for V1.0
 * Priority order based on market research
 */
export type FabricCategory =
  | 'opaque_woven'      // Denim, cotton twill, canvas
  | 'knit'              // Sweaters, jersey, ribbed
  | 'leather'           // Leather, faux leather, suede
  | 'metallic'          // Sequins, metallic thread, lamé
  | 'unknown';          // Fallback for undetected fabrics

/**
 * Product photography type
 * Determines processing pipeline complexity
 */
export type PhotographyType =
  | 'flatlay'           // Product on flat surface (V1.0 primary)
  | 'mannequin'         // Ghost mannequin/invisible mannequin
  | 'on_model'          // Human model wearing garment
  | 'hanging';          // Product on hanger

/**
 * Print/pattern categories for preservation
 */
export type PrintType =
  | 'screen_print'      // Screen-printed graphics, logos
  | 'embroidery'        // Embroidered designs, patches
  | 'woven_pattern'     // Plaid, houndstooth, stripes
  | 'sublimation'       // All-over prints
  | 'none';             // Solid color fabric

/**
 * Detected fabric properties from Gemini Vision analysis
 */
export interface FabricAnalysis {
  /** Primary fabric category */
  category: FabricCategory;

  /** Specific fabric type (e.g., "denim", "cashmere", "silk") */
  specificType: string;

  /** Drape factor: 0 = stiff (denim), 1 = fluid (silk) */
  drapeFactor: number;

  /** Texture complexity: 0 = smooth, 1 = highly textured */
  textureComplexity: number;

  /** Reflectivity: 0 = matte, 1 = highly reflective (metallic) */
  reflectivity: number;

  /** Detected print/pattern type */
  printType: PrintType;

  /** Print coverage percentage (0-100) */
  printCoverage: number;

  /** Confidence score for fabric detection (0-1) */
  confidence: number;
}

/**
 * Regions of interest detected by Print Guardian
 */
export interface PrintRegion {
  /** Bounding box coordinates (normalized 0-1) */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Print type in this region */
  type: PrintType;

  /** Preservation priority (1-5, 5 = highest) */
  priority: number;

  /** Whether this region contains text/logo */
  containsText: boolean;

  /** Pixel mask for this region (boolean array) */
  mask?: boolean[];
}

/**
 * Texture analysis results from Texture Sentry
 */
export interface TextureMetrics {
  /** Local Binary Pattern variance (higher = more texture) */
  lbpVariance: number;

  /** Gabor filter response (fabric weave detection) */
  gaborResponse: number;

  /** Micro-fold count in the image */
  foldCount: number;

  /** Average fold depth (0-1) */
  foldDepth: number;

  /** Regions at risk of over-smoothing */
  riskRegions: Array<{
    x: number;
    y: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Edge softening parameters for textile edges
 */
export interface EdgeSofteningParams {
  /** Feather radius in pixels */
  featherRadius: number;

  /** Anti-aliasing strength (0-1) */
  antiAliasStrength: number;

  /** Whether to apply fabric-specific edge treatment */
  fabricAwareEdges: boolean;

  /** Edge preservation zones (for seams, hems) */
  preservationZones: Array<{
    x: number;
    y: number;
    radius: number;
  }>;
}

/**
 * Lighting normalization parameters
 * Mimics Photoroom "Product Beautifier" logic
 */
export interface LightingParams {
  /** Target white balance (Kelvin) */
  targetWhiteBalance: number;

  /** Shadow lift amount (0-1) */
  shadowLift: number;

  /** Highlight recovery amount (0-1) */
  highlightRecovery: number;

  /** Color protection mask (regions to preserve true color) */
  colorProtectionMask?: boolean[];

  /** Original color reference points */
  colorAnchors: Array<{
    x: number;
    y: number;
    originalColor: { r: number; g: number; b: number };
  }>;
}

/**
 * Quality metrics specific to fabric processing
 * Extends base quality metrics with fabric-specific scores
 */
export interface FabricQualityMetrics {
  /** Base quality score (0-1) */
  overallQuality: number;

  /** Edge quality for textile edges (0-1) */
  edgeQuality: number;

  /** Texture preservation score (0-1) */
  texturePreservation: number;

  /** Print/logo fidelity score (0-1) */
  printFidelity: number;

  /** Color accuracy vs. original (0-1) */
  colorAccuracy: number;

  /** Fold/drape preservation score (0-1) */
  drapePreservation: number;

  /** Detailed diagnostics */
  diagnostics: {
    /** Detected over-smoothing regions */
    smoothingArtifacts: number;

    /** Print distortion score (lower = better) */
    printDistortion: number;

    /** Color shift from original (deltaE) */
    colorShiftDeltaE: number;

    /** Lost texture detail percentage */
    lostTexturePercent: number;
  };
}

/**
 * ThreadLogic Agent State
 * Passed through the 8-agent DAG pipeline
 */
export interface FabricAgentState {
  /** Original input image buffer */
  originalImage: Buffer;

  /** Currently processed image buffer */
  processedImage: Buffer;

  /** Background-removed image from CleanEdge (input to ThreadLogic) */
  cleanEdgeOutput: Buffer;

  /** Photography type for this job */
  photographyType: PhotographyType;

  /** Fabric analysis results (populated by Fabric Classifier agent) */
  fabricAnalysis?: FabricAnalysis;

  /** Texture metrics (populated by Texture Sentry agent) */
  textureMetrics?: TextureMetrics;

  /** Detected print regions (populated by Print Guardian agent) */
  printRegions?: PrintRegion[];

  /** Edge softening parameters (populated by Edge Softener agent) */
  edgeSofteningParams?: EdgeSofteningParams;

  /** Lighting parameters (populated by Lighting Normalizer agent) */
  lightingParams?: LightingParams;

  /** Overall quality score (0-1) */
  qualityScore: number;

  /** Detailed quality metrics */
  qualityMetrics?: FabricQualityMetrics;

  /** Processing metadata */
  metadata: {
    /** Detected complexity (0-1, higher = more complex) */
    complexity: number;

    /** Number of retry attempts */
    retryCount: number;

    /** Model used for processing */
    modelUsed?: string;

    /** Agent-specific timing */
    timestamps: {
      start: number;
      fabricClassifier?: number;
      textureSentry?: number;
      printGuardian?: number;
      edgeSoftener?: number;
      lightingNormalizer?: number;
      colorRestorer?: number;
      upscaler?: number;         // NEW: v2.0
      fabricPolish?: number;     // NEW: v2.0
      qualityValidator?: number;
      critiqueAgent?: number;
    };

    /** Cost tracking */
    costs: {
      geminiCalls: number;
      totalApiCost: number;
    };
  };
}

/**
 * Fabric Engine workflow node function signature
 * Pure function: takes state, returns new state
 */
export type FabricWorkflowNode = (state: FabricAgentState) => Promise<FabricAgentState>;

/**
 * FabricJob - Input to ThreadLogic from job queue
 */
export interface FabricJob {
  /** Unique job identifier */
  jobId: string;

  /** User who submitted the job */
  userId: string;

  /** Input image URL or buffer */
  inputImage: string | Buffer;

  /** CleanEdge output (background-removed image) */
  cleanEdgeOutput: Buffer;

  /** Photography type hint (optional, will be auto-detected if not provided) */
  photographyType?: PhotographyType;

  /** Fabric type hint (optional, will be auto-detected if not provided) */
  fabricHint?: FabricCategory;

  /** Quality threshold for auto-approval (default: 0.85) */
  qualityThreshold?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Job creation timestamp */
  createdAt: number;
}

/**
 * ThreadLogic pipeline result
 */
export interface FabricPipelineResult {
  /** Final processed image buffer */
  buffer: Buffer;

  /** Overall quality score (0-1) */
  qualityScore: number;

  /** Detailed quality metrics */
  metrics: FabricQualityMetrics;

  /** Fabric analysis results */
  fabricAnalysis: FabricAnalysis;

  /** Processing metadata */
  metadata: FabricAgentState['metadata'];

  /** Total processing time (ms) */
  processingTime: number;

  /** Whether the result passed quality threshold */
  approved: boolean;

  /** Critique agent feedback (if quality < threshold) */
  critiqueFeedback?: string;
}

/**
 * Critique Agent verification result
 * Chain-of-Verification step comparing against CleanEdge standards
 */
export interface CritiqueResult {
  /** Overall pass/fail */
  passed: boolean;

  /** Score breakdown */
  scores: {
    /** Does output maintain CleanEdge edge quality? */
    edgeConsistency: number;

    /** Is texture preserved vs. original? */
    texturePreservation: number;

    /** Are prints/logos undistorted? */
    printIntegrity: number;

    /** Is color accurate to original? */
    colorFidelity: number;

    /** Are fabric folds/drapes realistic? */
    drapeRealism: number;
  };

  /** Specific issues found */
  issues: Array<{
    type: 'smoothing' | 'color_shift' | 'print_distortion' | 'edge_artifact' | 'drape_loss';
    severity: 'minor' | 'moderate' | 'critical';
    location?: { x: number; y: number };
    description: string;
  }>;

  /** Recommendations for retry */
  recommendations: string[];
}
