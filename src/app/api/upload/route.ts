// TRACE-X // Evidence ingestion endpoint
// Multipart POST — receives an evidence file (CSV/TXT/PDF), runs it through
// the right parser (real NER for CSV/TXT, deterministic OCR-sim for PDF),
// persists an Evidence row + a custody event to SQLite, writes an audit log,
// and returns the new nodes/edges + the full evidence record so the store
// can merge the result into the live graph.
//
// Failure-tolerant: every DB write is wrapped so a SQLite hiccup never
// breaks the dashboard — the extraction still returns to the UI.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { findCase } from '@/lib/tracex/mock-data';
import { detectKind, extractEntitiesAsync } from '@/lib/tracex/extraction';
import { ensureCasesSeeded, logAudit, ACTOR } from '@/lib/tracex/server-utils';
import { db } from '@/lib/db';
import { EvidenceRecord, CustodyEvent } from '@/lib/tracex/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FILE_TYPE_LABEL: Record<string, string> = {
  FIR_PDF: 'FIR PDF',
  CDR_CSV: 'CDR CSV',
  BANK_CSV: 'BANK CSV',
  TEXT_NOTE: 'TEXT NOTE',
  OTHER: 'OTHER',
};

function custodyChain(now: Date): CustodyEvent[] {
  const iso = now.toISOString();
  return [
    { event: 'INGESTED', actor: ACTOR, at: iso },
    { event: 'ANALYSED', actor: ACTOR, at: iso },
    { event: 'CERTIFIED', actor: 'TRACE-X TRUST SERVICE', at: iso },
  ];
}

async function persistEvidence(record: Omit<EvidenceRecord, 'id'>): Promise<string> {
  // Returns the DB row id; falls back to a synthetic id on DB failure.
  const fallbackId = `evd_${record.sha256.slice(0, 12)}`;
  try {
    const row = await db.evidence.create({
      data: {
        caseId: record.caseId,
        filename: record.filename,
        fileType: record.fileType,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        sha256: record.sha256,
        entityCount: record.entityCount,
        linkCount: record.linkCount,
        entitiesJson: JSON.stringify(record.entities),
        custodyJson: JSON.stringify(record.custody),
        nodesJson: JSON.stringify(record.nodes ?? []),
        edgesJson: JSON.stringify(record.edges ?? []),
        extractionMethod: record.extractionMethod ?? '',
      },
    });
    return row.id;
  } catch (err) {
    console.warn('[tracex] evidence persist skipped:', (err as Error).message);
    return fallbackId;
  }
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  // caseId may be provided as a form field OR a URL query parameter; the
  // form field wins when both are present. Fall back to the canonical demo
  // case ONLY when neither is provided — previously a curl POST without a
  // caseId form field would silently route to case-eagle-claw even when the
  // URL was ?caseId=case-blank.
  const caseId =
    String(form.get('caseId') || '') ||
    req.nextUrl.searchParams.get('caseId') ||
    'case-eagle-claw';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 });
  }

  const activeCase = findCase(caseId);
  if (!activeCase) {
    return NextResponse.json({ error: `Unknown caseId: ${caseId}` }, { status: 404 });
  }
  await ensureCasesSeeded();

  // Read file bytes + compute the integrity hash
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const kind = detectKind(file.name, file.type);

  // CSV / TXT ingest: the bytes ARE the text — feed them directly to the NER.
  // PDF ingest: extractEntitiesAsync runs real pdf-parse first, then falls
  // back to the OCR simulation only if the PDF has no extractable text.
  let text = '';
  if (kind === 'CDR_CSV' || kind === 'BANK_CSV' || kind === 'TEXT_NOTE') {
    text = buf.toString('utf8');
  }

  // The linker needs the case's existing nodes/edges so freshly extracted
  // entities resolve onto existing graph nodes instead of duplicating.
  const result = await extractEntitiesAsync(kind, buf, text, file.name, sha256, activeCase.nodes, activeCase.edges);
  const now = new Date();
  const custody = custodyChain(now);

  const evidenceBase: Omit<EvidenceRecord, 'id'> = {
    caseId: activeCase.id,
    filename: file.name,
    fileType: FILE_TYPE_LABEL[kind] ?? kind,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: buf.length,
    sha256,
    entityCount: result.entities.length,
    linkCount: result.edges.length,
    entities: result.entities,
    custody,
    ingestedAt: now.toISOString(),
    nodeIds: result.nodes.map((n) => n.id),
    nodes: result.nodes,
    edges: result.edges,
    extractionMethod: result.extractionMethod,
  };

  const id = await persistEvidence(evidenceBase);
  const evidence: EvidenceRecord = { id, ...evidenceBase };

  const methodTag =
    kind === 'FIR_PDF'
      ? result.extractionMethod === 'REAL_TEXT'
        ? 'pdf-parse REAL TEXT NER + relationship inference'
        : 'OCR-SIM fallback (scanned PDF — synthetic graph)'
      : FILE_TYPE_LABEL[kind];
  await logAudit(
    activeCase.id,
    'EVIDENCE_INGESTED',
    `${file.name} (${methodTag}) — ${result.nodes.length} entities / ${result.edges.length} links · sha ${sha256.slice(0, 12)}…`
  );

  return NextResponse.json({
    nodes: result.nodes,
    edges: result.edges,
    evidence,
    extractionMethod: result.extractionMethod,
  });
}
