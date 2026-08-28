import { NextRequest, NextResponse } from 'next/server';
import { findCase } from '@/lib/tracex/mock-data';
import { computeMetrics } from '@/lib/tracex/centrality';
import { localCopilot } from '@/lib/tracex/copilot-fallback';
import { TraceXNode, TraceXEdge } from '@/lib/tracex/types';
import { listEvidence, mergeGraph, ensureCasesSeeded, logAudit } from '@/lib/tracex/server-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;


interface ClientGraph {
  nodes: Partial<TraceXNode>[];
  edges: Partial<TraceXEdge>[];
}

export async function POST(req: NextRequest) {
  let query = '';
  let caseId = 'case-eagle-claw';
  let clientGraph: ClientGraph | undefined;
  try {
    const body = await req.json();
    query = String(body.query || '').slice(0, 2000);
    caseId = String(body.caseId || 'case-eagle-claw');
    if (body.graph && Array.isArray(body.graph.nodes)) {
      clientGraph = {
        nodes: body.graph.nodes,
        edges: Array.isArray(body.graph.edges) ? body.graph.edges : [],
      };
    }
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  if (!query.trim()) {
    return NextResponse.json({ error: 'Empty query' }, { status: 400 });
  }

  const activeCase = findCase(caseId);
  if (!activeCase) {
    return NextResponse.json({ error: `Unknown caseId: ${caseId}` }, { status: 404 });
  }
  await ensureCasesSeeded();

  // Prefer the live client graph (seed + freshly-ingested evidence); fall
  // back to the DB-reconstructed graph on page-reload / direct curl POST.
  let liveNodes: TraceXNode[];
  let liveEdges: TraceXEdge[];
  if (clientGraph && clientGraph.nodes.length) {
    liveNodes = clientGraph.nodes as TraceXNode[];
    liveEdges = (clientGraph.edges as TraceXEdge[]) ?? [];
  } else {
    const evidence = await listEvidence(activeCase.id);
    const merged = mergeGraph(activeCase.nodes, activeCase.edges, evidence);
    liveNodes = merged.nodes;
    liveEdges = merged.edges;
  }
  const metrics = computeMetrics(liveNodes, liveEdges);
  const response = localCopilot(query, { nodes: liveNodes, edges: liveEdges, metrics });

  // Offline copilot: the response is derived purely from local graph
  // analytics (PageRank / betweenness / pattern matching over the live
  // node+edge set). No external LLM call is made. To re-enable
  // LLM-assisted narratives later, call an openai-compatible chat
  // completions endpoint here (Groq / OpenAI) using `query` + the graph.
  await logAudit(
    caseId,
    'COPILOT_QUERY',
    `${query} → offline analytics matched ${response.matchingNodeIds?.length ?? 0} nodes`,
  );
  return NextResponse.json(response);
}


  
