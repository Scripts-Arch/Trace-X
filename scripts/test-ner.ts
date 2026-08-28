// Quick NER diagnostic — runs the REAL PDF text extraction + runNER against
// the user's uploaded FIR PDF so we can see exactly what entities come out.
// Usage: bun run scripts/test-ner.ts

import { readFileSync } from 'fs';
import { extractPdfText, runNER, extractFromText } from '../src/lib/tracex/extraction';
import type { TraceXNode, TraceXEdge } from '../src/lib/tracex/types';

const PDF = '/home/z/my-project/upload/TRACE-X_Test_FIR_Text_PDF_02.pdf';
const buf = readFileSync(PDF);

console.log('=== PDF TEXT EXTRACTION ===');
const text = extractPdfText(buf);
if (!text) {
  console.log('!! extractPdfText returned null (would fall back to OCR sim)');
  process.exit(0);
}
console.log('text length:', text.length);
console.log('--- first 800 chars ---');
console.log(text.slice(0, 800));
console.log('...\n--- last 400 chars ---');
console.log(text.slice(-400));

console.log('\n=== runNER OUTPUT ===');
const ents = runNER(text);
const byType: Record<string, string[]> = {};
for (const e of ents) {
  (byType[e.type] ??= []).push(e.text);
}
for (const [t, vs] of Object.entries(byType)) {
  console.log(`${t} (${vs.length}):`);
  for (const v of vs) console.log(`  - ${v}`);
}

console.log('\n=== extractFromText (graph nodes) ===');
const emptyNodes: TraceXNode[] = [];
const emptyEdges: TraceXEdge[] = [];
const res = extractFromText(text, 'TRACE-X_Test_FIR_Text_PDF_02.pdf', emptyNodes);
console.log(`nodes: ${res.nodes.length}, edges: ${res.edges.length}, entities: ${res.entities.length}`);
for (const n of res.nodes) {
  console.log(`  [${n.type}] ${n.label}`);
}
