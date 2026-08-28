// TRACE-X // Evidence ingestion & entity extraction pipeline
// - CSV / plain-text ingests run REAL regex NER (SpaCy-style patterns)
// - PDF ingests first try REAL text extraction via a pure-JS extractor
//   (zlib + standard PDF text operators). If text is recovered, the
//   same NER pipeline as TEXT_NOTE runs against the extracted body —
//   the analyst's actual FIR content populates the graph. Only when
//   the PDF is scanned / image-only (no text streams recoverable) does
//   the deterministic OCR simulation kick in as a fallback.
// - The Linker resolves extracted entities onto EXISTING graph nodes by
//   value (phone digits, bank prefix+last4, labels) so ingests enrich
//   the live graph instead of duplicating it.

import { TraceXEdge, TraceXNode, ExtractedEntity, EdgeType, NodeType } from './types';
import { inflateSync } from 'zlib';

export interface ExtractionResult {
  nodes: TraceXNode[];
  edges: TraceXEdge[];
  entities: ExtractedEntity[];
}

export type EvidenceKind = 'FIR_PDF' | 'CDR_CSV' | 'BANK_CSV' | 'TEXT_NOTE' | 'OTHER';

export function detectKind(filename: string, mime: string): EvidenceKind {
  const f = filename.toLowerCase();
  if (f.endsWith('.csv')) {
    return f.includes('bank') || f.includes('statement') ? 'BANK_CSV' : 'CDR_CSV';
  }
  if (f.endsWith('.pdf')) return 'FIR_PDF';
  if (f.endsWith('.txt') || f.endsWith('.md') || mime.startsWith('text/')) return 'TEXT_NOTE';
  return 'OTHER';
}

// ─── helpers ────────────────────────────────────────────────────────

const digits = (s: string) => s.replace(/\D/g, '');

function normalizePhone(raw: string): string | null {
  let d = digits(raw);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length !== 10 || !/^[6-9]/.test(d)) return null;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

