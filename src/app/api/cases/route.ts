import { NextResponse } from 'next/server';
import { CASES } from '@/lib/tracex/mock-data';
import { computeMetrics } from '@/lib/tracex/centrality';
import { ensureCasesSeeded } from '@/lib/tracex/server-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureCasesSeeded();
  return NextResponse.json({
    cases: CASES.map((c) => {
      const m = computeMetrics(c.nodes, c.edges);
      const ranked = [...c.nodes].sort((a, b) => (m[b.id]?.riskScore ?? 0) - (m[a.id]?.riskScore ?? 0));
      const top = ranked[0];
      return {
        id: c.id,
        codename: c.codename,
        agency: c.agency,
        desk: c.desk,
        status: c.status,
        summary: c.summary,
        nodeCount: c.nodes.length,
        edgeCount: c.edges.length,
        topRisk: top
          ? { label: top.label, riskScore: m[top.id]?.riskScore ?? 0 }
          : null,
      };
    }),
  });
}
