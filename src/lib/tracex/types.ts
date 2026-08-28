// TRACE-X // Shared domain types for the Criminal Intelligence Fusion layer

export type NodeType =
  | 'PERSON'
  | 'PHONE'
  | 'BANK_ACCOUNT'
  | 'VEHICLE'
  | 'LOCATION'
  | 'FIR';

export type EdgeType =
  | 'OWNS'
  | 'USES'
  | 'CALLED'
  | 'TRANSFERRED_FUNDS'
  | 'CO_ACCUSED'
  | 'SPOTTED_AT'
  | 'NAMES_ACCUSED'
  | 'LINKED_TO';

export interface TraceXNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  alias?: string;
  flags?: string[];
  /** First observed in intelligence holdings (ISO date) */
  firstSeen: string;
  /** Provenance — FIR number, CDR batch, banking inquiry etc. */
  source: string;
  /** Analyst assessment shown in inspector */
  assessment?: string;
  meta?: Record<string, string | number>;
}

export interface TraceXEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  /** Event date (ISO) used by the temporal filter */
  date: string;
  weight?: number;
  label?: string;
  meta?: Record<string, string | number>;
}

export interface CaseFile {
  id: string;
  codename: string;
  agency: string;
  desk: string;
  status: string;
  summary: string;
  nodes: TraceXNode[];
  edges: TraceXEdge[];
}

export interface EvidenceRecord {
  id: string;
  caseId: string;
  filename: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  entityCount: number;
  linkCount: number;
  entities: ExtractedEntity[];
  custody: CustodyEvent[];
  ingestedAt: string;
  /** Node ids produced by this ingestion — used for graph highlighting */
  nodeIds: string[];
  /** Persisted extracted nodes/edges — lets /api/graph reconstruct the
   *  live (seed + ingested) graph on reload instead of losing uploads. */
  nodes?: TraceXNode[];
  edges?: TraceXEdge[];
  /** How the PDF was parsed: REAL_TEXT (pdf-parse + NER) or OCR_SIM
   *  (scanned-PDF synthetic fallback) or SYNC_DISPATCH (CSV/TXT). */
  extractionMethod?: 'REAL_TEXT' | 'OCR_SIM' | 'SYNC_DISPATCH';
}

export interface CustodyEvent {
  event: string;
  actor: string;
  at: string;
}

export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
}

export interface EntityMetrics {
  degree: number;
  pageRank: number;
  betweenness: number;
  riskScore: number;
  riskBand: RiskBand;
  rank: number;
}

export type RiskBand = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface MetricsMap {
  [nodeId: string]: EntityMetrics;
}

export interface CopilotResponse {
  interpretation: string;
  cypher: string;
  narrative: string;
  matchingNodeIds: string[];
  source: 'TRACE-X LM' | 'OFFLINE-ANALYTICS';
}

// ─── Visual identity ────────────────────────────────────────────────

export const NODE_COLORS: Record<NodeType, string> = {
  PERSON: '#F43F5E', // red
  PHONE: '#38BDF8', // blue
  BANK_ACCOUNT: '#22C55E', // green
  VEHICLE: '#A855F7', // purple
  LOCATION: '#FACC15', // yellow
  FIR: '#FB923C', // orange
};

export const NODE_SHAPES: Record<NodeType, string> = {
  PERSON: 'ellipse',
  PHONE: 'triangle',
  BANK_ACCOUNT: 'round-rectangle',
  VEHICLE: 'diamond',
  LOCATION: 'hexagon',
  FIR: 'tag',
};

export const TYPE_LABELS: Record<NodeType, string> = {
  PERSON: 'Person',
  PHONE: 'Phone Number',
  BANK_ACCOUNT: 'Bank Account',
  VEHICLE: 'Vehicle',
  LOCATION: 'Location',
  FIR: 'FIR Record',
};

export const ALL_NODE_TYPES: NodeType[] = [
  'PERSON',
  'PHONE',
  'BANK_ACCOUNT',
  'VEHICLE',
  'LOCATION',
  'FIR',
];

export function riskBandOf(score: number): RiskBand {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'ELEVATED';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

export const RISK_BAND_COLORS: Record<RiskBand, string> = {
  LOW: '#22C55E',
  MODERATE: '#EAB308',
  ELEVATED: '#F97316',
  HIGH: '#F43F5E',
  CRITICAL: '#EF4444',
};