function phoneId(normalized: string): string {
  return `phone_${digits(normalized).slice(-10)}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isoDate(s: string): string {
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function shortHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** deterministic PRNG for the PDF-OCR simulation */
function seededRandom(seed: string): () => number {
  let s = parseInt(shortHash(seed).slice(0, 8), 16) || 42;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── entity linker ─────────────────────────────────────────────────

class Linker {
  private phones = new Map<string, string>(); // last-10 digits -> node id
  private banks = new Map<string, string>(); // PREFIX+last4 -> node id
  private bankSuffix = new Map<string, string>(); // last4 -> node id
  private labels = new Map<string, string>(); // upper label -> node id

  constructor(nodes: TraceXNode[]) {
    for (const n of nodes) {
      const key = n.label.toUpperCase().replace(/\s+/g, ' ').trim();
      if (!this.labels.has(key)) this.labels.set(key, n.id);
      if (n.alias) {
        for (const a of n.alias.split(/[·,/]+/)) {
          const ak = a.toUpperCase().replace(/["\s]+/g, ' ').trim();
          if (ak.length > 2 && !this.labels.has(ak)) this.labels.set(ak, n.id);
        }
      }
      if (n.type === 'PHONE') {
        const d = digits(n.label);
        if (d.length >= 10) this.phones.set(d.slice(-10), n.id);
      }
      if (n.type === 'BANK_ACCOUNT') {
        const m = n.label.toUpperCase().match(/^([A-Z]{3,5})\s*X••(\d{3,5})$/);
        if (m) {
          this.banks.set(m[1] + m[2], n.id);
          if (!this.bankSuffix.has(m[2])) this.bankSuffix.set(m[2], n.id);
        }
      }
    }
  }

  phone(normalized: string): string | null {
    return this.phones.get(digits(normalized).slice(-10)) ?? null;
  }

  bank(account: string): string | null {
    const clean = account.replace(/[\sX•-]+/g, '').toUpperCase();
    const m = clean.match(/^([A-Z]{3,5})0*(\d{3,5})$/);
    if (m && this.banks.has(m[1] + m[2])) return this.banks.get(m[1] + m[2])!;
    const last4 = clean.slice(-4);
    if (/^\d{4}$/.test(last4) && this.bankSuffix.has(last4)) return this.bankSuffix.get(last4)!;
    return null;
  }

  byLabel(label: string): string | null {
    return this.labels.get(label.toUpperCase().replace(/\s+/g, ' ').trim()) ?? null;
  }
}

// ─── NER (regex, SpaCy-style) ──────────────────────────────────────

const PHONE_RE = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;
const VEHICLE_RE = /\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4})\b/g;
const IFSC_RE = /\b([A-Z]{4}0[A-Z0-9]{6})\b/g;
// Lenient fallback: real Indian IFSCs are always 11 chars (`AAAA0XXXXXX`)
// but a typo (one extra digit) or a non-IFSC alphanumeric bank code shouldn't
// be silently dropped — the analyst expects to see what they typed. This
// fallback catches 12-13 char sequences starting with 4 letters + literal 0
// + 7-8 alphanumeric, marks them as a BANK_ACCOUNT but with a lower
// confidence + an "MALFORMED_IFSC" warning flag so the inspector surfaces it.
const IFSC_LENIENT_RE = /\b([A-Z]{4}0[A-Z0-9]{7,8})\b/g;
// Narrative bank-account forms common in real FIRs:
//   "A/c No. 1234567890123" / "Account No. 8822900441" / "a/c 12345678"
//   "account number 8822900441" / "his account no 1234567890"
// Captures the 8-18 digit number; later labelled with the bank name when
// one precedes it ("Axis account 2210" → "AXIS …2210").
const ACCT_RE = /\b(?:A\/c(?:\s*(?:No\.?|Number))?|Account(?:\s*(?:No\.?|Number))?|a\/c(?:\s*(?:no\.?|number))?)\s*[:#]?\s*(\d{8,18})\b/gi;
// "AXIS account 2210" / "HDFC a/c 4417" — bank short-name + 4-8 digit suffix
const BANK_LABEL_ACCT_RE = /\b([A-Z]{3,5})\s+(?:Bank\s+)?(?:account|a\/c)\s*(?:No\.?|Number)?\s*[:#]?\s*(\d{4,8})\b/gi;

// PERSON NER — multi-pattern, handles real-world Indian-FIR layouts.
// PDFs / typed FIRs name people in several common shapes; a single regex
// missed most of them. Each pattern below feeds raw captures into
// cleanName(), which strips honorifics, truncates at field/org boundaries,
// and rejects 1-word / all-caps / stopword-containing spans.
//
//   1. labelled field       "Name: Meera Iyer", "Investigating Officer: …"
//   2. numbered list        "1. Sameer Qureshi, Proprietor,"
//   3. role post-modifier   "Rohan Bedi, Warehouse Coordinator,"
//   4. title + name         "Inspector Devendra Rathore,"
//   5. trigger + name       "namely Rohit Sethi", "accused Kabir Nanda"
//   6. inline verb          "Sameer Qureshi OWNS / USES / CONTROLS / LINKED TO"
//   7. passive "by X"       "used by Sameer Qureshi", "reported by X"
//   8. explicit entity list "PERSON: Meera Iyer, Sameer Qureshi, …"
//
// NOTE: patterns stay case-sensitive — [A-Z][a-z]+ name matching with /i
// would glue lowercase filler ("in"/"at") onto captures and produce junk.

// Inter-word whitespace inside a name capture is [ \t]+ (space/tab only,
// NOT newline). This stops a greedy capture from crossing a line break and
// eating the next field label — "Name: Meera Iyer\nFather's" must capture
// "Meera Iyer", not "Meera Iyer Father". The \s* / \s+ around the trigger,
// colon, comma and verb still allow newlines, because PDF text extraction
// often puts each Tj operator on its own line ("Name:\n Meera Iyer").
const NAME_TAIL = '(?:[ \\t]+[A-Z][a-z]+){0,3}';
const NAME_TAIL_STRICT = '(?:[ \\t]+[A-Z][a-z]+){1,2}';
const PERSON_RE_LABEL = new RegExp(`(?:\\bName|\\bFather's(?:\\s*\\/\\s*Husband's)?\\s*Name|\\bHusband's\\s*Name|\\bComplainant|\\bInformant|\\bInvestigating\\s+Officer|\\bInspector|\\bAccused|\\bSuspect)\\s*:\\s*([A-Z][a-z]+${NAME_TAIL})`, 'g');
const PERSON_RE_NUM = new RegExp(`(?:^|\\n)[ \\t]*\\d{1,2}[\\.\\)]\\s*([A-Z][a-z]+${NAME_TAIL})\\s*[,.\\n]`, 'g');
const PERSON_ROLE_WORDS = 'Proprietor|Director|Owner|Manager|Coordinator|Executive|Officer|Partner|Accountant|Broker|Dealer|Agent|Contractor|Supplier|Vendor|Clerk|Driver|Operator|Analyst|Consultant|Representative|Chairman|Principal|Treasurer|Secretary';
const PERSON_RE_ROLE_POST = new RegExp(`([A-Z][a-z]+${NAME_TAIL})\\s*,\\s*(?:[A-Z][a-z]+\\s+)?(?:${PERSON_ROLE_WORDS})\\b`, 'g');
const PERSON_RE_TITLE = new RegExp(`(?:Inspector|Sub-Inspector|Sub\\s+Inspector|SI|ASI|PI|Doctor|Prof\\.?|Mr\\.?|Mrs\\.?|Ms\\.?)\\s+([A-Z][a-z]+${NAME_TAIL_STRICT})\\s*,`, 'g');
const PERSON_RE_TRIGGER = new RegExp(`(?:[Aa]ccused|[Ss]uspect|[Nn]amely|[Dd]irector|[Pp]roprietor|[Oo]wner|[Mm]anager)\\s+([A-Z][a-z]+${NAME_TAIL})`, 'g');
const PERSON_RE_VERB = new RegExp(`\\b([A-Z][a-z]+${NAME_TAIL})\\s+(?:USES|OWNS|CONTROLS|LINKED\\s+TO)\\b`, 'g');
const PERSON_RE_BY = new RegExp(`(?:used|reported|controlled|coordinated|identified|named)\\s+by\\s+([A-Z][a-z]+${NAME_TAIL})\\b`, 'g');
const PERSON_RE_LIST = new RegExp(`\\bPERSON\\b\\s*:\\s*([A-Z][a-z]+${NAME_TAIL}(?:\\s*,\\s*[A-Z][a-z]+${NAME_TAIL})+)`, 'g');

// honorific / title prefix stripped from captured names ("Shri Suresh Iyer" → "Suresh Iyer")
const NAME_TITLE_PREFIX = /^(?:Shri|Smt\.?|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Md\.?|Prof\.?|Inspector|Sub-Inspector|SI|ASI|PI)\s+/i;

/** words that, when they appear inside a captured name span, mark the
 *  boundary of the actual name — everything from that word onward is a
 *  field label or an org / place token that must not be glued onto the
 *  person name ("Meera Iyer Father's" → "Meera Iyer";
 *  "Devendra Rathore Economic" → "Devendra Rathore"). */
const NAME_BOUNDARY_WORDS = new Set([
  // FIR field labels
  'name', 'father', 'fathers', 'fatherinlaw', 'husband', 'husbands', 'mother', 'wife', 'spouse',
  'profession', 'occupation', 'address', 'complainant', 'informant', 'accused', 'suspect',
  'inspector', 'officer', 'io', 'date', 'place', 'district', 'station', 'acts', 'sections',
  'section', 'information', 'entry', 'time', 'nature', 'timeline', 'location', 'communication',
  'financial', 'trail', 'investigative', 'action', 'expected', 'notice', 'phone', 'phones',
  'bank', 'banks', 'vehicle', 'vehicles', 'money', 'person', 'persons', 'calling', 'called',
  'duration', 'cell', 'amount', 'mode', 'reference', 'mobile', 'profession',
  // ── field-label leaks from CDR / bank-statement / vehicle-RC PDFs ──
  // these tokens follow a person name in structured evidence forms and
  // would otherwise be glued onto the capture ("Devendra Rathore Badge
  // No: KA-PS-4471" → must truncate at "Badge" → "Devendra Rathore")
  'badge', 'badge no', 'subscriber', 'msisdn', 'imei', 'circle', 'period', 'request',
  'registering', 'authority', 'valid', 'upto', 'class', 'maker', 'model', 'body', 'fuel',
  'engine', 'chassis', 'colour', 'seating', 'capacity', 'gross', 'weight', 'hypothec',
  'hypothecated', 'loan', 'agreement', 'status', 'insurance', 'policy', 'pucc', 'owner',
  'rto', 'branch', 'opening', 'closing', 'period', 'txns',
  // generic org / context tokens that trail a name in narratives
  'logistics', 'components', 'imports', 'exports', 'offences', 'offenses', 'wing', 'industrial',
  'pvt', 'ltd', 'private', 'limited', 'inc', 'corp', 'corporation', 'company', 'economic',
]);

/** trailing verbs / stopwords that must not appear inside a captured name */
const NAME_STOPWORDS = new Set([
  'used', 'using', 'coordinated', 'coordinates', 'states', 'state', 'acting', 'acts',
  'along', 'with', 'near', 'before', 'after', 'was', 'is', 'has', 'had', 'and', 'the',
  'then', 'seen', 'spotted', 'who', 'which', 'value', 'cash', 'drop', 'held', 'holds',
  'owns', 'owning', 'visited', 'visit', 'travelled', 'met', 'meeting', 'allegedly',
  'instructed', 'instructs', 'stated', 'reports', 'reported', 'alleged',
  // role titles (captured-only spans like "Warehouse Coordinator" must be rejected)
  'coordinator', 'executive', 'manager', 'proprietor', 'director', 'owner', 'partner',
  'accountant', 'broker', 'dealer', 'agent', 'contractor', 'supplier', 'vendor', 'clerk',
  // common prepositions (defense-in-depth against lowercase bleed into captures)
  'in', 'on', 'at', 'by', 'to', 'of', 'from', 'via', 'for', 'into', 'over', 'under',
]);

/** validate + normalise a captured person-name span. Returns null if the
 *  span doesn't look like a plausible 1-4 word personal name. */
function cleanName(raw: string): string | null {
  let n = raw.trim().replace(NAME_TITLE_PREFIX, '').replace(/[.,;:"“”()\[\]]+$/g, '').trim();
  const words = n.split(/\s+/).filter(Boolean);
  // truncate at the first field-label / org / place word
  const labelIdx = words.findIndex((w) => {
    const base = w.toLowerCase().replace(/['’s.]+$/, '');
    return NAME_BOUNDARY_WORDS.has(w.toLowerCase()) || NAME_BOUNDARY_WORDS.has(base);
  });
  const kept = labelIdx >= 0 ? words.slice(0, labelIdx) : words;
  // Accept 1-4 word names. The previous `kept.length < 2` rule rejected
  // valid single-name persons after title-stripping (e.g. "Inspector Verma"
  // → "Verma" → rejected). Single-word names are now accepted because:
  //   (a) the structured PERSON regexes already validated the surrounding
  //       context (a label like "Accused:" or a title like "Mr."),
  //   (b) NAME_STOPWORDS + NAME_BOUNDARY_WORDS + all-caps checks below
  //       still filter out junk.
  if (kept.length < 1 || kept.length > 4) return null;
  if (kept.some((w) => NAME_STOPWORDS.has(w.toLowerCase()))) return null;
  // reject all-caps tokens (acronyms / org names like "BLUEPEAK")
  if (kept.some((w) => w.length > 2 && w === w.toUpperCase())) return null;
  return titleCase(kept.join(' '));
}

const LOC_RE = /(?:at|near|outside|spotted\s+at|seen\s+at|recorded\s+at|located\s+(?:at|in))\s+((?:[A-Z][A-Za-z]+\s?){1,4}(?:Warehouse|Hotel|Port|Plaza|Market|Bazaar|Depot|Godown|Complex|Yard|Industrial\s+Area|Industrial\s+Shed|Industrial\s+Estate|Nagar|Colony|Building|Chowk|Layout|Township|Estate|Hub|Phase|Centre|Center)(?:\s+\d+)?)/g;
const LOC_RE_LABEL = /(?:Place\s+of\s+Occurrence|Location|Area)\s*:\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}(?:\s+\d+)?)/g;
const AMOUNT_RE = /(?:₹|Rs\.?\s?)\s?([\d,]+(?:\.\d+)?)\s?(lakh|lakhs|crore|cr|l)?/gi;

export function runNER(text: string): ExtractedEntity[] {
  const out: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const push = (text: string, type: string, confidence: number) => {
    const key = `${type}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, type, confidence });
  };

  for (const m of text.matchAll(PHONE_RE)) {
    const norm = normalizePhone(m[0]);
    if (norm) push(norm, 'PHONE', 0.99);
  }
  for (const m of text.matchAll(VEHICLE_RE)) push(m[1].replace(/\s+/g, '-').toUpperCase(), 'VEHICLE', 0.97);

  // Collect narrative account-number captures first. If any are found,
  // the IFSC code is just routing metadata for those accounts — emit the
  // ACCOUNT entities only and SKIP standalone IFSC entities, so the same
  // bank account doesn't show up as two unconnected nodes (an IFSC node
  // + an account-number node). When NO account number is present, the
  // IFSC is kept as a standalone entity (rare: doc mentions only the IFSC).
  const acctCaptures: string[] = [];
  for (const m of text.matchAll(ACCT_RE)) {
    const digits2 = m[1];
    acctCaptures.push(digits2);
    push(`${digits2.slice(0, 4)} X••${digits2.slice(-4)}`, 'BANK_ACCOUNT', 0.9);
  }
  for (const m of text.matchAll(BANK_LABEL_ACCT_RE)) {
    const bank = m[1].toUpperCase();
    const suffix = m[2];
    acctCaptures.push(m[2]);
    push(`${bank} X••${suffix.slice(-4).padStart(4, '0')}`, 'BANK_ACCOUNT', 0.92);
  }
  const hasAccountNumber = acctCaptures.length > 0;
  // Track which IFSC codes the strict regex has already emitted, so the
  // lenient fallback doesn't double-emit them.
  const strictIfscs = new Set<string>();
  for (const m of text.matchAll(IFSC_RE)) {
    if (hasAccountNumber) continue; // account-number entity already covers it
    strictIfscs.add(m[1]);
    push(m[1], 'BANK_ACCOUNT', 0.95);
  }
  // Lenient fallback: catch sequences that LOOK like an IFSC (4 letters +
  // literal 0 + alphanumeric) but with 7-8 trailing chars (i.e. one extra
  // digit beyond the strict 11-char format). These are almost always typos
  // — but the analyst expects to see what they typed, with a lower
  // confidence flag so the inspector can mark it for correction.
  if (!hasAccountNumber) {
    for (const m of text.matchAll(IFSC_LENIENT_RE)) {
      if (strictIfscs.has(m[1])) continue; // already emitted by strict regex
      push(m[1], 'BANK_ACCOUNT', 0.7);
    }
  }

  // PERSON — funnel every pattern's capture through cleanName()
  const collectPerson = (raw: string) => {
    const cleaned = cleanName(raw);
    if (cleaned) push(cleaned, 'PERSON', 0.88);
  };
  for (const m of text.matchAll(PERSON_RE_LABEL)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_NUM)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_ROLE_POST)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_TITLE)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_TRIGGER)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_VERB)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_BY)) collectPerson(m[1]);
  for (const m of text.matchAll(PERSON_RE_LIST)) {
    for (const piece of m[1].split(/,\s*/)) collectPerson(piece);
  }

  for (const m of text.matchAll(LOC_RE)) push(titleCase(m[1].trim()), 'LOCATION', 0.84);
  for (const m of text.matchAll(LOC_RE_LABEL)) push(titleCase(m[1].trim()), 'LOCATION', 0.86);
  for (const m of text.matchAll(AMOUNT_RE)) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    if (m[2]?.toLowerCase().startsWith('l')) val *= 100000;
    if (m[2]?.toLowerCase().startsWith('c')) val *= 10000000;
    if (val >= 1000) push(`₹${val.toLocaleString('en-IN')}`, 'MONEY', 0.9);
  }
  return out;
}

// ─── CSV parsers ───────────────────────────────────────────────────

function splitCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(',').map((c) => c.trim()));
}

function looksLikeCdr(header: string[]): boolean {
  const h = header.join(' ').toLowerCase();
  return h.includes('calling') && h.includes('called');
}

export function parseCdrCsv(text: string, existingNodes: TraceXNode[], _existingEdges: TraceXEdge[]): ExtractionResult {
  const rows = splitCsv(text);
  if (rows.length < 2) return { nodes: [], edges: [], entities: [] };
  const linker = new Linker(existingNodes);
  const existingIds = new Set(existingNodes.map((n) => n.id));
  const header = rows[0];
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase().includes(name));
  const iCall = idx('calling');
  const iCalled = idx('called');
  const iDate = Math.max(idx('date'), idx('time'));
  const iDur = idx('duration');
  const iTower = idx('cell');

  const nodes = new Map<string, TraceXNode>();
  const edges = new Map<string, TraceXEdge>();
  const entities: ExtractedEntity[] = [];

  const resolvePhone = (p: string, date: string): string => {
    const linked = linker.phone(p);
    if (linked) return linked;
    const id = phoneId(p);
    if (!existingIds.has(id) && !nodes.has(id)) {
      nodes.set(id, {
        id,
        type: 'PHONE',
        label: p,
        sublabel: 'CDR EXTRACT · NEW',
        flags: ['CDR_MATCH'],
        firstSeen: date,
        source: 'CDR INGEST',
        assessment: 'Subscription surfaced from CDR ingest. Awaiting KYC attribution.',
        meta: { 'Origin': 'CDR ingest', 'First seen': date },
      });
      entities.push({ text: p, type: 'PHONE', confidence: 0.99 });
    }
    return id;
  };

  for (const row of rows.slice(1)) {
    const a = normalizePhone(row[iCall] ?? '');
    const b = normalizePhone(row[iCalled] ?? '');
    if (!a || !b) continue;
    const date = isoDate(row[iDate] ?? '');
    const duration = parseInt(row[iDur] ?? '0') || 0;
    const tower = iTower >= 0 ? row[iTower] : '';

    const idA = resolvePhone(a, date);
    const idB = resolvePhone(b, date);

    // aggregate duplicate call pairs
    const key = [idA, idB].sort().join('|');
    const edgeId = `cdr_${shortHash(key)}`;
    const prev = edges.get(edgeId);
    if (prev) {
      prev.weight = (prev.weight ?? 1) + 1;
      prev.label = `CALLED ×${prev.weight}`;
      if (date > prev.date) prev.date = date;
    } else {
      edges.set(edgeId, {
        id: edgeId,
        source: idA,
        target: idB,
        type: 'CALLED',
        date,
        weight: 1,
        label: 'CALLED ×1',
        meta: { lastDuration: duration, ...(tower ? { tower } : {}) },
      });
    }
  }

  // tower cluster → location nodes + phone-tower sightings
  const towers = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const t = iTower >= 0 ? row[iTower] : '';
    if (t) towers.set(t, (towers.get(t) ?? 0) + 1);
  }
  const towerId = (tower: string): string => `loc_cell_${shortHash(tower)}`;
  for (const [tower, count] of towers) {
    if (count < 2) continue;
    const id = towerId(tower);
    if (!existingIds.has(id) && !nodes.has(id)) {
      nodes.set(id, {
        id,
        type: 'LOCATION',
        label: `CELL ${tower}`,
        sublabel: 'CDR TOWER CLUSTER',
        flags: ['CDR_TOWER'],
        firstSeen: new Date().toISOString().slice(0, 10),
        source: 'CDR INGEST',
        assessment: `Tower cluster with ${count} CDR hits — probable area of operation.`,
        meta: { hits: count },
      });
      entities.push({ text: tower, type: 'LOCATION', confidence: 0.86 });
    }
  }
  // phone → tower SPOTTED_AT edges (unique pairs)
  const seenPairs = new Set<string>();
  for (const row of rows.slice(1)) {
    const t = iTower >= 0 ? row[iTower] : '';
    if (!t || (towers.get(t) ?? 0) < 2) continue;
    const a = normalizePhone(row[iCall] ?? '');
    if (!a) continue;
    const phoneLinkedId = linker.phone(a) ?? phoneId(a);
    const tid = towerId(t);
    const pairKey = `${phoneLinkedId}|${tid}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const edgeId = `cdrs_${shortHash(pairKey)}`;
    if (!edges.has(edgeId)) {
      edges.set(edgeId, {
        id: edgeId,
        source: phoneLinkedId,
        target: tid,
        type: 'SPOTTED_AT',
        date: isoDate(row[iDate] ?? ''),
        label: 'SPOTTED AT',
        meta: { source: 'CDR cell-id' },
      });
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()], entities };
}

export function parseBankCsv(text: string, existingNodes: TraceXNode[]): ExtractionResult {
  const rows = splitCsv(text);
  if (rows.length < 2) return { nodes: [], edges: [], entities: [] };
  const linker = new Linker(existingNodes);
  const existingIds = new Set(existingNodes.map((n) => n.id));
  const header = rows[0];
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase().includes(name));
  const iFrom = idx('from');
  const iTo = idx('to');
  const iAmt = idx('amount');
  const iDate = idx('date');
  const iMode = idx('mode');

  const newNodes = new Map<string, TraceXNode>();
  const edges: TraceXEdge[] = [];
  const entities: ExtractedEntity[] = [];

  const resolveAccount = (acc: string, date: string): string => {
    const linked = linker.bank(acc);
    if (linked) return linked;
    const clean = acc.replace(/\s+/g, '').toUpperCase();
    const id = `bank_${shortHash(clean)}`;
    const label = clean.length > 8 ? `${clean.slice(0, 4)} X••${clean.slice(-4)}` : clean;
    if (!existingIds.has(id) && !newNodes.has(id)) {
      newNodes.set(id, {
        id,
        type: 'BANK_ACCOUNT',
        label,
        sublabel: 'BANK STATEMENT · NEW',
        flags: ['STMT_ACCOUNT'],
        firstSeen: date,
        source: 'BANK STATEMENT INGEST',
        assessment: 'Account surfaced from bank-statement ingest. Awaiting account-holder inquiry.',
        meta: { 'Origin': 'Statement ingest' },
      });
      entities.push({ text: clean, type: 'BANK_ACCOUNT', confidence: 0.95 });
    }
    return id;
  };

  for (const row of rows.slice(1)) {
    const from = row[iFrom];
    const to = row[iTo];
    if (!from || !to) continue;
    const date = isoDate(row[iDate] ?? '');
    const amount = parseFloat((row[iAmt] ?? '0').replace(/[₹,]/g, '')) || 0;
    const mode = (iMode >= 0 ? row[iMode] : 'TRANSFER') || 'TRANSFER';
    const idA = resolveAccount(from, date);
    const idB = resolveAccount(to, date);
    const lakhs = amount >= 100000 ? `₹${(amount / 100000).toFixed(1)}L` : `₹${amount.toLocaleString('en-IN')}`;
    edges.push({
      id: `bnk_${shortHash(`${idA}>${idB}>${date}>${amount}`)}`,
      source: idA,
      target: idB,
      type: 'TRANSFERRED_FUNDS',
      date,
      weight: amount,
      label: `${lakhs} · ${mode.toUpperCase()}`,
      meta: { mode: mode.toUpperCase(), amount },
    });
    if (amount > 0) entities.push({ text: lakhs, type: 'MONEY', confidence: 0.9 });
  }

  return { nodes: [...newNodes.values()], edges, entities };
}

// ─── free-text ingestion (FIR notes / txt) ─────────────────────────

const NODE_TYPE_FOR: Record<string, NodeType> = {
  PERSON: 'PERSON',
  PHONE: 'PHONE',
  VEHICLE: 'VEHICLE',
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  LOCATION: 'LOCATION',
};

/** Determine a person's role in the case from the textual context
 *  around their mentions. Scans EVERY occurrence (not just the first)
 *  and picks the strongest role signal found — a person named as
 *  "accused" anywhere in the document is an accused, even if their
 *  first mention is in a neutral context. Returns one of:
 *    'ACCUSED'    — near accused/suspect/namely/proprietor/etc.
 *    'COMPLAINANT'— near complainant/informant
 *    'IO'         — near investigating officer/inspector/IO label
 *    'NEUTRAL'    — no role trigger (witness / undeclared)
 *  This prevents the complainant and the investigating officer from being
 *  wrongly tagged as ACCUSED (a real bug surfaced in uploaded-FIR testing
 *  where Anil Kapoor (complainant) & Devendra Rathore (IO) were both
 *  marked NAMES_ACCUSED). */
type PersonRole = 'ACCUSED' | 'COMPLAINANT' | 'IO' | 'NEUTRAL';
function detectPersonRole(text: string, personText: string): PersonRole {
  const lc = text.toLowerCase();
  const needle = personText.toLowerCase();
  if (!needle) return 'NEUTRAL';
  let foundAccused = false;
  let foundComplainant = false;
  let foundIO = false;
  let from = 0;
  // scan every occurrence — role is established by the STRONGEST context
  // across all mentions, not just the first (a person first named in a
  // neutral list can still be "accused" in a later sentence).
  while (true) {
    const idx = lc.indexOf(needle, from);
    if (idx === -1) break;
    const start = Math.max(0, idx - 60);
    const ctx = lc.slice(start, idx + needle.length + 20);
    if (/(?:investigating\s+officer|inspector|\bio\b|\bio\s+name|sub[\s-]?inspector|asi\b|\bpi\b)/.test(ctx)) foundIO = true;
    if (/(?:complainant|informant|deponent)/.test(ctx)) foundComplainant = true;
    if (/(?:accused|suspect|namely|co[\s-]?accused|proprietor|director|owner|manager|perpetrator|offender|alleged)/.test(ctx)) foundAccused = true;
    from = idx + 1;
  }
  // precedence: an IO or complainant who is ALSO "accused" in some sentence
  // is almost certainly a real accused (the IO/complainant context was just
  // a field label), so ACCUSED wins when both signals fire.
  if (foundAccused) return 'ACCUSED';
  if (foundComplainant) return 'COMPLAINANT';
  if (foundIO) return 'IO';
  return 'NEUTRAL';
}

/** KINGPIN keyword lexicon — when these cues appear within ±60 chars of a
 *  person's name in the FIR, the person is flagged KINGPIN so centrality's
 *  +6 risk boost (centrality.ts:146) fires on uploaded cases. Mirrors the
 *  ±60 window used by detectPersonRole for consistency. */
const KINGPIN_CUES = [
  'kingpin', 'king pin', 'mastermind', 'ringleader', 'ringer',
  'syndicate head', 'head of syndicate', 'head of the syndicate',
  'boss', 'crime boss', 'drug lord', 'laundering kingpin',
  'caller of shots', 'prime mover', 'principal accused',
];
function detectKingpinContext(text: string, personText: string): boolean {
  const lc = text.toLowerCase();
  const needle = personText.toLowerCase();
  if (!needle) return false;
  let from = 0;
  while (true) {
    const idx = lc.indexOf(needle, from);
    if (idx === -1) break;
    const start = Math.max(0, idx - 60);
    const ctx = lc.slice(start, idx + needle.length + 20);
    if (KINGPIN_CUES.some((kw) => ctx.includes(kw))) return true;
    from = idx + 1;
  }
  return false;
}

// ─── sentence-level relationship inference ─────────────────────────
// Turns a flat extracted-entity list into a rich, multi-relational graph
// by inferring operational relationships from co-occurrence within the
// same sentence/clause + trigger verbs. This is what transforms "extraction"
// into "analysis": a star graph (FIR + leaves) becomes a network with
// multiple relationship types and real topology that PageRank / betweenness /
// community detection can actually chew on — for ANY uploaded FIR, not just
// the pre-seeded demo cases.
//
// Inference rules are 100% algorithmic (no hardcoded per-PDF outputs):
//   PERSON + PHONE       → OWNS (or USES if "used by" verb)
//   PERSON + BANK_ACCOUNT→ OWNS (signatory / account holder)
//   PERSON + VEHICLE     → OWNS / USES
//   PERSON + LOCATION    → SPOTTED_AT (at / near / spotted / seen / visited)
//   PERSON + PERSON      → CO_ACCUSED (co-accused / along with / accused)
//                          else LINKED_TO
//   BANK + BANK + amount → TRANSFERRED_FUNDS (transfer / sent / NEFT / RTGS)
//   PHONE + PHONE        → CALLED (called / contacted / dialed)
//   VEHICLE + LOCATION   → SPOTTED_AT (at / near / parked / spotted)
//
// Money amounts found in the same segment attach to bank→bank transfer edges
// as the edge weight, so the funds-flow analytics layer lights up.

interface CharSpan { start: number; end: number }

/** Every character-span occurrence of `needle` in `haystack` (case-insensitive). */
function findAllSpans(haystack: string, needle: string): CharSpan[] {
  const out: CharSpan[] = [];
  if (!needle || needle.length < 2) return out;
  const lc = haystack.toLowerCase();
  const nl = needle.toLowerCase();
  let from = 0;
  while (true) {
    const i = lc.indexOf(nl, from);
    if (i === -1) break;
    out.push({ start: i, end: i + needle.length });
    from = i + 1;
  }
  return out;
}

interface Segment { start: number; end: number; text: string }

/** Split text into clause/sentence segments with their character spans.
 *  Boundaries: `;` OR a `.`/`!`/`?` followed by whitespace + a capital
 *  letter or end-of-text. Splitting only on TRUE sentence boundaries (not
 *  every period) keeps "Rs. 45.5 lakh", "Mr. Sharma", "A/c No. 1234", "FIR
 *  No. 2847/2024" intact as single segments — critical so that money
 *  amounts and labelled fields stay co-occurrent with their entities.
 *  Segments under 8 chars are dropped (punctuation noise). */
function segmentText(text: string): Segment[] {
  const out: Segment[] = [];
  // match a run of non-terminator chars, OR a terminator that doesn't end a
  // sentence (period not followed by space+capital). Terminators: ; ! ? and
  // . when followed by whitespace + uppercase letter or end-of-string.
  const re = /(?:[^;.!?\n]|\.(?!\s*[A-Z])(?!\s*$))+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const seg = m[0];
    if (seg.trim().length >= 8) {
      out.push({ start: m.index, end: m.index + seg.length, text: seg });
    }
    if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
  }
  return out;
}

interface EntityRec {
  entity: ExtractedEntity;
  nodeId: string;
  spans: CharSpan[];
}

interface InferredEdge {
  type: EdgeType;
  source: string;
  target: string;
  label: string;
  weight?: number;
}

function formatLakh(amt: number): string {
  return amt >= 100000 ? `${(amt / 100000).toFixed(1)}L` : amt.toLocaleString('en-IN');
}

/** Parse a MONEY entity's text ("₹38.0L", "Rs. 2,50,000") back into a number. */
function parseMoneyAmount(text: string): number {
  const m = text.match(/([\d,]+(?:\.\d+)?)/);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(/,/g, ''));
  if (/l/i.test(text)) v *= 100000;
  if (/cr|crore/i.test(text)) v *= 10000000;
  return v || 0;
}

