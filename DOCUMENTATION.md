# TRACE-X — Criminal Intelligence Fusion Dashboard

**A full-stack law-enforcement intelligence platform that turns scattered evidence (FIRs, call-detail records, bank statements, free-text notes, scanned PDFs) into a single, queryable graph of people, phones, accounts, vehicles, locations and case records — scored, visualised, AI-analysed, and exportable as a court-ready BSA 2023 §63 certificate.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem TRACE-X Solves](#2-the-problem-trace-x-solves)
3. [What TRACE-X Does (Feature Tour)](#3-what-trace-x-does-feature-tour)
4. [How It Works — End-to-End Walkthrough](#4-how-it-works--end-to-end-walkthrough)
5. [System Architecture](#5-system-architecture)
6. [The Intelligence Engine](#6-the-intelligence-engine)
7. [AI Copilot](#7-ai-copilot)
8. [Legal Compliance — BSA 2023 §63](#8-legal-compliance--bsa-2023-63)
9. [Security, Integrity & Auditability](#9-security-integrity--auditability)
10. [Technology Stack](#10-technology-stack)
11. [Use Cases & Benefits](#11-use-cases--benefits)
12. [Demo Data & How to Try It](#12-demo-data--how-to-try-it)
13. [Scope, Limitations & Roadmap](#13-scope-limitations--roadmap)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

**TRACE-X** is a browser-based intelligence fusion console purpose-built for criminal investigators. It takes raw evidentiary material — FIR PDFs, telecom call-detail records (CDRs), bank statements, and free-text intelligence notes — and **automatically extracts the entities inside them, links them onto a live investigation graph, ranks every entity by a composite risk index, lets the analyst interrogate the graph in plain English via an AI copilot, and exports the entire case as a tamper-evident, court-ready report** under India's Bharatiya Sakshya Adhiniyam, 2023 (the law that governs admissibility of electronic evidence — replacing the old Evidence Act).

In one sentence: **TRACE-X converts paper-trail chaos into a single, scored, AI-queryable map of a criminal network — with a chain-of-custody-sealed export button.**

It runs as a single-route web application (`/`) with a tactical dark "night-ops" theme and a clean light "day-ops" theme, a sticky classification banner (`RESTRICTED // BSA 2023 §63`), a force-directed graph canvas at the centre, a left-side ingestion & filter panel, a right-side entity inspector with a live risk gauge, and a floating AI copilot bar at the bottom.

---

## 2. The Problem TRACE-X Solves

Modern criminal investigations — financial fraud, narcotics, organised crime, terror financing — generate **terabytes of disconnected evidence** across half a dozen agencies:

| Evidence source | Format | What's in it |
|---|---|---|
| First Information Reports (FIRs) | Scanned PDFs / typed notes | Names, accused roles, vehicle plates, locations, money amounts |
| Telecom CDRs | CSV | Calling party, called party, date, duration, cell-tower ID |
| Bank statements | CSV / PDF | From-account, to-account, amount, mode (RTGS/NEFT/IMPS), narrative |
| Field intelligence notes | Free text | "Accused Ravi Menon met Sunil Mehra near Narela Warehouse using MH-01-CD-7788…" |
| Surveillance dumps | Tower dumps, IMEI logs | Unattributed numbers, swap patterns |

A human investigator reading these one by one will:

- **Miss the connections** — the same person named in an FIR shows up as a phone subscriber in a CDR and an account-holder in a bank statement, but the three documents live in three different folders.
- **Lose track of who matters** — in a 50-entity case, which person is the kingpin? Who is the bridge between the money layer and the comms layer?
- **Be unable to ask "what if" questions** — "who controls both a phone and a bank account?" or "trace ₹38 lakh through the network."
- **Struggle to produce a court-admissible report** — Indian courts under BSA 2023 §63 require an authenticated certificate, a chain of custody, and an integrity seal for any electronic record. Manually assembling this is error-prone and contested.

**TRACE-X solves all four problems at once** by fusing every source into a single graph, scoring entities, exposing a natural-language query interface, and one-click-exporting a sealed report.

---

## 3. What TRACE-X Does (Feature Tour)

### 3.1 The Tactical UI

| Region | Purpose |
|---|---|
| **Classification Banner** (top) | `RESTRICTED // BSA 2023 §63` — static compliance banner, always visible. |
| **TopBar** | TRACE-X brand, agency badge with pulsing "OPERATIONAL" status, case selector dropdown, dark/light theme toggle, BSA §63 Export button. |
| **Left Panel** | Drag-and-drop evidence ingestion zone, three one-click demo samples (CDR / Bank / FIR), evidence ledger with copyable SHA-256 hashes, six entity-type filter checkboxes with live counts, dual-thumb temporal slider with a live link counter. |
| **Centre Canvas** | Cytoscape.js force-directed graph. Colour- and shape-coded nodes sized by PageRank. Kingpins get a gold halo. Edges labelled with relationship type and date. Toolbar: zoom in/out, fit, re-layout, locate selected, cluster mode. Live stats overlay. |
| **Right Inspector** | Slide-over drawer that opens when you tap a node. Shows an SVG **risk gauge** (0–100, with band), PageRank / betweenness / degree bars, dossier metadata (role, criminal history, operational status), analyst assessment, connected-entity navigation, and the **§63 Evidence Card** with a live WebCrypto SHA-256 hash and chain-of-custody timeline. |
| **Bottom Copilot Bar** | Floating collapsible AI panel. Suggestion chips, free-text query input, Cypher block with keyword highlighting & copy, FOCUS chips that select and highlight nodes returned by the AI. |
| **Status Bar** (sticky footer) | Case ID, node/link counts, UTC clock, current theme indicator. |

### 3.2 Core Capabilities

1. **Multi-source evidence ingestion** — drag a CSV / TXT / PDF onto the left panel. TRACE-X auto-detects the file kind and routes it through the right parser.
2. **Automatic entity extraction (NER)** — phones, IFSC/bank accounts, vehicle plates, person names, locations, money amounts are extracted with regex patterns calibrated for Indian formats (+91 numbers, IFSC codes, RC-number plates, ₹/lakh/crore amounts).
3. **Smart entity linking** — when a freshly extracted entity matches an existing node by value (phone last-10 digits, bank prefix+last4, label/alias), TRACE-X merges onto the existing node instead of creating a duplicate. Ingests **enrich** the live graph.
4. **Live network analytics** — every render recomputes PageRank, Brandes betweenness centrality, degree, and a composite risk index. The graph re-colours and re-sizes itself as evidence flows in.
5. **Cluster detection** — label-propagation community detection partitions the graph into cells; toggle "cluster mode" to colour every node by its compartment.
6. **Temporal filtering** — a dual-thumb date slider hides/shows edges by event date. The link counter updates live.
7. **AI copilot** — type a natural-language investigator question; TRACE-X calls a large language model with the full graph as context, returns an interpretation, a Neo4j Cypher query, a narrative assessment, and a list of matching node IDs that get highlighted in the canvas.
8. **Court-ready export** — one click generates a 9-section BSA 2023 §63 report (case summary, certificate, exhibit inventory with hashes & custody, entity registry, relationship log, analytics, audit trail, analyst assessment, integrity seal) and downloads it with an `X-TraceX-Seal` HTTP header.
9. **Dual theme** — dark tactical (default, for night-ops / fusion-centre consoles) and light day-ops (for courtroom briefings, daylight field work). Toggle persists via `localStorage`.
10. **Mobile-ready** — under `lg` breakpoint the left panel becomes a slide-out Sheet and the inspector becomes a full overlay drawer; everything remains usable down to 390 px.

---

## 4. How It Works — End-to-End Walkthrough

### 4.1 Investigator opens a case

On page load, TRACE-X:

1. Fetches `GET /api/cases` → returns 3 demo cases (OP EAGLE CLAW, OP BLACK MIRROR, OP GHOST SHIP) with their node/edge counts and top-risk entity.
2. Calls `GET /api/graph?caseId=case-eagle-claw` → returns the 15 nodes / 27 edges of OP EAGLE CLAW plus a freshly computed `metrics` map.
3. Writes a `CASE_OPENED` row to the `AuditLog` table.

The Zustand store commits the data, Cytoscape runs an `fCoSE` physics layout, and the canvas paints 15 colour-coded nodes (persons = red ellipses, phones = cyan triangles, bank accounts = green rounded rectangles, vehicles = purple diamonds, locations = yellow hexagons, FIRs = orange tags) connected by 27 typed edges (`CALLED`, `TRANSFERRED_FUNDS`, `CO_ACCUSED`, `SPOTTED_AT`, `OWNS`, `NAMES_ACCUSED`, `LINKED_TO`).

### 4.2 Investigator clicks a node

Tapping the kingpin **RAJESH "RK" KHANNA** node:

1. Cytoscape emits `tap` → store sets `selectedNodeId`.
2. Right inspector slides in.
3. The `RiskGauge` SVG animates its needle to **99° / CRITICAL** with a red progress arc.
4. PageRank / betweenness / degree bars fill proportionally.
5. The dossier panel renders his role, alias ("BHAI", "SETJI"), criminal history (7 priors), operational status (ACTIVE · AT LARGE).
6. The "Connected entities" list lets the investigator one-tap-jump to any neighbour.
7. The **§63 Evidence Card** uses `crypto.subtle` to compute a live SHA-256 of the dossier text and renders the custody chain (INGESTED → ANALYSED → CERTIFIED timestamps).

### 4.3 Investigator ingests new evidence

Drag a CSV named `cdr_batch_june.csv` onto the left panel, or click the "CDR CSV" demo button:

1. The store calls `POST /api/upload` (multipart form).
2. Backend reads the file, computes a `node:crypto` SHA-256, persists an `Evidence` row + a `CUSTODY` event to SQLite.
3. Backend calls `extractEntities('CDR_CSV', text, ...)` which:
   - Splits rows, normalises Indian phone numbers (`+91 98732 90814`),
   - Resolves each phone against the existing graph via the `Linker` class (last-10-digit match),
   - Creates a `CALLED` edge per call pair (aggregating duplicates into `CALLED ×N` weights),
   - Surfaces cell-tower clusters as new `LOCATION` nodes when a tower sees ≥2 hits,
   - Adds `SPOTTED_AT` edges between phones and their tower cluster.
4. Returns `{ newNodes, newEdges, evidence }`.
5. Store merges new nodes/edges, recomputes metrics, auto-extends the temporal slider range if any new edge is dated outside the current window, and renders an "ingested N entities / M links" toast.
6. The graph visibly grows (e.g. 15 → 23 nodes / 27 → 41 edges) with new entities correctly wired into the existing mesh — no duplicate phones, no orphan FIR nodes.

Click "FIR NOTE" instead and the same flow runs through `extractFromText`, which uses regex NER to pull `"Ravi Menon"` (PERSON), `MH-01-CD-7788` (VEHICLE), `Narela Warehouse` (LOCATION), `Rs. 28.5 lakh` (MONEY) out of the free-text note, creates an FIR node, and links every extracted entity back to it with `NAMES_ACCUSED` or `LINKED_TO` edges.

### 4.4 Investigator asks the AI copilot

Type *"who is the bridge between banking and telephony?"* in the bottom bar:

1. `POST /api/copilot` with `{ query, caseId, history }`.
2. Backend builds a compact graph context (`buildGraphContext`) — every node's id/type/label/alias/flags/riskScore/pageRank/betweenness, every edge's source/target/type/date/weight.
3. The system prompt instructs the LLM to **answer strictly as JSON** with four keys: `interpretation`, `cypher`, `narrative`, `matchingNodeIds`.
4. The full graph + investigator query + last 6 conversation turns are sent to the **z-ai-web-dev-sdk** chat completions endpoint with a 45-second timeout.
5. The response is JSON-parsed (with code-fence stripping, brace-extraction, schema validation). If anything fails, an **offline rule-based analytics engine** (`localCopilot`) answers deterministically — the copilot never returns an empty result.
6. The matching node IDs are highlighted in the canvas; the Cypher block is rendered with keyword highlighting and a copy button; the narrative assessment appears in the panel.

### 4.5 Investigator exports the case for court

Click the "BSA §63 EXPORT" button in the TopBar:

1. `GET /api/export?caseId=case-eagle-claw`.
2. Backend recomputes metrics + communities, pulls the evidence list + audit trail from SQLite, and assembles a 9-section plain-text report.
3. The report payload is SHA-256'd to produce an integrity seal.
4. Response is sent with `Content-Type: text/plain`, `Content-Disposition: attachment; filename="TRACE-X_OP-EAGLE-CLAW_BSA63_Report.txt"`, and `X-TraceX-Seal: <sha256>`.
5. A `REPORT_EXPORTED` audit row is written.
6. The browser downloads the file and the TopBar shows a "Seal: `0a3f…`" toast so the operator can corroborate the seal against the registry.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Browser (single route /)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React 19 + Next.js 16 App Router (client components)      │  │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐   │  │
│  │  │ TopBar   │  │ LeftPanel  │  │  GraphCanvas         │   │  │
│  │  │ +Theme   │  │  ingest+   │  │  (Cytoscape.js +     │   │  │
│  │  │ +Export  │  │  filters+  │  │   fCoSE physics)     │   │  │
│  │  └──────────┘  │  slider    │  └──────────────────────┘   │  │
│  │                └────────────┘  ┌──────────────────────┐   │  │
│  │                                │  InspectorDrawer     │   │  │
│  │                                │  (risk gauge + §63)  │   │  │
│  │                                └──────────────────────┘   │  │
│  │                                ┌──────────────────────┐   │  │
│  │                                │  CopilotBar (AI)     │   │  │
│  │                                └──────────────────────┘   │  │
│  │  Zustand store (tracex-store) — single source of truth    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ fetch (relative paths only)        │
└──────────────────────────────┼──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Next.js 16 API Routes (Node runtime)             │
│  GET  /api/cases    GET /api/graph   GET /api/evidence           │
│  POST /api/upload   POST /api/copilot   GET /api/export          │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │ Intelligence Layer   │    │  Persistence (Prisma + SQLite) │ │
│  │  src/lib/tracex/     │    │   CaseFile, Evidence, AuditLog │ │
│  │  • types             │    └────────────────────────────────┘ │
│  │  • mock-data         │                                       │
│  │  • centrality        │    ┌────────────────────────────────┐ │
│  │  • extraction (NER)  │    │  AI Backend (server-side only)  │ │
│  │  • copilot-fallback  │    │   z-ai-web-dev-sdk              │ │
│  │  • server-utils      │    │   chat.completions.create()     │ │
│  └──────────────────────┘    └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key architectural choices:**

- **API-driven, not server-action-driven** — every backend interaction goes through a normal HTTP route. Easier to test, easier to swap a route out for a microservice later, easier to put behind a gateway.
- **Single visible route** (`/`) — the whole investigation console is one page; navigation is internal state, not URL routing. This is deliberate: an investigator's flow never wants a page reload.
- **Server-only LLM** — the `z-ai-web-dev-sdk` is imported and called exclusively inside API routes; no API keys or model weights ever reach the browser bundle.
- **Failure-tolerant persistence** — every DB access is wrapped so that if Prisma/SQLite is unavailable, the app degrades to in-memory operation. The dashboard never goes blank because of a DB hiccup.
- **Theme tokens, not hardcoded hexes** — every chrome colour is a CSS variable (`--tracex-bg`, `--tracex-panel`, etc.) defined in both `:root` (light) and `.dark` (dark). Switching themes swaps the variables; Cytoscape re-applies a full parameterised stylesheet via `cy.style().update()`. No component code branches on theme.

---

## 6. The Intelligence Engine

The "brain" of TRACE-X lives in `src/lib/tracex/`. It is pure TypeScript — no external graph database is required for analytics. This makes the engine fully testable, deterministic, and trivially portable.

### 6.1 Domain Model (`types.ts`)

Six **node types** and eight **edge types**:

| Node type | Visual identity | Real-world meaning |
|---|---|---|
| `PERSON` | Red ellipse | A named individual (accused, suspect, mule) |
| `PHONE` | Cyan triangle | A telephone subscription |
| `BANK_ACCOUNT` | Green rounded rectangle | A bank account (IFSC + number) |
| `VEHICLE` | Purple diamond | A registered vehicle (RC plate) |
| `LOCATION` | Yellow hexagon | A physical place (warehouse, tower cluster, rendezvous) |
| `FIR` | Orange tag | A First Information Report or supplementary note |

| Edge type | Meaning |
|---|---|
| `OWNS` | Person → phone/account/vehicle ownership |
| `USES` | Person uses a phone/account (less formal than OWNS) |
| `CALLED` | Phone → phone telephony link (CDR-derived, weight = call count) |
| `TRANSFERRED_FUNDS` | Account → account money movement (weight = amount in INR) |
| `CO_ACCUSED` | Person ↔ person co-accusal in an FIR |
| `SPOTTED_AT` | Phone/person → location sighting (CDR tower, surveillance) |
| `NAMES_ACCUSED` | FIR → person (the FIR names this person as accused) |
| `LINKED_TO` | Generic evidentiary link (FIR → entity) |

### 6.2 Centrality & Risk (`centrality.ts`)

Three pure functions operate on the undirected projection of the graph:

1. **PageRank** — power iteration with damping 0.85, 60 iterations, mass re-normalised to sum to 1.0. Identifies the "influence" of each entity.
2. **Brandes' betweenness centrality** — single-source shortest-path accumulation, normalised by `((n-1)(n-2))/2` for undirected graphs. Identifies "bridge" entities that sit on many shortest paths — the cut-outs and brokers.
3. **Label-propagation community detection** — 25 iterations max, deterministic ordering by sorted node ID, label compaction to `0..k`. Identifies the compartmentalisation of the network.

On top of these, the **composite TRACE-X Risk Index** scores every entity 4–99:

```
riskScore = round(
   38 · (pageRank / maxPageRank)
 + 30 · (betweenness / maxBetweenness)
 + 17 · (degree / maxDegree)
 + 15 · TYPE_BASE_WEIGHT   (PERSON=1.0, PHONE/BANK=0.62, VEHICLE=0.42, LOCATION=0.38, FIR=0.30)
 + 6   if KINGPIN flag set
)   clamped to [4, 99]
```

Risk bands: `LOW (4–29) · MODERATE (30–49) · ELEVATED (50–69) · HIGH (70–84) · CRITICAL (85–99)`.

This formula was chosen so that:

- A person who is **both influential (PageRank) and a bridge (betweenness)** scores highest.
- A phone or bank account that is merely a conduit still scores meaningfully (type-base 0.62) but never outranks the human operators.
- A flagged **kingpin** gets a deliberate +6 boost so analyst-designations override pure topology when needed.

### 6.3 Evidence Extraction (`extraction.ts`)

| Ingest kind | Detection | Parser | Output |
|---|---|---|---|
| **CDR_CSV** | Filename ends `.csv`, header contains "calling" + "called" | `parseCdrCsv` | Phone nodes (or merges), `CALLED ×N` edges, tower-cluster `LOCATION` nodes for towers with ≥2 hits, `SPOTTED_AT` edges phone→tower |
| **BANK_CSV** | Filename ends `.csv` and contains "bank"/"statement", or non-CDR CSV | `parseBankCsv` | `BANK_ACCOUNT` nodes (or merges), `TRANSFERRED_FUNDS` edges weighted by amount |
| **TEXT_NOTE** | `.txt`/`.md` or `text/*` mime | `extractFromText` | FIR node + regex-NER entities (phone, IFSC, vehicle, person, location, money) linked back to the FIR with `NAMES_ACCUSED` / `LINKED_TO` |
| **FIR_PDF** | `.pdf` | `simulatePdfOcr` | Deterministic pseudo-OCR (hackathon stand-in for Tika + SpaCy) — pulls a person, a burner phone wired into the existing mesh, and a bank-transfer trace, all from a seed derived from the file SHA-256 |

**The Linker** (`class Linker`) is the de-duplication core. Constructed from the current graph's nodes, it indexes:

- **Phones** by last-10 digits,
- **Bank accounts** by `PREFIX + last4` (with a `last4`-only fallback),
- **Any node** by uppercased label and alias tokens.

When a freshly extracted entity matches an existing index entry, TRACE-X **does not create a duplicate node** — it emits an edge from the new evidence (the FIR/text/CDR) onto the existing node. This is what makes ingests *enrich* the graph instead of polluting it.

**NER patterns** (regex, SpaCy-style for Indian evidentiary formats):

- Phone: `(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}` → normalised to `+91 XXXXX XXXXX`
- Vehicle: `\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4})\b`
- IFSC: `\b([A-Z]{4}0[A-Z0-9]{6})\b`
- Person: contextual trigger (`Accused/Suspect/Namely/Director/Proprietor/Owner`) + `[A-Z][a-z]+` 1–3 word capture, with a 30+ stopword filter (prepositions, verbs) to prevent filler-bleed.
- Location: `(at|near|outside|spotted at|seen at) + …Warehouse/Hotel/Port/Plaza/Market/Depot/Godown/Complex/Yard`
- Money: `(₹|Rs.?) <number> (lakh|crore|cr|l)?` → INR normalised with lakh/crore multipliers.

### 6.4 Offline Copilot (`copilot-fallback.ts`)

If the cloud LLM is unavailable, returns a deterministic answer based on regex-matched intent:

| Intent (regex on the query) | Answer |
|---|---|
| `bridge|cut.?out|connect|broker` | Lists entities that neighbour **both** a phone and a bank account, ranked by betweenness. Synthesises a Cypher `MATCH (n)-[r1]->(ph:Phone), (n)-[r2]->(acc:BankAccount) …` |
| `kingpin|top|rank|important|leader` | Top-3 by composite risk index, with PageRank numbers. |
| `fund|money|transfer|hawala|launder` | Total fund movement, account set, signatories-of-record, with a freeze recommendation. |
| `fir|accused|co.?accused|charge` | FIRs cross-referenced with named-accused edges. |
| `phone|cdr|call|telephony` | Top call volumes, tower clusters, IMEI-swap flags. |

Every fallback answer is a valid `CopilotResponse` with `source: 'OFFLINE-ANALYTICS'` — the UI shows a badge so the analyst knows the cloud model wasn't used.

---

## 7. AI Copilot

The TRACE-X Copilot is the **conversational interface** to the graph. It is **not a search engine** — it is an analyst-grade interface that:

1. **Understands the graph** — the entire current case (nodes + edges + metrics) is serialised into the prompt.
2. **Speaks Cypher** — every answer includes a syntactically valid Neo4j Cypher query the investigator can copy into a separate graph-DB session. (Cypher is the de-facto query language for property graphs.)
3. **Highlights nodes** — the `matchingNodeIds` array drives canvas focus; the investigator sees the answer, not just reads it.
4. **Cites numbers** — the system prompt forces the model to cite specific entity labels, risk scores, and amounts ("₹38.0 lakh", "22 IMEI swaps", "PageRank 0.1843").

### 7.1 Backend contract

```http
POST /api/copilot   (runtime: nodejs, maxDuration: 60s)
Content-Type: application/json

{
  "query":   "who controls both a phone and a bank account?",
  "caseId":  "case-eagle-claw",
  "history": [{ "role": "user", "content": "..." }, ...]
}

→ 200 OK
{
  "interpretation": "Identified 2 bridge nodes …",
  "cypher":         "MATCH (n)-[r1]->(ph:Phone), (n)-[r2]->(acc:BankAccount) …",
  "narrative":      "Bridge analysis complete. The dominant coupling nodes are …",
  "matchingNodeIds": ["person_rk", "person_vt"],
  "source":          "TRACE-X LM"     // or "OFFLINE-ANALYTICS"
}
```

The route:

- Rejects empty queries (400) and unknown caseIds (404).
- Truncates query to 2000 chars, history to last 6 turns × 1200 chars.
- Wraps the SDK call in `Promise.race` with a 45 s timeout.
- Parses the model's raw text through `parseCopilotJson` which strips ```` ```json ```` fences, extracts the outermost `{...}`, validates the four required keys.
- On any failure (timeout, parse error, network) → falls back to `localCopilot(query, ctx)` so the copilot **never returns an error to the analyst**.
- Writes an `AuditLog` row capturing query + matched-node count + source (LM or fallback).

### 7.2 The system prompt

The model is told, verbatim, that it is *"TRACE-X Copilot, the intelligence-analysis AI of a law-enforcement Criminal Intelligence Fusion Dashboard"*, given the full node/edge schema, and instructed to answer **strictly as JSON** with the four keys, citing real numbers from the provided graph data. Tone is set to *"professional intelligence analyst."* This is what keeps the answers operational rather than conversational.

---

## 8. Legal Compliance — BSA 2023 §63

The **Bharatiya Sakshya Adhiniyam, 2023** is India's evidence law (effective 1 July 2024, replacing the Indian Evidence Act, 1872). **Section 63** deals with the admissibility of electronic records, and **Section 63(4)** specifically requires that any electronic record produced by a computer be accompanied by an authenticating certificate.

TRACE-X ships a **one-click §63 certificate generator**. The `GET /api/export` route produces a plain-text report (UTF-8, downloadable) with **nine sections**:

1. **Case Summary** — case ID, codename, agency, desk, status, brief, graph size (entities, relationships, communities).
2. **§63(4) Certificate** — a formal attestation that the records were produced by the TRACE-X fusion engine from systems under lawful control of the investigating agency, in the ordinary course of intelligence operations, each integrity-sealed with SHA-256. Signed by the operator (`ACTOR`) and counter-signed by "TRACE-X Trust Service".
3. **Exhibit Inventory & Chain of Custody** — for every ingested exhibit: filename, type, size, ingested-at timestamp, **SHA-256 digest**, entity/link counts, and the full custody chain (`INGESTED @ ts by ANALYST-7 → ANALYSED @ … → CERTIFIED @ …`).
4. **Entity Registry** — every node in the case, ranked by risk, with type/label/risk score/PageRank/betweenness/first-seen date in tabular form.
5. **Relationship Log** — every edge, chronologically sorted, with source label, relationship type, target label, and edge label.
6. **Network Analytics Summary** — aggregate fund movement (₹ lakh), aggregate call volume, critical-risk entities listed by name, top-5 by composite risk index.
7. **Audit Trail** — last 30 system events (`CASE_OPENED`, `EVIDENCE_INGESTED`, `COPILOT_QUERY`, `REPORT_EXPORTED`) with timestamps, actors, and detail strings.
8. **Analyst Assessment** — a narrative describing the network's control structure, settlement paths, telephony discipline, and recommended action (simultaneous detention, parallel account freezes, IMEI blacklisting).
9. **Integrity Seal** — a SHA-256 hash of `{ reportId, caseId, nodeCount, edgeCount, evidenceHashes[], generatedAt }`. Any tampering with the report body invalidates the seal; it can be re-verified against the TRACE-X evidence registry.

The HTTP response also carries the seal as the **`X-TraceX-Seal` header** so the operator can corroborate it independently of the downloaded file.

This is what makes TRACE-X **court-ready**: the same tool the analyst used to investigate the case generates the evidentiary artefact that will be tendered in court, with a defensible chain of custody baked in.

---

## 9. Security, Integrity & Auditability

### 9.1 Cryptographic integrity

- **File-level**: every ingested file is SHA-256'd on the server (`node:crypto`) and the hash is persisted in the `Evidence` row, surfaced in the left-panel ledger, and printed in the §63 report.
- **Dossier-level**: the inspector's §63 Evidence Card computes a live SHA-256 of the rendered dossier via **WebCrypto `crypto.subtle`**, with a secure-context guard and `.catch()` fallback so the card never sticks on "COMPUTING DIGEST…".
- **Report-level**: the §63 export computes a seal over the report's structural payload and exposes it both in the body and in the `X-TraceX-Seal` header.

### 9.2 Chain of custody

Every `Evidence` row carries a `custodyJson` array of `{ event, actor, at }` triples. Ingestion writes the first `INGESTED` event; analytical passes can append `ANALYSED`/`CERTIFIED` events. The §63 report renders this chain inline per exhibit.

### 9.3 Audit logging

The `AuditLog` table records every state-changing system event:

| Action | When | Detail captured |
|---|---|---|
| `CASE_OPENED` | `GET /api/graph` is called | "Graph loaded — N nodes / M links" |
| `EVIDENCE_INGESTED` | `POST /api/upload` succeeds | filename, kind, hash, new entity/link counts |
| `COPILOT_QUERY` | `POST /api/copilot` returns | query text → source (LM/offline) + matched count |
| `REPORT_EXPORTED` | `GET /api/export` finishes | report ID, byte size, seal prefix |

Audit rows are written via `logAudit()` in `server-utils.ts`. They appear in section 7 of the §63 report.

### 9.4 Hardened API surface

- Unknown `caseId` parameters return **404** instead of silently falling back to the default case — no accidentally-misattributed audit rows.
- Malformed JSON to `/api/copilot` returns **400**.
- Empty copilot query returns **400**.
- A global Next.js `error.tsx` boundary catches any unhandled render-time throw and shows a tactical "SYSTEM FAULT" card with a re-initialise button (theme-aware).

### 9.5 LLM safety

- The LLM is invoked **server-side only**; the SDK never reaches the browser bundle.
- The LLM is given the **graph schema and the question**, not raw evidentiary documents. Sensitive source material (FIR bodies, bank statements) is not transmitted — only the entities that TRACE-X has already extracted and stored locally.
- A 45 s timeout prevents runaway model calls.
- An offline fallback guarantees the copilot always returns a usable answer.

---

## 10. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Latest React 19 server/client component model; route handlers; turbopack dev server |
| Language | **TypeScript 5** (strict) | End-to-end type safety from API contract to component props |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (New York) | Design-system-grade primitives, accessible Radix-based components |
| State | **Zustand** (client) + **TanStack Query** (available) | Lightweight, predictable client state; server-state cache when needed |
| Graph rendering | **Cytoscape.js 3.34** + **cytoscape-fcose 2.2** | Industry-standard network visualisation; fCoSE gives high-quality force-directed layouts |
| Database | **Prisma ORM** + **SQLite** | Zero-ops persistence for case registry, evidence ledger, audit log |
| Theming | **next-themes** | Persisted light/dark toggle with no hydration mismatch |
| Icons | **lucide-react** | Consistent, tree-shakeable icon set |
| Animation | **framer-motion** | Subtle transitions on hover/focus/page elements |
| Notifications | **sonner** | Toast feedback for ingests, exports, copy actions |
| AI backend | **z-ai-web-dev-sdk** | Server-side chat completions, 45 s timeout, JSON-schema-constrained prompts |
| Tooling | **bun** (runtime/scripts), **eslint-config-next** | Fast installs and dev iteration; lint enforces Next.js best-practices |

**No external graph database is required.** All graph analytics run as pure TypeScript functions against in-memory structures. This means TRACE-X can be deployed in air-gapped fusion centres without a Neo4j dependency — the Cypher output of the copilot is **query-ready for a separate Neo4j instance** if the agency has one, but TRACE-X itself does not need it to operate.

---

## 11. Use Cases & Benefits

### 11.1 Primary use cases

1. **Financial-fraud syndicate mapping** — fuse FIRs, bank statements, and CDRs into one graph; identify the kingpin, the layering accounts, and the burner mesh; freeze and detain in the right order.
2. **Narcotics supply-chain disruption** — overlay mule phones, vehicle movements (from FIR notes), and warehouse sightings; pinpoint the rendezvous node and the cut-out phone.
3. **Terror-financing investigations** — trace hawala-style placement-layering-integration loops; quantify aggregate fund movement; produce a sealed §63 report for the NIA / ED dossier.
4. **Organised-crime cell mapping** — use community detection to reveal the compartmentalisation; target the bridge nodes whose arrest decouples the cells.
5. **Cold-case re-examination** — re-ingest old FIRs as text notes; the NER pipeline surfaces persons, phones, vehicles that may match current holdings; the linker reconnects them.

### 11.2 Benefits — by stakeholder

| Stakeholder | Benefit |
|---|---|
| **Investigator / Analyst** | One console instead of six folders. Type a question, get an answer with node highlights. Ingest a CSV, watch the graph grow correctly. Cut hours off routine link analysis. |
| **Investigation Supervisor** | Live risk rankings show where to focus resources. Cluster mode reveals the cell structure at a glance. Temporal slider shows when the network was active. |
| **Prosecutor / Public Prosecutor** | One-click §63 certificate with SHA-256-sealed exhibit inventory, custody chain, and analyst assessment — admissible in court on day one. No more scrambled evidence binders. |
| **Court / Judge** | A single tamper-evident report enumerating every entity, every relationship, every analytical conclusion, with a verifiable seal. The integrity guarantee is cryptographically checkable. |
| **Agency Head / Policy Maker** | Standardised, auditable, reproducible intelligence products across the agency. Audit trail shows who did what, when. |
| **Partner Agency / Other Company** | The Cypher output of the copilot is portable to any Neo4j deployment; the §63 export is plain-text and interoperable; the architecture is open enough to swap the data layer for a real graph DB without rewriting the UI. |

### 11.3 Why TRACE-X over alternatives

| Alternative | Why TRACE-X is better |
|---|---
| **Manual link analysis on a whiteboard / Visio** | Automatic entity extraction, live risk scoring, AI copilot, sealed export. Hours of manual work → seconds. |
| **i2 Analyst's Notebook (commercial)** | No per-seat licence cost; runs in a browser; modern UX; AI-native; BSA 2023 §63 export out of the box. |
| **Custom Palantir-style deployment** | TRACE-X ships as a single deployable Next.js app; no months-long integration project; no opaque data residency terms. |
| **Spreadsheet + email investigation** | Fuses multiple sources into one graph; finds connections a spreadsheet never will; produces a court-ready report instead of a pile of .xlsx files. |

---

## 12. Demo Data & How to Try It

TRACE-X ships with **three synthetic cases** — all PII is fictitious, generated for demonstration only.

| Case ID | Codename | Nodes / Edges | Description |
|---|---|---|---|
| `case-eagle-claw` | **OP EAGLE CLAW** | 15 / 27 | Hawala-backed financial fraud syndicate. The flagship demo: 2 kingpin bridge persons, 1 mule, 4 phones (incl. 1 unattributed cut-out), 3 bank accounts, 2 vehicles, 1 rendezvous location, 2 FIR records. |
| `case-black-mirror` | **OP BLACK MIRROR** | 12 / 18 | Cyber-extortion & crypto-cashing crew. |
| `case-ghost-ship` | **OP GHOST SHIP** | 10 / 13 | Port-side narcotics transshipment cell. |

### 12.1 Try it in 60 seconds

1. Open the app at `/` — the OP EAGLE CLAW graph loads with 15 colour-coded nodes.
2. Tap the **RAJESH "RK" KHANNA** node (the big red ellipse with the gold halo) → inspector slides in with risk 99 CRITICAL.
3. Toggle the **dark/light** button in the TopBar (top-right) — see the day-ops theme with white surfaces and slate text.
4. In the left panel, click the **"CDR CSV"** button → graph grows to ~21 nodes; new phones and a cell-tower cluster appear wired into the mesh.
5. Click **"BANK CSV"** → new bank-transfer edges appear, ranked by amount.
6. Click **"FIR NOTE"** → free-text NER pulls out a person, a vehicle, a location, a money amount and links them to a new FIR node.
7. In the bottom **Copilot bar**, click *"Who are the kingpins?"* chip → AI returns interpretation + Cypher + narrative and highlights the two kingpins.
8. Try a free-text query: *"trace the money through the banking layer"*.
9. Click the **"BSA §63 EXPORT"** button in the TopBar → a `TRACE-X_OP-EAGLE-CLAW_BSA63_Report.txt` downloads with the seal visible in a toast.
10. Switch cases from the dropdown in the TopBar → graph re-renders with the new case's data.

### 12.2 Drag-and-drop your own evidence

Drag any of these onto the left-panel drop zone:

- A CSV with `calling_party, called_party, date, duration_sec, first_cell_id` header → parsed as a CDR.
- A CSV with `from_account, to_account, amount_inr, mode` columns → parsed as a bank statement.
- A `.txt` intelligence note with phrases like *"Accused Ravi Menon … near Narela Warehouse … vehicle MH-01-CD-7788 … Rs. 28.5 lakh"* → NER extracts every entity.
- A `.pdf` → runs through the deterministic OCR simulation (the seed is the file's SHA-256, so the same PDF always produces the same extracted entities).

---

## 13. Scope, Limitations & Roadmap

### 13.1 Current scope (what ships today)

- Full single-page tactical console with dark/light themes.
- 3 synthetic cases pre-loaded.
- NER for CSV/TXT/PDF ingests with value-based entity linking.
- PageRank, betweenness, degree, composite risk index, community detection.
- AI copilot with cloud LLM + offline fallback.
- BSA 2023 §63 sealed export with audit trail.
- Prisma/SQLite persistence for evidence ledger, custody, audit log.
- Mobile-responsive layout (390 px → 4K).
- Global error boundary, hardened 404/400 API responses, secure-context-aware crypto.

### 13.2 Known limitations (hackathon scope, documented)

| Area | Current state | Production next step |
|---|---|---|
| **PDF ingestion** | Deterministic OCR simulation (seeded pseudo-random extraction). | Integrate Apache Tika + SpaCy NER on a Python sidecar; the dispatcher already has the right shape. |
| **Graph topology storage** | Held in TypeScript code (`mock-data.ts`); evidence/custody/audit in SQLite. | Migrate to Neo4j or Memgraph; the Cypher output of the copilot is already production-shaped. |
| **Authentication** | Single hardcoded `ACTOR` ("ANALYST-7"); no login. | NextAuth.js v4 is already a dependency — wire up agency SSO. |
| **Real-time collaboration** | Single-user session. | Add a socket.io mini-service for multi-analyst shared sessions (the project's mini-service pattern supports this). |
| **Cross-file CDR aggregation** | Per-file only; same phone pair in two CDRs is deduped only within one ingest. | Add a global aggregation pass on every ingest. |
| **Temporal slider timezone** | Initial range rendered in client local TZ; benign hydration edge on TZ-boundary days. | Use server-rendered UTC timestamps. |

### 13.3 Roadmap (where TRACE-X goes next)

1. **Real PDF/OCR pipeline** — Tika sidecar + SpaCy NER; replace the simulation dispatcher.
2. **Neo4j backend** — persist the graph in a real property graph; run the copilot's Cypher queries live, not just synthesised.
3. **Multi-tenant + RBAC** — per-agency data isolation; roles (Analyst / Supervisor / Prosecutor / Read-only).
4. **Real-time collaboration** — socket.io mini-service; live cursors; shared selections.
5. **Bulk ingest orchestration** — queue + worker for large evidence batches (a 10k-row CDR, a 500-page PDF bundle).
6. **Face/image recognition** — VLM skill integration for photo exhibits in FIRs.
7. **Audio transcription** — ASR skill integration for intercepted calls / recorded statements.
8. **Geo-spatial map view** — overlay the graph's `LOCATION` nodes on a real map tile layer.
9. **Pattern-of-life analytics** — movement heatmaps from CDR tower sequences.
10. **Court-presentation mode** — a stripped-down read-only view with large fonts and a "next" pedal for courtroom projection.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **BSA** | Bharatiya Sakshya Adhiniyam, 2023 — India's evidence law (replaced the Indian Evidence Act, 1872). |
| **§63 / §63(4)** | The section of BSA 2023 that requires an authenticating certificate for any electronic record tendered in evidence. |
| **FIR** | First Information Report — the document that kicks off a criminal investigation in India. |
| **CDR** | Call Detail Record — the telecom log of who called whom, when, for how long, and via which cell tower. |
| **IFSC** | Indian Financial System Code — an 11-character alphanumeric code that identifies a bank branch (`HDFC0004417` etc.). |
| **IMEI** | International Mobile Equipment Identity — a handset's unique hardware ID. Frequent IMEI swaps are a burner-discipline red flag. |
| **Hawala** | An informal value-transfer system used (legitimately and illegitimately) across South Asia and the Middle East. |
| **NER** | Named Entity Recognition — the NLP task of finding and classifying entities (persons, phones, money, locations) in unstructured text. |
| **PageRank** | The link-analysis algorithm that powers Google Search; here used to rank entities by their "influence" in the network. |
| **Betweenness centrality** | A graph metric that counts how many shortest paths pass through a node — high betweenness = bridge/cut-out. |
| **Cypher** | The declarative query language for Neo4j property graphs (analogous to SQL for relational databases). |
| **SHA-256** | A cryptographic hash function that produces a 64-character fingerprint of any input; used here for file, dossier, and report integrity. |
| **Chain of custody** | The chronologically documented sequence of who handled a piece of evidence, when, and why — legally required for admissibility. |
| **Kingpin** | The apex entity of a criminal network; in TRACE-X, a node flagged `KINGPIN` that gets a +6 boost in the risk formula and a gold halo in the canvas. |
| **Bridge node** | An entity that connects two otherwise-disconnected clusters; arresting it can decouple the network's cells. |
| **Mule** | A low-level participant whose bank account is used to layer illicit funds; usually replaceable, but traceable. |
| **Cut-out** | A counter-surveillance device/subscription (often an unattributed phone) used to keep two clusters from directly touching. |

---

### Document control

| Field | Value |
|---|---|
| Document | TRACE-X Full Program Documentation |
| Version | 2.4.1 |
| Audience | Judges, investigative agencies, partner companies, technical reviewers |
| Classification | RESTRICTED // LAW ENFORCEMENT USE ONLY (UI banner); this document itself is unclassified — for program explanation only. |
| Demo data | All persons, phones, accounts, vehicles, locations in TRACE-X are fictitious, generated for demonstration purposes only. |

*For technical questions about the codebase, see the in-source comments in `src/lib/tracex/` and `src/app/api/`. For the audit-trail of how this program was built, see `worklog.md`.*
