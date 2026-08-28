// TRACE-X // Case reset endpoint
// POST /api/reset?caseId=... — clears every ingested Evidence row for the
// case, logs a CASE_RESET audit entry, and returns the canonical seed
// graph (empty for case-blank, full for the demo cases). The store uses
// this to wipe the live graph back to a clean starting point so the
// analyst can re-ingest from scratch — or start a brand-new analysis.

import { NextRequest, NextResponse } from 'next/server';
import { findCase } from '@/lib/tracex/mock-data';
import { computeMetrics } from '@/lib/tracex/centrality';
import { ensureCasesSeeded, logAudit } from '@/lib/tracex/server-utils';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get('caseId') || 'case-eagle-claw';
  const c = findCase(caseId);
  if (!c) {
    return NextResponse.json({ error: `Unknown caseId: ${caseId}` }, { status: 404 });
  }
  await ensureCasesSeeded();

  // Wipe every ingested exhibit + its custody chain for this case.
  // (AuditLog rows are append-only — they remain as the case's
  // historical record, including the fact that a reset happened.)
  try {
    const deleted = await db.evidence.deleteMany({ where: { caseId } });
    await logAudit(
      caseId,
      'CASE_RESET',
      `Wiped ${deleted.count} ingested exhibit(s) — graph restored to canonical seed (${c.nodes.length}N / ${c.edges.length}E)`
    );
  } catch (err) {
    console.warn('[tracex] evidence reset skipped:', (err as Error).message);
    await logAudit(caseId, 'CASE_RESET', `Graph reset requested (DB wipe skipped — ${c.nodes.length}N / ${c.edges.length}E restored from seed)`);
  }

  const metrics = computeMetrics(c.nodes, c.edges);
  return NextResponse.json({
    case: {
      id: c.id,
      codename: c.codename,
      agency: c.agency,
      desk: c.desk,
      status: c.status,
      summary: c.summary,
    },
    nodes: c.nodes,
    edges: c.edges,
    metrics,
  });
}