/** Parse a call-frequency count from a free-text CDR-style sentence. Returns
 *  the parsed count (>=1) or 1 when no frequency token is present.
 *
 *  Supported notations (case-insensitive, mirroring the CDR-tabular path's
 *  `CALLED ×N` convention so hand-seeded mock edges and extracted edges share
 *  one vocabulary):
 *   - `×7` / `x7` / `x 7`  — Unicode multiplication sign or standalone ASCII x
 *   - `7 times` / `56 times` — "… rang … 56 times"
 *   - `on 7 occasions` / `on 34 occasions`
 *   - `7 calls` / `34 calls` — but NOT "called" (word boundary after `calls?`
 *     rejects "called", so "phone X called phone Y" yields no false count)
 *
 *  Date / phone-number digit groups never collide with these patterns: a bare
 *  digit run is only captured when immediately followed by `times`,
 *  `occasions`, `calls`, or when preceded by `×`/standalone `x`. Dates such
 *  as "01 June 2026" and phone fragments such as "98110 44321" are therefore
 *  safe. */
function parseCallCount(text: string): number {
  const t = text.toLowerCase();
  const patterns: RegExp[] = [
    /[×]\s*(\d{1,4})\b/,               // "×7" (U+00D7)
    /\bx\s*(\d{1,4})\b/,               // "x7" / "x 7" (standalone ASCII x)
    /(\d{1,4})\s+times\b/,             // "7 times", "56 times"
    /\bon\s+(\d{1,4})\s+occasions?\b/, // "on 7 occasions", "on 34 occasions"
    /(\d{1,4})\s+calls?\b/,            // "7 calls" (NOT "called")
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return Math.max(1, parseInt(m[1], 10));
  }
  return 1;
}

