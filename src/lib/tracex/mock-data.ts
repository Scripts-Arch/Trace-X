// TRACE-X // Synthetic intelligence holdings (hackathon mock data)
// OP EAGLE CLAW — 15 interconnected nodes: 2 kingpin bridge persons,
// 4 phone numbers, 3 bank accounts, 2 vehicles, 1 location, 2 FIR records.
// All PII is fictitious and generated for demonstration purposes only.

import { CaseFile } from './types';

export const CASES: CaseFile[] = [
  {
    id: 'case-eagle-claw',
    codename: 'OP EAGLE CLAW',
    agency: 'SOC · CRIME BRANCH',
    desk: 'CYBER-FIN INTELLIGENCE CELL',
    status: 'ACTIVE',
    summary:
      'Hawala-backed financial fraud syndicate laundering proceeds through a lattice of shell accounts and burner handsets across NCR.',
    nodes: [
      // ── Persons ──────────────────────────────────────────────
      {
        id: 'person_rk',
        type: 'PERSON',
        label: 'RAJESH "RK" KHANNA',
        alias: 'RK · "BHAI" · "SETJI"',
        flags: ['KINGPIN', 'BRIDGE_NODE', 'SHELL_SIGNATORY'],
        firstSeen: '2024-01-08',
        source: 'FIR 0417/24 · PS KAROL BAGH',
        assessment:
          'Principal kingpin. Controls the comms layer (burner mesh) and the banking layer (shell signatory) simultaneously — every documented fund movement and call pulse routes through assets under his control. Recommend dossier upgrade to Category-A surveillance.',
        meta: { 'Role': 'Syndicate head', 'Criminal history': '7 priors — cheating, forgery', 'Operational status': 'ACTIVE · AT LARGE' },
      },
      {
        id: 'person_vt',
        type: 'PERSON',
        label: 'VIKRAM "VICKY" TALWAR',
        alias: 'VT · "MANAGER"',
        flags: ['KINGPIN', 'BRIDGE_NODE'],
        firstSeen: '2024-01-22',
        source: 'FIR 0417/24 · PS KAROL BAGH',
        assessment:
          'Second kingpin and operational manager. Runs logistics (vehicle moment) and enforcement. Bridge between RK’s financial layer and the street-level courier network.',
        meta: { 'Role': 'Operations manager', 'Criminal history': '3 priors — extortion', 'Operational status': 'ACTIVE · AT LARGE' },
      },
      {
        id: 'person_sm',
        type: 'PERSON',
        label: 'SUNIL MEHRA',
        alias: 'SONU',
        flags: ['MULE_ACCOUNT_HOLDER'],
        firstSeen: '2024-02-05',
        source: 'FIR 0923/24 · EOW',
        assessment:
          'Courier and hawala mule. Registered holder of the ICICI ••9023 account through which ₹38.0 lakh was layered. Frequent visitor to the Karol Bagh rendezvous point.',
        meta: { 'Role': 'Courier / mule', 'Criminal history': '1 prior — NDPS possession', 'Operational status': 'UNDER WATCH' },
      },
      // ── Phones ───────────────────────────────────────────────
      {
        id: 'phone_rk',
        type: 'PHONE',
        label: '+91 98110 44172',
        sublabel: 'AIRTEL · BURNER MESH',
        flags: ['HIGH_CHURN', 'IMEI_SWAPS_22'],
        firstSeen: '2024-01-08',
        source: 'CDR BATCH 2024-Q1',
        assessment:
          'Primary command-and-control handset. 22 IMEI swaps in 90 days — classic burner discipline. Peak activity correlates with fund movements within ±2 hours.',
        meta: { 'Carrier': 'Airtel', 'IMEI swaps': 22, 'Last tower': 'DEL_KRB_07 · Karol Bagh' },
      },
      {
        id: 'phone_vt',
        type: 'PHONE',
        label: '+91 98732 90814',
        sublabel: 'JIO · PRIMARY',
        flags: ['HIGH_VOLUME'],
        firstSeen: '2024-01-22',
        source: 'CDR BATCH 2024-Q1',
        assessment:
          'Vikram Talwar’s primary handset. Highest call volume in the network (56 contacts with the mule handset). Frequent late-night bursts before logistics runs.',
        meta: { 'Carrier': 'Jio', 'Monthly usage': '2.1 GB · 640 mins', 'Last tower': 'NOI_SEC_11 · Sector 11' },
      },
      {
        id: 'phone_sm',
        type: 'PHONE',
        label: '+91 90024 66230',
        sublabel: 'VODAFONE · MULE',
        firstSeen: '2024-02-05',
        source: 'CDR BATCH 2024-Q1',
        assessment: 'Courier handset. Bridges the unattributed number into the mesh — possible cut-out device.',
        meta: { 'Carrier': 'Vodafone', 'Top-ups': 'Cash · ₹49 recharges', 'Last tower': 'DEL_KRB_07 · Karol Bagh' },
      },
      {
        id: 'phone_un',
        type: 'PHONE',
        label: '+91 99103 33203',
        sublabel: 'UNATTRIBUTED · TOWER DUMP',
        flags: ['UNATTRIBUTED', 'CROSS_CLUSTER'],
        firstSeen: '2024-02-11',
        source: 'TOWER DUMP 042024',
        assessment:
          'Unattributed subscription contacting both kingpin clusters and the mule handset. Likely a counter-surveillance cut-out. Subscriber KYC under verification.',
        meta: { 'Carrier': 'Airtel', 'KYC status': 'MISMATCH — fake Aadhaar', 'Last tower': 'DEL_CP_02 · Connaught Place' },
      },
      // ── Bank accounts ────────────────────────────────────────
      {
        id: 'bank_hdfc',
        type: 'BANK_ACCOUNT',
        label: 'HDFC X••4417',
        sublabel: 'SHREE GANESH TRADERS (SHELL)',
        flags: ['SHELL_COMPANY', 'ORIGIN_ACCOUNT'],
        firstSeen: '2024-01-15',
        source: 'BANKING INQUIRY · FIU-IND',
        assessment:
          'Origin layer. Shell current account with fabricated turnover invoices. All outward remittances trail back to syndicate instructions signed under alias.',
        meta: { 'Bank': 'HDFC · Karol Bagh branch', 'Inflow (90d)': '₹71.2 lakh', 'Outflow (90d)': '₹54.9 lakh' },
      },
      {
        id: 'bank_icici',
        type: 'BANK_ACCOUNT',
        label: 'ICICI X••9023',
        sublabel: 'MULE ACCOUNT · S. MEHRA',
        flags: ['MULE_ACCOUNT'],
        firstSeen: '2024-02-10',
        source: 'FIR 0923/24 · EOW',
        assessment:
          'Layer-1 mule account. Receives from the shell, strips cash commissions, forwards the balance onward within 72 hours.',
        meta: { 'Bank': 'ICICI · Rajouri Garden', 'Inflow (90d)': '₹44.5 lakh', 'Cash withdrawals': '₹6.3 lakh' },
      },
      {
        id: 'bank_sbi',
        type: 'BANK_ACCOUNT',
        label: 'SBI X••7842',
        sublabel: 'LAYERING NODE · EXPORT FIRMA',
        flags: ['LAYERING', 'CYCLE_DETECTED'],
        firstSeen: '2024-03-01',
        source: 'BANKING INQUIRY · FIU-IND',
        assessment:
          'Layer-2 account for a bogus export firma. Funds complete a full circular trail back to the origin shell — textbook placement-layering cycle.',
        meta: { 'Bank': 'SBI · Nehru Place', 'Inflow (90d)': '₹38.0 lakh', 'Flagged by': 'FIU-IND STR #88231' },
      },
      // ── Vehicles ─────────────────────────────────────────────
      {
        id: 'veh_innova',
        type: 'VEHICLE',
        label: 'HR-26-AB-4417',
        sublabel: 'TOYOTA INNOVA CRYSTA · GREY',
        flags: ['ANPR_14_HITS'],
        firstSeen: '2024-01-15',
        source: 'ANPR FEED · NCR CORRIDOR',
        assessment:
          'RK’s movement vehicle, registered under a benami name. 14 ANPR hits — all within 4 km of the rendezvous hotel on fund-movement days.',
        meta: { 'Model': 'Toyota Innova Crysta', 'Registered owner': 'Benami — Shree Ganesh Traders', 'ANPR hits': 14 },
      },
      {
        id: 'veh_city',
        type: 'VEHICLE',
        label: 'DL-8C-AX-9023',
        sublabel: 'HONDA CITY · BLACK',
        firstSeen: '2024-01-22',
        source: 'ANPR FEED · NCR CORRIDOR',
        assessment: 'Vikram Talwar’s logistics vehicle. Observed ferrying cartons during the Karol Bagh meets.',
        meta: { 'Model': 'Honda City', 'Registered owner': 'V. Talwar (spouse)', 'ANPR hits': 9 },
      },
      // ── Locations ────────────────────────────────────────────
      {
        id: 'loc_hotel',
        type: 'LOCATION',
        label: 'HOTEL GRAND PALACE',
        sublabel: 'KAROL BAGH · RENDEZVOUS',
        flags: ['RENDEZVOUS_POINT', 'CCTV_COVERED'],
        firstSeen: '2024-02-28',
        source: 'CCTV CANVAS · 14 CAMERAS',
        assessment:
          'Primary rendezvous. All three subjects plus both vehicles converge here within a 40-minute window on at least three occasions. CCTV canvas preserved under BSA §63.',
        meta: { 'Geo': '28.6519° N, 77.1909° E', 'CCTV': '14 cameras · 21 days preserved', 'Meets observed': 3 },
      },
      // ── FIR records ──────────────────────────────────────────
      {
        id: 'fir_0417',
        type: 'FIR',
        label: 'FIR 0417/24',
        sublabel: 'PS KAROL BAGH · CHEATING & CONSPIRACY',
        firstSeen: '2024-02-20',
        source: 'DELHI POLICE · CCTNS',
        assessment:
          'Root FIR naming both kingpins. BNS §318(4) cheating read with §61(2) criminal conspiracy. 11 witnesses; digital annexures sealed.',
        meta: { 'Sections': 'BNS §318(4), §61(2)', 'Complainant': 'M/s Arora Textiles', 'Status': 'Charge sheet pending' },
      },
      {
        id: 'fir_0923',
        type: 'FIR',
        label: 'FIR 0923/24',
        sublabel: 'EOW · HAWALA REMITTANCE',
        firstSeen: '2024-03-25',
        source: 'EOW DELHI · CCTNS',
        assessment:
          'Hawala FIR naming the mule and tracing ₹38.0 lakh through the ICICI account. Filed by FIU-IND STR escalation.',
        meta: { 'Sections': 'PMLA §3, FEMA §13', 'Complainant': 'FIU-IND STR #88231', 'Status': 'Under investigation' },
      },
    ],
    edges: [
      // ownership & control
      { id: 'e01', source: 'person_rk', target: 'phone_rk', type: 'OWNS', date: '2024-01-08', label: 'OWNS', meta: { note: 'Burner mesh primary' } },
      { id: 'e02', source: 'person_rk', target: 'veh_innova', type: 'OWNS', date: '2024-01-15', label: 'OWNS', meta: { note: 'Benami registration' } },
      { id: 'e03', source: 'person_rk', target: 'bank_hdfc', type: 'OWNS', date: '2024-01-15', label: 'OWNS', meta: { note: 'Signatory via shell co.' } },
      { id: 'e04', source: 'person_vt', target: 'phone_vt', type: 'OWNS', date: '2024-01-22', label: 'OWNS' },
      { id: 'e05', source: 'person_vt', target: 'veh_city', type: 'OWNS', date: '2024-01-22', label: 'OWNS', meta: { note: 'Registered to spouse' } },
      { id: 'e06', source: 'person_sm', target: 'phone_sm', type: 'OWNS', date: '2024-02-05', label: 'OWNS' },
      { id: 'e07', source: 'person_sm', target: 'bank_icici', type: 'OWNS', date: '2024-02-10', label: 'OWNS', meta: { note: 'Mule account holder' } },
      // co-accused & sightings
      { id: 'e08', source: 'person_rk', target: 'person_vt', type: 'CO_ACCUSED', date: '2024-02-20', label: 'CO-ACCUSED', meta: { fir: 'FIR 0417/24' } },
      { id: 'e09', source: 'person_rk', target: 'loc_hotel', type: 'SPOTTED_AT', date: '2024-03-02', label: 'SPOTTED AT', meta: { source: 'CCTV · ANPR fusion' } },
      { id: 'e10', source: 'person_vt', target: 'loc_hotel', type: 'SPOTTED_AT', date: '2024-03-02', label: 'SPOTTED AT', meta: { source: 'CCTV' } },
      { id: 'e11', source: 'person_sm', target: 'loc_hotel', type: 'SPOTTED_AT', date: '2024-02-28', label: 'SPOTTED AT', meta: { source: 'CCTV' } },
      { id: 'e12', source: 'veh_innova', target: 'loc_hotel', type: 'SPOTTED_AT', date: '2024-03-02', label: 'SPOTTED AT', meta: { source: 'ANPR' } },
      { id: 'e13', source: 'veh_city', target: 'loc_hotel', type: 'SPOTTED_AT', date: '2024-02-28', label: 'SPOTTED AT', meta: { source: 'ANPR' } },
      // telephony mesh
      { id: 'e14', source: 'phone_rk', target: 'phone_vt', type: 'CALLED', date: '2024-03-05', weight: 34, label: 'CALLED ×34', meta: { duration: '4h 12m total' } },
      { id: 'e15', source: 'phone_rk', target: 'phone_un', type: 'CALLED', date: '2024-02-11', weight: 12, label: 'CALLED ×12' },
      { id: 'e16', source: 'phone_vt', target: 'phone_sm', type: 'CALLED', date: '2024-03-12', weight: 56, label: 'CALLED ×56', meta: { duration: '9h 03m total' } },
      { id: 'e17', source: 'phone_sm', target: 'phone_un', type: 'CALLED', date: '2024-02-14', weight: 7, label: 'CALLED ×7' },
      { id: 'e18', source: 'phone_vt', target: 'phone_un', type: 'CALLED', date: '2024-04-01', weight: 3, label: 'CALLED ×3' },
      { id: 'e19', source: 'phone_sm', target: 'phone_rk', type: 'CALLED', date: '2024-05-19', weight: 9, label: 'CALLED ×9' },
      // funds layer
      { id: 'e20', source: 'bank_hdfc', target: 'bank_icici', type: 'TRANSFERRED_FUNDS', date: '2024-03-15', weight: 4250000, label: '₹42.5L · NEFT', meta: { mode: 'NEFT', ref: 'N0417NEFT9931' } },
      { id: 'e21', source: 'bank_icici', target: 'bank_sbi', type: 'TRANSFERRED_FUNDS', date: '2024-03-18', weight: 3800000, label: '₹38.0L · RTGS', meta: { mode: 'RTGS', ref: 'R0923RTGS1187' } },
      { id: 'e22', source: 'bank_sbi', target: 'bank_hdfc', type: 'TRANSFERRED_FUNDS', date: '2024-04-02', weight: 1240000, label: '₹12.4L · IMPS', meta: { mode: 'IMPS', note: 'Circular trail — cycle detected' } },
      { id: 'e23', source: 'bank_sbi', target: 'bank_icici', type: 'TRANSFERRED_FUNDS', date: '2024-05-27', weight: 620000, label: '₹6.2L · IMPS', meta: { mode: 'IMPS' } },
      // FIR linkage
      { id: 'e24', source: 'fir_0417', target: 'person_rk', type: 'NAMES_ACCUSED', date: '2024-02-20', label: 'NAMES ACCUSED' },
      { id: 'e25', source: 'fir_0417', target: 'person_vt', type: 'NAMES_ACCUSED', date: '2024-02-20', label: 'NAMES ACCUSED' },
      { id: 'e26', source: 'fir_0923', target: 'person_sm', type: 'NAMES_ACCUSED', date: '2024-03-25', label: 'NAMES ACCUSED' },
      { id: 'e27', source: 'fir_0923', target: 'bank_icici', type: 'LINKED_TO', date: '2024-03-25', label: 'FUNDS TRAIL' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'case-black-mirror',
    codename: 'OP BLACK MIRROR',
    agency: 'ANTI-NARCOTICS CELL',
    desk: 'SYNDICATE MAPPING UNIT',
    status: 'ACTIVE',
    summary:
      'Synthetic opioid supply chain routed through a Delhi wholesale hub with courier-layer insulation and cash-stripped settlements.',
    nodes: [
      { id: 'person_zk', type: 'PERSON', label: 'ZOYA "ZK" KHAN', alias: 'MA’AM · "LEDGER"', flags: ['KINGPIN', 'BRIDGE_NODE'], firstSeen: '2024-02-01', source: 'FIR 0731/24 · ANC', assessment: 'Supply-side kingpin and ledger keeper. Controls wholesale inventory and settlement accounts.', meta: { 'Role': 'Wholesale supplier' } },
      { id: 'person_dm', type: 'PERSON', label: 'DEEPAK "DIAMOND" MANTRI', alias: 'DIAMOND', flags: ['KINGPIN'], firstSeen: '2024-02-14', source: 'FIR 0731/24 · ANC', assessment: 'Cross-border procurement. Bridges source supply to the Delhi hub.', meta: { 'Role': 'Procurement' } },
      { id: 'person_bb', type: 'PERSON', label: 'BUNTY BANSAL', alias: 'BB', firstSeen: '2024-03-02', source: 'SURVEILLANCE LOG', assessment: 'Last-mile courier. Cash collection and package drops.', meta: { 'Role': 'Courier' } },
      { id: 'phone_zk', type: 'PHONE', label: '+91 98992 13340', sublabel: 'AIRTEL', firstSeen: '2024-02-01', source: 'CDR BATCH 2024-Q2', assessment: 'Ledger handset. Code-word SMS bursts before drops.', meta: { 'Carrier': 'Airtel' } },
      { id: 'phone_dm', type: 'PHONE', label: '+91 91230 66518', sublabel: 'BSNL · ROAMING', flags: ['BORDER_ROAMING'], firstSeen: '2024-02-14', source: 'CDR BATCH 2024-Q2', assessment: 'Frequent border-tower roaming pattern.', meta: { 'Carrier': 'BSNL' } },
      { id: 'phone_bb', type: 'PHONE', label: '+91 88007 23119', sublabel: 'JIO', firstSeen: '2024-03-02', source: 'CDR BATCH 2024-Q2', assessment: 'Courier handset with cash-top pattern.', meta: { 'Carrier': 'Jio' } },
      { id: 'phone_x', type: 'PHONE', label: '+91 74289 00331', sublabel: 'UNATTRIBUTED', flags: ['UNATTRIBUTED'], firstSeen: '2024-03-18', source: 'TOWER DUMP 062024', assessment: 'Cut-out device bridging both kingpins.', meta: { 'Carrier': 'Vi' } },
      { id: 'bank_axis', type: 'BANK_ACCOUNT', label: 'AXIS X••5512', sublabel: 'LEDGER ACCOUNT · TRADING CO.', flags: ['SHELL_COMPANY'], firstSeen: '2024-02-08', source: 'BANKING INQUIRY', assessment: 'Settlement ledger disguised as trading turnover.', meta: { 'Bank': 'Axis' } },
      { id: 'bank_pnb', type: 'BANK_ACCOUNT', label: 'PNB X••7789', sublabel: 'MULE · B. BANSAL', flags: ['MULE_ACCOUNT'], firstSeen: '2024-03-05', source: 'BANKING INQUIRY', assessment: 'Courier settlement account.', meta: { 'Bank': 'PNB' } },
      { id: 'veh_scooty', type: 'VEHICLE', label: 'DL-1S-BA-5512', sublabel: 'HONDA ACTIVA · BLUE', firstSeen: '2024-03-02', source: 'ANPR FEED', assessment: 'Drop vehicle.', meta: { 'Model': 'Honda Activa' } },
      { id: 'loc_wh', type: 'LOCATION', label: 'WAREHOUSE 7 · NARELA', sublabel: 'INDUSTRIAL AREA', flags: ['STASH_POINT'], firstSeen: '2024-03-11', source: 'SURVEILLANCE LOG', assessment: 'Stash and repack point. All three subjects observed.', meta: { 'Geo': '28.8527° N, 77.0995° E' } },
      { id: 'fir_0731', type: 'FIR', label: 'FIR 0731/24', sublabel: 'ANC · NDPS', firstSeen: '2024-04-02', source: 'DELHI POLICE · CCTNS', assessment: 'NDPS §21/29 — commercial quantity.', meta: { 'Sections': 'NDPS §21, §29' } },
    ],
    edges: [
      { id: 'b01', source: 'person_zk', target: 'phone_zk', type: 'OWNS', date: '2024-02-01', label: 'OWNS' },
      { id: 'b02', source: 'person_zk', target: 'bank_axis', type: 'OWNS', date: '2024-02-08', label: 'OWNS', meta: { note: 'Signatory via trading co.' } },
      { id: 'b03', source: 'person_zk', target: 'person_dm', type: 'CO_ACCUSED', date: '2024-02-14', label: 'CO-ACCUSED', meta: { fir: 'FIR 0731/24' } },
      { id: 'b04', source: 'person_zk', target: 'loc_wh', type: 'SPOTTED_AT', date: '2024-03-11', label: 'SPOTTED AT' },
      { id: 'b05', source: 'person_dm', target: 'phone_dm', type: 'OWNS', date: '2024-02-14', label: 'OWNS' },
      { id: 'b06', source: 'person_dm', target: 'loc_wh', type: 'SPOTTED_AT', date: '2024-03-11', label: 'SPOTTED AT' },
      { id: 'b07', source: 'person_bb', target: 'phone_bb', type: 'OWNS', date: '2024-03-02', label: 'OWNS' },
      { id: 'b08', source: 'person_bb', target: 'bank_pnb', type: 'OWNS', date: '2024-03-05', label: 'OWNS' },
      { id: 'b09', source: 'person_bb', target: 'veh_scooty', type: 'OWNS', date: '2024-03-02', label: 'OWNS' },
      { id: 'b10', source: 'person_bb', target: 'loc_wh', type: 'SPOTTED_AT', date: '2024-03-15', label: 'SPOTTED AT' },
      { id: 'b11', source: 'phone_zk', target: 'phone_dm', type: 'CALLED', date: '2024-03-09', weight: 21, label: 'CALLED ×21' },
      { id: 'b12', source: 'phone_zk', target: 'phone_bb', type: 'CALLED', date: '2024-03-20', weight: 44, label: 'CALLED ×44' },
      { id: 'b13', source: 'phone_x', target: 'phone_zk', type: 'CALLED', date: '2024-03-18', weight: 5, label: 'CALLED ×5' },
      { id: 'b14', source: 'phone_dm', target: 'phone_x', type: 'CALLED', date: '2024-04-06', weight: 2, label: 'CALLED ×2' },
      { id: 'b15', source: 'bank_axis', target: 'bank_pnb', type: 'TRANSFERRED_FUNDS', date: '2024-03-22', weight: 890000, label: '₹8.9L · UPI' },
      { id: 'b16', source: 'fir_0731', target: 'person_zk', type: 'NAMES_ACCUSED', date: '2024-04-02', label: 'NAMES ACCUSED' },
      { id: 'b17', source: 'fir_0731', target: 'person_dm', type: 'NAMES_ACCUSED', date: '2024-04-02', label: 'NAMES ACCUSED' },
      { id: 'b18', source: 'veh_scooty', target: 'loc_wh', type: 'SPOTTED_AT', date: '2024-03-15', label: 'SPOTTED AT' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'case-ghost-ship',
    codename: 'OP GHOST SHIP',
    agency: 'CUSTOMS · DRI UNIT',
    desk: 'MARITIME SMUGGLING CELL',
    status: 'MONITORING',
    summary:
      'Undervalued container imports cleared through a compromised agent at Mundra Port with cash settlements outside banking channels.',
    nodes: [
      { id: 'person_cm', type: 'PERSON', label: 'CAPT. MARAN', alias: '“THE CAPTAIN”', flags: ['KINGPIN', 'BRIDGE_NODE'], firstSeen: '2024-03-04', source: 'FIR 1204/24 · DRI', assessment: 'Mastermind controlling shipping manifests and settlement chain.', meta: { 'Role': 'Import mastermind' } },
      { id: 'person_jd', type: 'PERSON', label: 'JAI DESHMUKH', alias: 'JD · “CLEARING”', firstSeen: '2024-03-12', source: 'FIR 1204/24 · DRI', assessment: 'Compromised customs clearing agent.', meta: { 'Role': 'Clearing agent' } },
      { id: 'phone_m1', type: 'PHONE', label: '+91 98204 51226', sublabel: 'AIRTEL · MUMBAI', firstSeen: '2024-03-04', source: 'CDR BATCH 2024-Q2', assessment: 'Captain’s coordination handset.', meta: { 'Carrier': 'Airtel' } },
      { id: 'phone_m4', type: 'PHONE', label: '+91 90824 99013', sublabel: 'JIO', firstSeen: '2024-03-12', source: 'CDR BATCH 2024-Q2', assessment: 'Clearing agent handset.', meta: { 'Carrier': 'Jio' } },
      { id: 'phone_m7', type: 'PHONE', label: '+91 99303 45618', sublabel: 'UNATTRIBUTED', flags: ['UNATTRIBUTED'], firstSeen: '2024-04-02', source: 'TOWER DUMP 072024', assessment: 'Cut-out between port operations and settlement.', meta: { 'Carrier': 'MTNL' } },
      { id: 'bank_kotak', type: 'BANK_ACCOUNT', label: 'KOTAK X••3310', sublabel: 'SETTLEMENT · FREIGHT CO.', flags: ['SHELL_COMPANY'], firstSeen: '2024-03-20', source: 'BANKING INQUIRY', assessment: 'Freight-forwarding shell used for inflated invoices.', meta: { 'Bank': 'Kotak' } },
      { id: 'veh_truck', type: 'VEHICLE', label: 'MH-04-GH-0077', sublabel: 'ASHOK LEYLAND TRUCK', firstSeen: '2024-04-11', source: 'ANPR FEED', assessment: 'Container haulage vehicle.', meta: { 'Model': 'Ashok Leyland 3718' } },
      { id: 'veh_van', type: 'VEHICLE', label: 'MH-04-JX-4412', sublabel: 'TATA ACE · WHITE', firstSeen: '2024-04-11', source: 'ANPR FEED', assessment: 'Last-mile van from port gate.', meta: { 'Model': 'Tata Ace' } },
      { id: 'loc_port', type: 'LOCATION', label: 'MUNDRA PORT · GATE 3', sublabel: 'GUJARAT', flags: ['RENDEZVOUS_POINT'], firstSeen: '2024-04-11', source: 'CUSTOMS LOG', assessment: 'Compromised clearance gate.', meta: { 'Geo': '22.8393° N, 69.7239° E' } },
      { id: 'fir_1204', type: 'FIR', label: 'FIR 1204/24', sublabel: 'DRI · CUSTOMS', firstSeen: '2024-06-01', source: 'DRI · CCTNS', assessment: 'Customs Act §111/135 — undervaluation and smuggling.', meta: { 'Sections': 'Customs §111, §135' } },
    ],
    edges: [
      { id: 'g01', source: 'person_cm', target: 'phone_m1', type: 'OWNS', date: '2024-03-04', label: 'OWNS' },
      { id: 'g02', source: 'person_cm', target: 'bank_kotak', type: 'OWNS', date: '2024-03-20', label: 'OWNS' },
      { id: 'g03', source: 'person_cm', target: 'loc_port', type: 'SPOTTED_AT', date: '2024-04-11', label: 'SPOTTED AT' },
      { id: 'g04', source: 'person_jd', target: 'phone_m4', type: 'OWNS', date: '2024-03-12', label: 'OWNS' },
      { id: 'g05', source: 'person_jd', target: 'veh_truck', type: 'OWNS', date: '2024-04-11', label: 'OWNS' },
      { id: 'g06', source: 'person_jd', target: 'veh_van', type: 'OWNS', date: '2024-04-11', label: 'OWNS' },
      { id: 'g07', source: 'phone_m1', target: 'phone_m4', type: 'CALLED', date: '2024-04-14', weight: 18, label: 'CALLED ×18' },
      { id: 'g08', source: 'phone_m1', target: 'phone_m7', type: 'CALLED', date: '2024-04-20', weight: 6, label: 'CALLED ×6' },
      { id: 'g09', source: 'phone_m4', target: 'phone_m7', type: 'CALLED', date: '2024-05-02', weight: 11, label: 'CALLED ×11' },
      { id: 'g10', source: 'veh_truck', target: 'loc_port', type: 'SPOTTED_AT', date: '2024-04-11', label: 'SPOTTED AT' },
      { id: 'g11', source: 'veh_van', target: 'loc_port', type: 'SPOTTED_AT', date: '2024-04-11', label: 'SPOTTED AT' },
      { id: 'g12', source: 'fir_1204', target: 'person_cm', type: 'NAMES_ACCUSED', date: '2024-06-01', label: 'NAMES ACCUSED' },
      { id: 'g13', source: 'fir_1204', target: 'loc_port', type: 'LINKED_TO', date: '2024-06-01', label: 'SCENE OF OFFENCE' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Blank canvas case — the analyst's starting point for uploading
  // their own evidence and building a fresh case from scratch.
  // Has 0 seed nodes / 0 edges; the linker will create a new node
  // for every entity extracted from the first ingest (no dedup).
  {
    id: 'case-blank',
    codename: 'NEW ANALYSIS',
    agency: 'CUSTOM CASEFILE',
    desk: 'ANALYST-UPLOADED EVIDENCE',
    status: 'DRAFT',
    summary:
      'Blank canvas for the analyst to upload their own FIR PDFs, CDR CSVs, bank statements and free-text notes. No seed entities — the graph builds from scratch as evidence is ingested.',
    nodes: [],
    edges: [],
  },
];

export function getCase(caseId: string): CaseFile {
  return CASES.find((c) => c.id === caseId) ?? CASES[0];
}

/** Like getCase but returns null for unknown ids — API routes 404 instead of silently falling back. */
export function findCase(caseId: string): CaseFile | null {
  return CASES.find((c) => c.id === caseId) ?? null;
}
