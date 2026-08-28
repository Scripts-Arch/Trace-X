import { NextRequest, NextResponse } from 'next/server';
import { findCase } from '@/lib/tracex/mock-data';
import { listEvidence } from '@/lib/tracex/server-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get('caseId') || 'case-eagle-claw';
  if (!findCase(caseId)) {
    return NextResponse.json({ error: `Unknown caseId: ${caseId}` }, { status: 404 });
  }
  const evidence = await listEvidence(caseId);
  return NextResponse.json({ evidence });
}