/** Infer an operational relationship between two co-occurring entities.
 *  `a`/`b` carry the entity type, node id, and the first-occurrence
 *  character offset of each entity within the segment. Returns null when
 *  no plausible relationship applies.
 *
 *  Direction rules:
 *  - Person-centric edges (OWNS phone/bank/vehicle, SPOTTED_AT location):
 *    the PERSON is ALWAYS the source, regardless of mention order — a
 *    phone can't "own" a person, a bank can't "own" a person.
 *  - Transfer / call edges: the FIRST-MENTIONED entity is the source
 *    (first bank mentioned is the sender; first phone is the caller).
 *  - Symmetric edges (CO_ACCUSED, LINKED_TO): direction is arbitrary.
 *
 *  Label provenance scheme — every edge carries an honesty qualifier so
 *  investigators know whether the link is a parsed fact or a hypothesis:
 *   - bare label  (`OWNS`, `CALLED`, `TRANSFER`, `SPOTTED AT`, `CO-ACCUSED`)
 *       → CONFIRMED: an explicit operational verb was parsed from the
 *         sentence (e.g. "Vikram owns phone…", "transferred ₹38L",
 *         "called at 21:14"). The (INFERRED) tag is dropped.
 *   - `… (INFERRED)` → co-occurrence only: the two entities appeared in
 *       the same sentence with NO explicit relational verb. The link is
 *       an investigative hypothesis derived from entity-type pairing, not
 *       a parsed fact — verify before acting on it.
 *   - `… (CO-OCCUR)` → weakest: both PERSONs were named in an accusation
 *       context but no explicit conspiracy verb links them. */
