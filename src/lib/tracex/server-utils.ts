// TRACE-X // Server-side persistence helpers.
// Every DB operation is failure-tolerant: if SQLite is unavailable the
// API degrades to in-memory behaviour instead of erroring the dashboard.

import { db } from '@/lib/db';
import { CASES } from './mock-data';
import { EvidenceRecord, CustodyEvent, ExtractedEntity, TraceXNode, TraceXEdge } from './types';

export const ACTOR = 'ANALYST-7';

export async function ensureCasesSeeded(): Promise<void> {
  try {
    for (const c of CASES) {
      await db.caseFile.upsert({
        where: { id: c.id },
        update: { codename: c.codename, agency: c.agency, desk: c.desk, status: c.status },
        create: { id: c.id, codename: c.codename, agency: c.agency, desk: c.desk, status: c.status },
      });
    }
  } catch (err) {
    console.warn('[tracex] case seeding skipped:', (err as Error).message);
  }
}

export async function logAudit(caseId: string, action: string, detail: string): Promise<void> {
  try {
    await db.auditLog.create({ data: { caseId, action, detail, actor: ACTOR } });
  } catch (err) {
    console.warn('[tracex] audit write skipped:', (err as Error).message);
  }
}

interface DbEvidence {
  id: string;
  caseId: string;
  filename: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  entityCount: number;
  linkCount: number;
  entitiesJson: string;
  custodyJson: string;
  nodesJson: string;
  edgesJson: string;
  extractionMethod: string;
  ingestedAt: Date;
}

export function mapEvidence(row: DbEvidence): EvidenceRecord {
  let entities: ExtractedEntity[] = [];
  let custody: CustodyEvent[] = [];
  let nodes: TraceXNode[] = [];
  let edges: TraceXEdge[] = [];
  try {
    entities = JSON.parse(row.entitiesJson || '[]');
    custody = JSON.parse(row.custodyJson || '[]');
  } catch {
    /* corrupt payload — degrade to empty */
  }
  try {
    nodes = JSON.parse(row.nodesJson || '[]');
    edges = JSON.parse(row.edgesJson || '[]');
  } catch {
    /* corrupt topology — degrade to empty */
  }
  return {
    id: row.id,
    caseId: row.caseId,
    filename: row.filename,
    fileType: row.fileType,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    entityCount: row.entityCount,
    linkCount: row.linkCount,
    entities,
    custody,
    ingestedAt: row.ingestedAt.toISOString(),
    nodeIds: nodes.map((n) => n.id),
    nodes,
    edges,
    extractionMethod: (row.extractionMethod || undefined) as EvidenceRecord['extractionMethod'],
  };
}

export async function listEvidence(caseId: string): Promise<EvidenceRecord[]> {
  try {
    const rows = await db.evidence.findMany({ where: { caseId }, orderBy: { ingestedAt: 'desc' } });
    return rows.map((r) => mapEvidence(r as unknown as DbEvidence));
  } catch (err) {
    console.warn('[tracex] evidence listing skipped:', (err as Error).message);
    return [];
  }
}

/** Merge a case's seed graph with every ingested Evidence row's persisted
 *  nodes/edges — the live graph an analyst built by uploading. Lets the
 *  graph survive a page reload: /api/graph reconstructs from the DB instead
 *  of returning only the static seed. Dedupes by node id / edge id. */
export function mergeGraph(
  seedNodes: TraceXNode[],
  seedEdges: TraceXEdge[],
  evidence: EvidenceRecord[],
): { nodes: TraceXNode[]; edges: TraceXEdge[] } {
  const nodeMap = new Map<string, TraceXNode>();
  for (const n of seedNodes) nodeMap.set(n.id, n);
  for (const ev of evidence) {
    for (const n of ev.nodes ?? []) if (!nodeMap.has(n.id)) nodeMap.set(n.id, n);
  }
  const edgeMap = new Map<string, TraceXEdge>();
  for (const e of seedEdges) edgeMap.set(e.id, e);
  for (const ev of evidence) {
    for (const e of ev.edges ?? []) if (!edgeMap.has(e.id)) edgeMap.set(e.id, e);
  }
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}

export async function listAudit(caseId: string): Promise<{ action: string; detail: string; actor: string; createdAt: Date }[]> {
  try {
    return await db.auditLog.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
  } catch {
    return [];
  }
}
