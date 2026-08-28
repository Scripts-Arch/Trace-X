import { NextRequest, NextResponse } from 'next/server';
import { findCase } from '@/lib/tracex/mock-data';
import { computeMetrics } from '@/lib/tracex/centrality';
import { ensureCasesSeeded, logAudit, listEvidence, mergeGraph } from '@/lib/tracex/server-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get('caseId') || 'case-eagle-claw';
  const c = findCase(caseId);
  if (!c) {
    return NextResponse.json({ error: `Unknown caseId: ${caseId}` }, { status: 404 });
  }
  await ensureCasesSeeded();
  // Reconstruct the live graph = seed + every ingested Evidence row's
  // persisted nodes/edges. Lets the graph survive a page reload: an
  // analyst's uploaded work isn't lost when they refresh the dashboard.
  const evidence = await listEvidence(c.id);
  const live = mergeGraph(c.nodes, c.edges, evidence);
  await logAudit(c.id, 'CASE_OPENED', `Graph loaded — ${live.nodes.length} nodes / ${live.edges.length} links (${c.nodes.length} seed + ${live.nodes.length - c.nodes.length} ingested)`);
  const metrics = computeMetrics(live.nodes, live.edges);
  return NextResponse.json({
    case: {
      id: c.id,
      codename: c.codename,
      agency: c.agency,
      desk: c.desk,
      status: c.status,
      summary: c.summary,
    },
    nodes: live.nodes,
    edges: live.edges,
    metrics,
    evidence,
  });
}