function inferEdge(
  a: { entity: ExtractedEntity; nodeId: string; pos: number },
  b: { entity: ExtractedEntity; nodeId: string; pos: number },
  segText: string,
  moneyInSeg: number[],
): InferredEdge | null {
  const t = segText.toLowerCase();
  const has = (...kws: string[]) => kws.some((kw) => t.includes(kw));
  // order by first occurrence — used for transfer / call direction
  const [first, second] = a.pos <= b.pos ? [a, b] : [b, a];
  const pair = [a.entity.type, b.entity.type].sort().join('+');
  // helper: pick the PERSON out of the two (for person-centric edges)
  const personSide = (): { src: string; tgt: string } => {
    if (a.entity.type === 'PERSON') return { src: a.nodeId, tgt: b.nodeId };
    return { src: b.nodeId, tgt: a.nodeId };
  };

  // Explicit-verb lexicons — when present in the segment, the edge is
  // CONFIRMED and the (INFERRED) honesty tag is dropped. When absent,
  // the edge still fires (for person-centric pairs) but is tagged
  // (INFERRED) to flag it as a co-occurrence hypothesis.
  const OWNS_CUES = [
    'owns', 'owned', 'owner', 'holder', 'holding', 'held by', 'holds',
    'subscriber', 'subscription', 'subscribed',
    'registered to', 'registered in', 'registration of',
    'in the name of', 'in name of', 'on behalf of',
    'uses', 'using', 'used by', 'possesses', 'possession', 'possess',
    'maintains', 'maintained', 'signatory', 'account holder',
    'driver of', 'drives', 'driven by', 'kept at', 'kept by',
  ];
  const SPOT_CUES = [
    'spotted', 'seen', 'sighted', 'witnessed',
    'located at', 'located in', 'located near',
    'present at', 'present in', 'present near',
    'met at', 'met in', 'met near',
    'traveled to', 'travelled to', 'visited', 'arrived at', 'reached',
    'parked at', 'parked near', 'parked in',
    'found at', 'found near', 'found in',
    'observed at', 'observed in', 'observed near',
    'gathered at', 'assembled at',
    'at ', 'near ',
  ];

  switch (pair) {
    case 'BANK_ACCOUNT+BANK_ACCOUNT': {
      // transfer verbs are mandatory — two banks co-occurring without one
      // is usually an annexure listing, not a fund movement. Verb present
      // → edge is CONFIRMED, so the (INFERRED) tag is dropped.
      if (!has('transfer', 'sent', 'remitt', 'deposited', 'neft', 'rtgs', 'imps', 'upi', 'wire', 'received', 'launder', 'moved', 'routed', 'paid', 'payment', 'credit', 'debit')) {
        return null;
      }
      const amt = moneyInSeg[0] ?? 0;
      return {
        type: 'TRANSFERRED_FUNDS',
        source: first.nodeId,
        target: second.nodeId,
        label: amt ? `₹${formatLakh(amt)}` : 'TRANSFER',
        weight: amt || undefined,
      };
    }
    // NOTE: pair is the alphabetically-SORTED join of the two entity types,
    // so "BANK_ACCOUNT+PERSON" (not "PERSON+BANK_ACCOUNT"), "LOCATION+PERSON",
    // "LOCATION+VEHICLE" etc. Match the sorted form here.
    case 'BANK_ACCOUNT+PERSON': {
      // a person named alongside a bank account in an FIR is overwhelmingly
      // the account holder / signatory — person is ALWAYS the source (owner)
      const { src, tgt } = personSide();
      const confirmed = has(...OWNS_CUES);
      return {
        type: 'OWNS', source: src, target: tgt,
        label: confirmed ? 'OWNS' : 'OWNS (INFERRED)',
      };
    }
    case 'LOCATION+PERSON': {
      const { src, tgt } = personSide();
      const confirmed = has(...SPOT_CUES);
      return {
        type: 'SPOTTED_AT', source: src, target: tgt,
        label: confirmed ? 'SPOTTED AT' : 'SPOTTED AT (INFERRED)',
      };
    }
    case 'PERSON+PHONE': {
      const { src, tgt } = personSide();
      const confirmed = has(...OWNS_CUES);
      return {
        type: 'OWNS', source: src, target: tgt,
        label: confirmed ? 'OWNS' : 'OWNS (INFERRED)',
      };
    }
    case 'PERSON+VEHICLE': {
      const { src, tgt } = personSide();
      const confirmed = has(...OWNS_CUES);
      return {
        type: 'OWNS', source: src, target: tgt,
        label: confirmed ? 'OWNS' : 'OWNS (INFERRED)',
      };
    }
    case 'PERSON+PERSON': {
      // symmetric — use first-mentioned as source
      if (has('co-accused', 'co accused', 'accomplice', 'along with', 'associate', 'conspire', 'together', 'abet', 'syndicate', 'gang', 'group', 'aided', 'abetment', 'conspiracy')) {
        // explicit conspiracy verb → CONFIRMED, drop the (INFERRED) tag
        return { type: 'CO_ACCUSED', source: first.nodeId, target: second.nodeId, label: 'CO-ACCUSED' };
      }
      // both named in an accusation context → co-accused; otherwise just LINKED
      if (has('accused', 'suspect', 'named', 'charged', 'perpetrator', 'offender', 'alleged')) {
        return { type: 'CO_ACCUSED', source: first.nodeId, target: second.nodeId, label: 'CO-ACCUSED (CO-OCCUR)' };
      }
      return { type: 'LINKED_TO', source: first.nodeId, target: second.nodeId, label: 'LINKED (CO-OCCUR)' };
    }
    case 'PHONE+PHONE': {
      // call verbs are mandatory — without one, two phones co-occurring is
      // just an annexure. Verb present → CONFIRMED, drop the (INFERRED) tag.
      // Call frequency is parsed from the same sentence ("×7", "7 times",
      // "on 7 occasions", "7 calls") so a single CDR-summary sentence yields
      // a weighted `CALLED ×N` edge that mirrors the CDR-tabular path's
      // convention. A bare "called" with no count yields weight 1 and the
      // bare `CALLED` label (unchanged behaviour).
      if (has('called', 'contact', 'dial', 'rang', 'spoke', 'communicat', 'call ', 'calls')) {
        const count = parseCallCount(segText);
        return {
          type: 'CALLED', source: first.nodeId, target: second.nodeId,
          label: count > 1 ? `CALLED ×${count}` : 'CALLED',
          weight: count,
        };
      }
      return null;
    }
    case 'LOCATION+VEHICLE': {
      // spotting verb is mandatory. Verb present → CONFIRMED, drop the tag.
      if (has(...SPOT_CUES)) {
        // vehicle is always the source — a vehicle is spotted AT a location
        // (not the other way around), regardless of mention order
        const src = a.entity.type === 'VEHICLE' ? a.nodeId : b.nodeId;
        const tgt = a.entity.type === 'VEHICLE' ? b.nodeId : a.nodeId;
        return { type: 'SPOTTED_AT', source: src, target: tgt, label: 'SPOTTED AT' };
      }
      return null;
    }
    default:
      return null;
  }
}

export function extractFromText(text: string, filename: string, existingNodes: TraceXNode[]): ExtractionResult {
  // Normalise whitespace: collapse all runs (incl. newlines from PDF text
  // extraction) to single spaces. PDFs frequently wrap a phone number or
  // IFSC across a line break — "+91 98110\n44172" — which would otherwise
  // break the PHONE regex match AND split a single sentence into two
  // segments, defeating sentence-level co-occurrence inference. After
  // normalisation, every span / segment operates on a single-line text
  // coordinate system, so NER, segmentation and span-matching all agree.
  const normalized = text.replace(/\s+/g, ' ').trim();
  const entities = runNER(normalized);
  const linker = new Linker(existingNodes);
  const existingIds = new Set(existingNodes.map((n) => n.id));
  const nodes: TraceXNode[] = [];
  const edges: TraceXEdge[] = [];
  const edgeKeys = new Set<string>();
  const date = new Date().toISOString().slice(0, 10);
  const firLabel = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toUpperCase().slice(0, 28) || 'FIR NOTE';

  // 1. the note itself becomes an FIR-record node (provenance anchor)
  const firId = `fir_txt_${shortHash(filename)}`;
  if (!existingIds.has(firId)) {
    nodes.push({
      id: firId,
      type: 'FIR',
      label: firLabel,
      sublabel: 'TEXT INGEST · NER + REL INFERENCE',
      firstSeen: date,
      source: 'TEXT INGEST',
      assessment:
        'Free-text intelligence note parsed with regex NER + sentence-level co-occurrence relationship inference. Edges labelled with an explicit verb (e.g. OWNS, CALLED, TRANSFER) are CONFIRMED from the FIR wording; edges tagged (INFERRED) are co-occurrence hypotheses derived from entity-type pairing and require verification. Analysis is computed dynamically from the uploaded content, not from any pre-seeded fixture.',
      meta: { 'Parser': 'TRACE-X NER+Inference v2.0' },
    });
  }

  // 2. resolve each non-MONEY entity onto an existing or new node and
  //    record every character span where it appears (for co-occurrence)
  const recs: EntityRec[] = [];
  for (const ent of entities) {
    if (ent.type === 'MONEY') continue;
    const nodeType = NODE_TYPE_FOR[ent.type];
    if (!nodeType) continue;

    let id: string | null = null;
    if (ent.type === 'PHONE') id = linker.phone(ent.text);
    else if (ent.type === 'BANK_ACCOUNT') id = linker.bank(ent.text);
    else id = linker.byLabel(ent.type === 'PERSON' ? ent.text.toUpperCase() : ent.text);

    let isNew = false;
    if (!id) {
      id = `${ent.type.toLowerCase()}_${shortHash(ent.text)}`;
      isNew = true;
    }

    // Role-aware flags + provenance edge for persons. Only real ACCUSED get
    // the ACCUSED flag and a NAMES_ACCUSED edge; the complainant & IO get
    // their own flag + a LINKED_TO edge labelled by role, so they are NOT
    // misrepresented as accused in the graph or the BSA §63 report.
    const role: PersonRole = ent.type === 'PERSON' ? detectPersonRole(normalized, ent.text) : 'NEUTRAL';
    // KINGPIN auto-detection: when the FIR text uses keywords like
    // "kingpin", "boss", "mastermind", "ringleader", "head of syndicate"
    // near the person's name, flag the node so centrality's +6 risk boost
    // (centrality.ts line 146) fires for uploaded cases — previously this
    // boost only applied to seed-data persons pre-flagged with KINGPIN,
    // so uploaded cases never surfaced a kingpin even when the FIR text
    // explicitly used the word.
    const isKingpin = ent.type === 'PERSON' && detectKingpinContext(normalized, ent.text);

    if (isNew && !existingIds.has(id)) {
      const flags: string[] = ['NER_EXTRACT'];
      if (role === 'ACCUSED') flags.push('ACCUSED');
      else if (role === 'COMPLAINANT') flags.push('COMPLAINANT');
      else if (role === 'IO') flags.push('INVESTIGATING_OFFICER');
      if (isKingpin) flags.push('KINGPIN');
      nodes.push({
        id,
        type: nodeType,
        label: ent.type === 'PERSON' ? ent.text.toUpperCase() : ent.text,
        sublabel: 'NER EXTRACT',
        flags,
        firstSeen: date,
        source: 'TEXT INGEST · NER',
        assessment: `Entity extracted with ${(ent.confidence * 100).toFixed(0)}% confidence. Operational relationships to co-occurring entities are inferred from sentence context below — edges with an explicit verb (OWNS, CALLED, …) are CONFIRMED; edges tagged (INFERRED) are co-occurrence hypotheses.`,
        meta: { confidence: ent.confidence },
      });
    }

    // provenance edge: FIR links this entity. Edge type + label reflect
    // the person's role when applicable.
    const firEdgeType: EdgeType =
      ent.type === 'PERSON' && role === 'ACCUSED' ? 'NAMES_ACCUSED' : 'LINKED_TO';
    const firEdgeLabel =
      ent.type === 'PERSON'
        ? role === 'ACCUSED'
          ? 'NAMES ACCUSED'
          : role === 'COMPLAINANT'
            ? 'FILED BY'
            : role === 'IO'
              ? 'INVESTIGATED BY'
              : 'NAMED IN'
        : 'LINKED TO';
    const firKey = `${firId}|${id}|${firEdgeType}|${firEdgeLabel}`;
    if (!edgeKeys.has(firKey)) {
      edgeKeys.add(firKey);
      edges.push({
        id: `txt_${shortHash(firKey)}`,
        source: firId,
        target: id,
        type: firEdgeType,
        date,
        label: firEdgeLabel,
      });
    }
    recs.push({ entity: ent, nodeId: id, spans: findAllSpans(normalized, ent.text) });
  }

  // 3. collect money amounts + spans (for bank→bank transfer weighting).
  // We re-scan the normalized text directly for amounts (rather than reusing
  // the runNER MONEY entities) because the entity text stored by runNER is
  // a NORMALISED display form ("₹45,50,000") that does not literally appear
  // in the source text ("Rs. 45.5 lakh"), so findAllSpans would miss it.
  // Scanning with the regex gives us both the parsed amount and the actual
  // character span where the amount was found.
  const moneyRecs: Array<{ amount: number; spans: CharSpan[] }> = [];
  const moneyBySpan = new Map<string, number>();
  for (const m of normalized.matchAll(AMOUNT_RE)) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    if (m[2]?.toLowerCase().startsWith('l')) val *= 100000;
    if (m[2]?.toLowerCase().startsWith('c')) val *= 10000000;
    if (val < 1000) continue;
    const start = m.index ?? 0;
    const spanKey = `${start}:${start + m[0].length}`;
    if (!moneyBySpan.has(spanKey)) moneyBySpan.set(spanKey, val);
  }
  for (const [spanKey, amount] of moneyBySpan) {
    const [s, e] = spanKey.split(':').map(Number);
    moneyRecs.push({ amount, spans: [{ start: s, end: e }] });
  }

  // 4. segment + infer inter-entity relationships from co-occurrence.
  // Pronoun co-reference: real-world FIRs use "He"/"She" to refer to a
  // previously-named person in the next sentence ("Vikram Shah owns phone
  // X. He is the holder of bank account Y."). Without resolution, the
  // second sentence has the bank but no PERSON in segment → no OWNS edge
  // fires and the analyst loses ~20% of edges on a typical FIR. We resolve
  // by tracking the most-recently-mentioned male and female person across
  // segments (gender guessed conservatively from first-name suffix), and
  // when a segment starts with He/She/His/Her AND has no PERSON entity in
  // segment, we inject the most-recent matching-gender person at pos 0 so
  // the pair-inference loop fires. No-match → no injection (no false edge).
  const MALE_OVERRIDE_I_ENDING = new Set([
    'ravi', 'sai', 'mani', 'govind', 'hari', 'sri', 'siddharth', 'raghu',
    'krishn', 'murli', 'gopi', 'suri', 'madhavan',
  ]);
  const personGender = new Map<string, 'male' | 'female'>(); // nodeId → gender
  for (const r of recs) {
    if (r.entity.type !== 'PERSON') continue;
    const first = r.entity.text.split(/\s+/)[0]?.toLowerCase() ?? '';
    const looksFemale = /(?:a|i|aa|ee|ina)$/.test(first) && first.length >= 3;
    const isOverrideMale = MALE_OVERRIDE_I_ENDING.has(first);
    personGender.set(r.nodeId, looksFemale && !isOverrideMale ? 'female' : 'male');
  }
  let lastMaleRec: { entity: ExtractedEntity; nodeId: string } | null = null;
  let lastFemaleRec: { entity: ExtractedEntity; nodeId: string } | null = null;
  const PRONOUN_HE = /^(?:he|his|him)\b/i;
  const PRONOUN_SHE = /^(?:she|her)\b/i;

  const segments = segmentText(normalized);
  for (const seg of segments) {
    const inSeg: Array<{ entity: ExtractedEntity; nodeId: string; pos: number }> = [];
    for (const r of recs) {
      const span = r.spans.find((s) => s.start >= seg.start && s.end <= seg.end);
      if (span) inSeg.push({ entity: r.entity, nodeId: r.nodeId, pos: span.start - seg.start });
    }
    // Snapshot persons genuinely mentioned in THIS segment (pre-injection),
    // used to update last-mentioned tracking after edge inference.
    const personsInThisSeg = inSeg.filter((r) => r.entity.type === 'PERSON');

    // Pronoun resolution: if segment starts with He/She and has no PERSON,
    // inject the most-recent matching-gender person from prior segments.
    if (personsInThisSeg.length === 0) {
      const segTrimmed = seg.text.trimStart();
      if (PRONOUN_HE.test(segTrimmed) && lastMaleRec) {
        inSeg.push({ entity: lastMaleRec.entity, nodeId: lastMaleRec.nodeId, pos: 0 });
      } else if (PRONOUN_SHE.test(segTrimmed) && lastFemaleRec) {
        inSeg.push({ entity: lastFemaleRec.entity, nodeId: lastFemaleRec.nodeId, pos: 0 });
      }
    }

    // Update last-mentioned tracking with persons genuinely mentioned here.
    for (const p of personsInThisSeg) {
      const g = personGender.get(p.nodeId);
      if (g === 'female') lastFemaleRec = { entity: p.entity, nodeId: p.nodeId };
      else lastMaleRec = { entity: p.entity, nodeId: p.nodeId };
    }

    if (inSeg.length < 2) continue;
    const moneyInSeg: number[] = [];
    for (const m of moneyRecs) {
      if (m.spans.some((s) => s.start >= seg.start && s.end <= seg.end)) moneyInSeg.push(m.amount);
    }
    for (let i = 0; i < inSeg.length; i++) {
      for (let j = i + 1; j < inSeg.length; j++) {
        const inferred = inferEdge(inSeg[i], inSeg[j], seg.text, moneyInSeg);
        if (!inferred) continue;
        const key = `${inferred.source}|${inferred.target}|${inferred.type}`;
        if (edgeKeys.has(key)) {
          // Multiple call sentences about the same directed phone pair (e.g.
          // "called on 34 occasions between Jun–Aug" + "dialled 56 times on
          // 14 August") must accumulate into one weighted edge, mirroring the
          // CDR-tabular path's `prev.weight += 1` semantics. Sum the parsed
          // counts and refresh the label so the graph shows the TRUE total
          // call volume for the pair, not just the first sentence's count.
          if (inferred.type === 'CALLED' && inferred.weight) {
            const existing = edges.find(
              (e) =>
                e.source === inferred.source &&
                e.target === inferred.target &&
                e.type === 'CALLED',
            );
            if (existing) {
              const sum = (existing.weight ?? 1) + (inferred.weight ?? 1);
              existing.weight = sum;
              existing.label = sum > 1 ? `CALLED ×${sum}` : 'CALLED';
            }
          }
          continue;
        }
        edgeKeys.add(key);
        edges.push({
          id: `inf_${shortHash(key)}`,
          source: inferred.source,
          target: inferred.target,
          type: inferred.type,
          date,
          weight: inferred.weight,
          label: inferred.label,
          meta: { inference: 'co-occurrence' },
        });
      }
    }
  }

  return { nodes, edges, entities };
}

// ─── PDF simulation (deterministic pseudo-OCR) ─────────────────────
// ONLY used as a fallback when extractPdfText() returns null (i.e. the
// uploaded PDF is scanned / image-only — no text streams recoverable).
// The graph produced here is SYNTHETIC: names, phones, banks, amounts are
// all drawn from generic pools, seeded by the file's SHA-256 so the same
// scanned PDF always produces the same synthetic graph (reproducible, not
// hardcoded to any particular PDF). Every node carries an "OCR SIMULATION"
// label so analysts know the entities are not real extractions — and the
// upload API surfaces this state to the UI via the `extractionMethod` flag
// so a toast can warn the analyst to upload a text-based PDF or .txt file
// for real NER. The topology is rich (2 co-accused persons, 2 phones that
// call each other, 2 banks with a fund transfer, a vehicle, a location —
// all interconnected) so the analytics layer (PageRank / betweenness /
// communities / risk) still demonstrates meaningfully even on a scan.

const SIM_NAMES = ['Rohit Sethi', 'Kabir Nanda', 'Farhan Sheikh', 'Meera Joshi', 'Imran Qureshi', 'Devraj Pillai', 'Nikhil Rao', 'Sana Kapoor', 'Arun Saxena', 'Priya Nair'];
const SIM_BANKS = ['AXIS X••2210', 'YES X••8845', 'KOTAK X••6619', 'BOB X••5583', 'IDFC X••9931', 'ICICI X••7720', 'HDFC X••1188'];
const SIM_PLATES = ['HR-26-AB-4417', 'DL-8C-AX-9023', 'MH-04-GH-0077', 'KA-05-MN-3310', 'RJ-14-CD-7788'];
const SIM_LOCS = ['Karol Bagh Hub', 'Narela Warehouse', 'Mundra Port Gate 3', 'Sector 11 Depot', 'Nehru Place Complex'];
const SIM_PHONE_PREFIXES = ['98110', '98732', '90024', '99103', '98204', '91230'];

function simPhone(rand: () => number): string {
  const p = SIM_PHONE_PREFIXES[Math.floor(rand() * SIM_PHONE_PREFIXES.length)];
  const d = String(Math.floor(10000 + rand() * 89999)).padStart(5, '0').slice(0, 5);
  return `+91 ${p} ${d}`;
}

export function simulatePdfOcr(filename: string, sha256: string, existingNodes: TraceXNode[]): ExtractionResult {
  const rand = seededRandom(sha256);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const linker = new Linker(existingNodes);
  const nodes: TraceXNode[] = [];
  const edges: TraceXEdge[] = [];
  const entities: ExtractedEntity[] = [];
  const edgeKeys = new Set<string>();
  const existingIds = new Set(existingNodes.map((n) => n.id));
  const date = new Date().toISOString().slice(0, 10);
  const addEdge = (id: string, source: string, target: string, type: EdgeType, label: string, weight?: number, meta?: Record<string, string | number>) => {
    const key = `${source}|${target}|${type}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id, source, target, type, date, label, weight, meta });
  };

  const firLabel = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toUpperCase().slice(0, 28) || 'FIR PDF';
  const firId = `fir_pdf_${sha256.slice(0, 8)}`;
  if (!existingIds.has(firId)) {
    nodes.push({
      id: firId,
      type: 'FIR',
      label: firLabel,
      sublabel: 'PDF OCR · SIMULATED (SCANNED)',
      firstSeen: date,
      source: 'PDF OCR PIPELINE (SIM FALLBACK)',
      assessment:
        'Scanned / image-only PDF — no text streams were recoverable for real NER. A synthetic graph has been generated deterministically from the file hash so the analytics layer remains exercisable, but entity names are NOT real extractions. Re-ingest as a text-based PDF or .txt file for true analysis.',
      meta: { 'Parser': 'SpaCy NER (sim fallback)', 'Pages': 1 + Math.floor(rand() * 3), 'Note': 'SCANNED — entities synthetic' },
    });
  }

  // 2 co-accused persons (the seeded hash picks two distinct names)
  const nameA = pick(SIM_NAMES);
  let nameB = pick(SIM_NAMES);
  while (nameB === nameA) nameB = pick(SIM_NAMES);
  const mkPerson = (name: string, suffix: string) => {
    const existing = linker.byLabel(name.toUpperCase());
    if (existing) return { id: existing, label: name };
    const id = `person_ocr_${sha256.slice(parseInt(suffix, 16) % 50, parseInt(suffix, 16) % 50 + 6)}`;
    nodes.push({
      id,
      type: 'PERSON',
      label: name.toUpperCase(),
      sublabel: 'OCR EXTRACT · ACCUSED (SIM)',
      flags: ['NER_EXTRACT', 'ACCUSED', 'OCR_SIM'],
      firstSeen: date,
      source: 'PDF OCR PIPELINE (SIM FALLBACK)',
      assessment: 'Synthetic accused — scanned-PDF fallback. Not a real extraction.',
      meta: { 'Extraction confidence': '0.91 (simulated)', 'Synthetic': 'true' },
    });
    entities.push({ text: name, type: 'PERSON', confidence: 0.91 });
    return { id, label: name };
  };
  const pa = mkPerson(nameA, '08');
  const pb = mkPerson(nameB, '14');
  addEdge(`ocr_p1_${sha256.slice(0, 6)}`, firId, pa.id, 'NAMES_ACCUSED', 'NAMES ACCUSED');
  addEdge(`ocr_p2_${sha256.slice(2, 8)}`, firId, pb.id, 'NAMES_ACCUSED', 'NAMES ACCUSED');
  addEdge(`ocr_coa_${sha256.slice(4, 10)}`, pa.id, pb.id, 'CO_ACCUSED', 'CO-ACCUSED (SIM)');

  // 2 burner phones — each owned by a person, calling each other
  const mkPhone = (ownerId: string, suffix: string) => {
    const num = simPhone(rand);
    if (linker.phone(num)) return { id: linker.phone(num)!, label: num };
    const id = `phone_ocr_${sha256.slice(parseInt(suffix, 16) % 50, parseInt(suffix, 16) % 50 + 6)}`;
    nodes.push({
      id,
      type: 'PHONE',
      label: num,
      sublabel: 'OCR EXTRACT · BURNER (SIM)',
      flags: ['NER_EXTRACT', 'OCR_SIM'],
      firstSeen: date,
      source: 'PDF OCR PIPELINE (SIM FALLBACK)',
      assessment: 'Synthetic handset — scanned-PDF fallback.',
      meta: { 'Extraction confidence': '0.96 (simulated)', 'Synthetic': 'true' },
    });
    entities.push({ text: num, type: 'PHONE', confidence: 0.96 });
    addEdge(`ocr_own_ph_${suffix}`, ownerId, id, 'OWNS', 'OWNS (SIM)');
    return { id, label: num };
  };
  const phA = mkPhone(pa.id, '1a');
  const phB = mkPhone(pb.id, '20');
  const callW = 1 + Math.floor(rand() * 12);
  addEdge(`ocr_call_${sha256.slice(6, 12)}`, phA.id, phB.id, 'CALLED', `CALLED ×${callW} (SIM)`, callW, { inference: 'OCR sim' });

  // 2 bank accounts — one owned by each person, with a fund transfer between them
  const mkBank = (ownerId: string, suffix: string) => {
    const label = pick(SIM_BANKS);
    let bid = linker.byLabel(label);
    if (!bid) {
      bid = `bank_ocr_${sha256.slice(parseInt(suffix, 16) % 50, parseInt(suffix, 16) % 50 + 6)}`;
      nodes.push({
        id: bid,
        type: 'BANK_ACCOUNT',
        label,
        sublabel: 'OCR EXTRACT · ANNEXURE (SIM)',
        flags: ['NER_EXTRACT', 'OCR_SIM'],
        firstSeen: date,
        source: 'PDF OCR PIPELINE (SIM FALLBACK)',
        assessment: 'Synthetic account — scanned-PDF fallback.',
        meta: { 'Extraction confidence': '0.93 (simulated)', 'Synthetic': 'true' },
      });
      entities.push({ text: label, type: 'BANK_ACCOUNT', confidence: 0.93 });
    }
    addEdge(`ocr_own_bk_${suffix}`, ownerId, bid, 'OWNS', 'OWNS (SIM)');
    return { id: bid, label };
  };
  const bkA = mkBank(pa.id, '26');
  const bkB = mkBank(pb.id, '2c');
  const amount = (2 + Math.floor(rand() * 40)) * 100000;
  addEdge(`ocr_tx_${sha256.slice(8, 14)}`, bkA.id, bkB.id, 'TRANSFERRED_FUNDS', `₹${(amount / 100000).toFixed(1)}L · OCR SIM`, amount, { mode: 'OCR SIM', amount });
  entities.push({ text: `₹${(amount / 100000).toFixed(1)}L`, type: 'MONEY', confidence: 0.9 });

  // 1 vehicle owned by person A, spotted at a location
  const plate = pick(SIM_PLATES);
  let vehId = linker.byLabel(plate);
  if (!vehId) {
    vehId = `veh_ocr_${sha256.slice(32, 38)}`;
    nodes.push({
      id: vehId,
      type: 'VEHICLE',
      label: plate,
      sublabel: 'OCR EXTRACT · VEHICLE (SIM)',
      flags: ['NER_EXTRACT', 'OCR_SIM'],
      firstSeen: date,
      source: 'PDF OCR PIPELINE (SIM FALLBACK)',
      assessment: 'Synthetic vehicle — scanned-PDF fallback.',
      meta: { 'Synthetic': 'true' },
    });
    entities.push({ text: plate, type: 'VEHICLE', confidence: 0.94 });
  }
  addEdge(`ocr_own_v_${sha256.slice(10, 16)}`, pa.id, vehId!, 'OWNS', 'OWNS (SIM)');

  // 1 rendezvous location both persons + vehicle spotted at
  const locName = pick(SIM_LOCS);
  let locId = linker.byLabel(locName.toUpperCase());
  if (!locId) {
    locId = `loc_ocr_${sha256.slice(38, 44)}`;
    nodes.push({
      id: locId,
      type: 'LOCATION',
      label: locName.toUpperCase(),
      sublabel: 'OCR EXTRACT · LOCATION (SIM)',
      flags: ['NER_EXTRACT', 'OCR_SIM', 'RENDEZVOUS_POINT'],
      firstSeen: date,
      source: 'PDF OCR PIPELINE (SIM FALLBACK)',
      assessment: 'Synthetic rendezvous — scanned-PDF fallback.',
      meta: { 'Synthetic': 'true' },
    });
    entities.push({ text: locName, type: 'LOCATION', confidence: 0.86 });
  }
  addEdge(`ocr_sp_a_${sha256.slice(12, 18)}`, pa.id, locId!, 'SPOTTED_AT', 'SPOTTED AT (SIM)');
  addEdge(`ocr_sp_b_${sha256.slice(14, 20)}`, pb.id, locId!, 'SPOTTED_AT', 'SPOTTED AT (SIM)');
  addEdge(`ocr_sp_v_${sha256.slice(16, 22)}`, vehId!, locId!, 'SPOTTED_AT', 'SPOTTED AT (SIM)');

  return { nodes, edges, entities };
}

// ─── dispatcher ────────────────────────────────────────────────────

export function extractEntities(kind: EvidenceKind, text: string, filename: string, sha256: string, existingNodes: TraceXNode[], existingEdges: TraceXEdge[]): ExtractionResult {
  try {
    switch (kind) {
      case 'CDR_CSV': {
        const header = splitCsv(text)[0] ?? [];
        return looksLikeCdr(header) ? parseCdrCsv(text, existingNodes, existingEdges) : parseBankCsv(text, existingNodes);
      }
      case 'BANK_CSV':
        return parseBankCsv(text, existingNodes);
      case 'TEXT_NOTE':
        return extractFromText(text, filename, existingNodes);
      case 'FIR_PDF':
      default:
        return simulatePdfOcr(filename, sha256, existingNodes);
    }
  } catch {
    return { nodes: [], edges: [], entities: [] };
  }
}

// ─── real PDF text extraction (pure-JS, zlib + standard PDF operators) ─
// Returns the extracted body text, or null when the PDF is scanned /
// image-only (no text streams recoverable). Used by extractEntitiesAsync
// to decide whether to run the real NER pipeline or fall back to the
// OCR simulation.
//
// Algorithm: find every `stream...endstream` block, check if the
// preceding dict declares `/FlateDecode` (or no filter), inflate the
// raw bytes with `zlib.inflateSync`, then parse the decompressed
// content-stream operators for text-showing tokens: `(...)Tj`, `TJ`,
// `'`, and `"` (the four text-showing operators in the PDF spec). We
// ignore font remapping (we assume the document uses standard /
// non-embedded WinAnsiEncoding fonts), so the literal strings recovered
// from these operators are directly the human-readable text. This
// covers ~80% of real-world FIRs typed in Word/Google Docs and
// exported to PDF — which is exactly what an analyst uploads.

/** Pull a parenthesised string literal from content stream data, honouring
 *  PDF escape rules (\n, \t, \\, \), \(, \r, octal escapes) and balanced parens. */
function parsePdfLiteralString(data: Buffer, startIdx: number): { text: string; nextIdx: number } | null {
  if (startIdx >= data.length || data[startIdx] !== 0x28 /* ( */) return null;
  let out = '';
  let depth = 1;
  let i = startIdx + 1;
  while (i < data.length && depth > 0) {
    const b = data[i];
    if (b === 0x5c /* \ */) {
      const next = data[i + 1];
      if (next === 0x6e) { out += '\n'; i += 2; continue; }      // \n
      if (next === 0x72) { out += '\r'; i += 2; continue; }      // \r
      if (next === 0x74) { out += '\t'; i += 2; continue; }      // \t
      if (next === 0x62) { out += '\b'; i += 2; continue; }      // \b
      if (next === 0x66) { out += '\f'; i += 2; continue; }      // \f
      if (next === 0x28) { out += '('; i += 2; continue; }        // \(
      if (next === 0x29) { out += ')'; i += 2; continue; }        // \)
      if (next === 0x5c) { out += '\\'; i += 2; continue; }       // \\
      if (next >= 0x30 && next <= 0x37) {
        // octal escape: \DDD (1-3 octal digits)
        let oct = String.fromCharCode(next);
        let j = i + 2;
        let digits = 1;
        while (j < data.length && digits < 3 && data[j] >= 0x30 && data[j] <= 0x37) {
          oct += String.fromCharCode(data[j]);
          j++;
          digits++;
        }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff);
        i = j;
        continue;
      }
      // Unknown escape — drop the backslash
      i += 2;
      continue;
    }
    if (b === 0x0d || b === 0x0a) { i++; continue; } // line break inside string is ignored
    if (b === 0x28 /* ( */) { depth++; out += '('; i++; continue; }
    if (b === 0x29 /* ) */) { depth--; if (depth === 0) { i++; break; } out += ')'; i++; continue; }
    out += String.fromCharCode(b);
    i++;
  }
  return { text: out, nextIdx: i };
}

/** Decode a PDF hex string `<...>` to its literal bytes (Latin-1 chars). */
function parsePdfHexString(data: Buffer, startIdx: number): { text: string; nextIdx: number } | null {
  if (startIdx >= data.length || data[startIdx] !== 0x3c /* < */) return null;
  let hex = '';
  let i = startIdx + 1;
  while (i < data.length && data[i] !== 0x3e /* > */) {
    const c = data[i];
    if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66)) {
      hex += String.fromCharCode(c);
    }
    i++;
  }
  i++; // skip >
  let out = '';
  for (let k = 0; k + 1 < hex.length; k += 2) {
    out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
  }
  return { text: out, nextIdx: i };
}

/** Decode an ASCII85-encoded block (Adobe variant, terminated by ~>).
 *  Each 5-char group represents 4 binary bytes. */
function ascii85Decode(input: Buffer): Buffer {
  const chars: number[] = [];
  let sawTerminator = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === 0x7e /* ~ */) { sawTerminator = true; break; }
    if (c === 0x7a /* z */) {
      // "z" shortcut = 4 zero bytes (only valid in a complete group)
      chars.push(-1);
      continue;
    }
    if (c >= 0x21 && c <= 0x75 /* '!' to 'u' */) chars.push(c - 0x21);
    // whitespace chars are ignored
  }
  void sawTerminator;
  const out: number[] = [];
  let group: number[] = [];
  for (const c of chars) {
    if (c === -1) {
      // z must occupy a whole group of 4 zero bytes
      if (group.length === 0) out.push(0, 0, 0, 0);
      continue;
    }
    group.push(c);
    if (group.length === 5) {
      const n = group[0] * 85 ** 4 + group[1] * 85 ** 3 + group[2] * 85 ** 2 + group[3] * 85 + group[4];
      out.push((n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
      group = [];
    }
  }
  // Tail group of N chars (2≤N≤4) represents N-1 bytes — pad with 'u' (84).
  if (group.length >= 2 && group.length <= 4) {
    const originalLen = group.length;
    while (group.length < 5) group.push(84);
    const n = group[0] * 85 ** 4 + group[1] * 85 ** 3 + group[2] * 85 ** 2 + group[3] * 85 + group[4];
    const tail = [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    for (let k = 0; k < originalLen - 1; k++) out.push(tail[k]);
  }
  return Buffer.from(out);
}

/** Apply the chain of filters declared in a PDF stream dict. */
function applyPdfFilters(raw: Buffer, dictSlice: string): Buffer {
  // Detect filter chain — either `/Filter /Name` or `/Filter [/A /B ...]`.
  const filterMatch = dictSlice.match(/\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]*\])/);
  if (!filterMatch) return raw; // no filter — uncompressed stream
  let filterNames: string[];
  if (filterMatch[1].startsWith('[')) {
    filterNames = (filterMatch[1].match(/\/[A-Za-z0-9]+/g) ?? []).map((s) => s.slice(1));
  } else {
    filterNames = [filterMatch[1].slice(1)];
  }
  let current = raw;
  for (const f of filterNames) {
    try {
      if (f === 'FlateDecode' || f === 'Fl') {
        current = inflateSync(current);
      } else if (f === 'ASCII85Decode' || f === 'A85') {
        current = ascii85Decode(current);
      } else if (f === 'ASCIIHexDecode' || f === 'AHx') {
        const hex = current.toString('latin1').replace(/[^0-9a-fA-F]/g, '');
        current = Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex');
      } else {
        // Unknown filter (e.g. DCTDecode / JPXDecode = image; CCITTFaxDecode = scanned)
        // — we can't extract text from these. Return empty so the caller falls
        // back to the OCR simulation.
        return Buffer.alloc(0);
      }
    } catch {
      return Buffer.alloc(0);
    }
  }
  return current;
}

/** Find every `stream...endstream` block in the PDF and decode it. */
function extractAllStreamContents(buffer: Buffer): Buffer[] {
  const out: Buffer[] = [];
  const streamKw = Buffer.from('stream');
  const endKw = Buffer.from('endstream');
  let searchFrom = 0;
  while (true) {
    const s = buffer.indexOf(streamKw, searchFrom);
    if (s === -1) break;
    // The stream keyword may be followed by \r\n, \n, or \r
    let dataStart = s + streamKw.length;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) dataStart += 1;
    const e = buffer.indexOf(endKw, dataStart);
    if (e === -1) break;
    // Stream data ends just before the EOL preceding "endstream".
    let dataEnd = e;
    if (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d) dataEnd--;
    if (buffer[dataEnd - 1] === 0x0d && buffer[dataEnd] === 0x0a) dataEnd--;
    const raw = buffer.slice(dataStart, dataEnd);
    // Inspect the dict immediately preceding the stream keyword for the filter.
    const dictStart = Math.max(0, s - 400);
    const dictSlice = buffer.slice(dictStart, s).toString('latin1');
    const decoded = applyPdfFilters(raw, dictSlice);
    if (decoded.length > 0) out.push(decoded);
    searchFrom = e + endKw.length;
  }
  return out;
}

/** Walk every content stream and pull out the text shown by `Tj`, `TJ`, `'`, `"`. */
function extractTextFromStreams(streams: Buffer[]): string {
  const lines: string[] = [];
  for (const stream of streams) {
    let i = 0;
    const len = stream.length;
    while (i < len) {
      const b = stream[i];
      // Literal string "("
      if (b === 0x28) {
        const lit = parsePdfLiteralString(stream, i);
        if (lit) {
          // Peek ahead past whitespace for Tj / TJ / ' / " operators
          let j = lit.nextIdx;
          while (j < len && (stream[j] === 0x20 || stream[j] === 0x09 || stream[j] === 0x0a || stream[j] === 0x0d)) j++;
          let isTextOp = false;
          if (j + 1 < len) {
            const c1 = stream[j];
            const c2 = stream[j + 1];
            if (c1 === 0x54 /* T */ && (c2 === 0x6a /* j */ || c2 === 0x4a /* J */)) isTextOp = true;
            if (c1 === 0x27 /* ' */ || c1 === 0x22 /* " */) isTextOp = true;
          }
          if (isTextOp) {
            if (lit.text.trim().length > 0) lines.push(lit.text);
          }
          i = lit.nextIdx;
          continue;
        }
      }
      // Hex string "<"
      if (b === 0x3c) {
        // Make sure it's not "<<" (dict-open) which starts with 0x3c 0x3c
        if (stream[i + 1] === 0x3c) { i += 2; continue; }
        const hex = parsePdfHexString(stream, i);
        if (hex) {
          let j = hex.nextIdx;
          while (j < len && (stream[j] === 0x20 || stream[j] === 0x09 || stream[j] === 0x0a || stream[j] === 0x0d)) j++;
          let isTextOp = false;
          if (j + 1 < len) {
            const c1 = stream[j];
            const c2 = stream[j + 1];
            if (c1 === 0x54 && (c2 === 0x6a || c2 === 0x4a)) isTextOp = true;
            if (c1 === 0x27 || c1 === 0x22) isTextOp = true;
          }
          if (isTextOp) {
            if (hex.text.trim().length > 0) lines.push(hex.text);
          }
          i = hex.nextIdx;
          continue;
        }
      }
      i++;
    }
  }
  return lines.join('\n');
}

export function extractPdfText(buffer: Buffer): string | null {
  try {
    const streams = extractAllStreamContents(buffer);
    if (!streams.length) return null;
    const text = extractTextFromStreams(streams).replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
    // Threshold: fewer than 60 chars of text → almost certainly scanned.
    return text.length >= 60 ? text : null;
  } catch (err) {
    console.warn('[tracex] pdf text extraction failed, falling back to OCR simulation:', (err as Error).message);
    return null;
  }
}

// ─── async dispatcher (PDF path) ─────────────────────────────────
// For non-PDF kinds this just delegates to the synchronous extractEntities.
// For PDFs it first attempts real text extraction; if text is recovered,
// it routes through extractFromText (the same NER pipeline as TEXT_NOTE)
// so the analyst's actual FIR content populates the graph. Only when the
// PDF has no extractable text does it fall back to simulatePdfOcr.
//
// Kept async for the API-route signature so future real-OCR backends
// (Tika, Tesseract) can be slotted in without changing call sites.

export async function extractEntitiesAsync(
  kind: EvidenceKind,
  buffer: Buffer,
  text: string,
  filename: string,
  sha256: string,
  existingNodes: TraceXNode[],
  existingEdges: TraceXEdge[],
): Promise<ExtractionResult & { extractionMethod: 'REAL_TEXT' | 'OCR_SIM' | 'SYNC_DISPATCH' }> {
  if (kind === 'FIR_PDF') {
    const pdfText = extractPdfText(buffer);
    if (pdfText) {
      const result = extractFromText(pdfText, filename, existingNodes);
      return { ...result, extractionMethod: 'REAL_TEXT' };
    }
    const result = simulatePdfOcr(filename, sha256, existingNodes);
    return { ...result, extractionMethod: 'OCR_SIM' };
  }
  // Non-PDF kinds — synchronous path.
  const result = extractEntities(kind, text, filename, sha256, existingNodes, existingEdges);
  return { ...result, extractionMethod: 'SYNC_DISPATCH' };
}
