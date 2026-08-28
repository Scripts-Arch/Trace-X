#!/usr/bin/env python3
"""
TRACE-X — Sample evidence PDF generator.

Produces four cross-linked, text-extractable PDFs that exercise the full
NER + relationship-inference + centrality/risk pipeline:

  1. sample_fir.pdf            — First Information Report (narrative + fields)
  2. sample_cdr.pdf            — Call Detail Record (tabular)
  3. sample_bank_statement.pdf — Bank account statement (tabular)
  4. sample_vehicle_rc.pdf     — Vehicle Registration Certificate (fields)

All four share a common entity set (people / phones / bank accounts /
vehicles / locations) so the TRACE-X Linker resolves them onto the SAME
graph nodes — producing a real network, not a document-star topology.

Output: /home/z/my-project/sample-evidence/*.pdf
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT_DIR = "/home/z/my-project/sample-evidence"
os.makedirs(OUT_DIR, exist_ok=True)

# Register a clean sans font if available; fall back to Helvetica.
FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

# ─── Shared scenario: "Operation Iron Ledger" ─────────────────────────
# People
ROHAN   = "Rohan Malhotra"     # kingpin / shell-company director
MEERA   = "Meera Iyer"         # co-accused / proprietor
KABIR   = "Kabir Nanda"        # cash courier
SAMEER  = "Sameer Qureshi"     # warehouse owner
RATHORE = "Devendra Rathore"   # Investigating Officer
ANIL    = "Anil Kapoor"        # complainant

# Phones (10-digit Indian mobiles, leading 6-9)
P_ROHAN  = "+91 98220 14567"
P_MEERA  = "+91 99876 23104"
P_KABIR  = "+91 90011 47820"
P_SAMEER = "+91 81234 56789"

# Bank accounts (IFSC format BBBB0XXXXXX)
ACCT_ROHAN = "01928822345"
IFSC_ROHAN = "AXIS0000192"
ACCT_MEERA = "55104417823"
IFSC_MEERA = "HDFC0000042"
ACCT_KABIR = "30318049271"
IFSC_KABIR = "SBIN0000303"

# Vehicles (Indian plates: AA00BB0000)
V_ROHAN  = "KA03AB1234"
V_MEERA  = "MH02CD5678"
V_SAMEER = "DL01EF9012"

# Locations
LOC_WAREHOUSE = "Whitefield Warehouse, Bengaluru"
LOC_INDUSTRIAL = "Andheri Industrial Estate, Mumbai"
LOC_MARKET = "Karol Bagh Market, New Delhi"


def base_styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        name="DocTitle", fontName=FONT_BOLD, fontSize=14,
        alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor("#0f172a")))
    ss.add(ParagraphStyle(
        name="DocSub", fontName=FONT, fontSize=9,
        alignment=TA_CENTER, spaceAfter=8, textColor=colors.HexColor("#475569")))
    ss.add(ParagraphStyle(
        name="Section", fontName=FONT_BOLD, fontSize=10,
        alignment=TA_LEFT, spaceBefore=8, spaceAfter=3,
        textColor=colors.HexColor("#0f172a")))
    ss.add(ParagraphStyle(
        name="Field", fontName=FONT, fontSize=9, alignment=TA_LEFT,
        leading=13))
    ss.add(ParagraphStyle(
        name="Body", fontName=FONT, fontSize=9, alignment=TA_JUSTIFY,
        leading=13, spaceAfter=6))
    ss.add(ParagraphStyle(
        name="Cell", fontName=FONT, fontSize=8, alignment=TA_LEFT, leading=10))
    ss.add(ParagraphStyle(
        name="CellR", fontName=FONT, fontSize=8, alignment=TA_CENTER, leading=10))
    ss.add(ParagraphStyle(
        name="CellH", fontName=FONT_BOLD, fontSize=8, alignment=TA_CENTER,
        leading=10, textColor=colors.white))
    return ss


S = base_styles()


def header_footer(canvas, doc, title):
    canvas.saveState()
    canvas.setFont(FONT, 7)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(15 * mm, A4[1] - 10 * mm, title)
    canvas.drawRightString(A4[0] - 15 * mm, A4[1] - 10 * mm,
                           "CONFIDENTIAL — Law Enforcement")
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.setLineWidth(0.5)
    canvas.line(15 * mm, A4[1] - 12 * mm, A4[0] - 15 * mm, A4[1] - 12 * mm)
    canvas.line(15 * mm, 12 * mm, A4[0] - 15 * mm, 12 * mm)
    canvas.drawCentredString(A4[0] / 2, 8 * mm,
                             "Page %d — Sample evidence for TRACE-X analysis pipeline" %
                             doc.page)
    canvas.restoreState()


def field_table(rows):
    """Two-column key/value field table."""
    t = Table(rows, colWidths=[42 * mm, 128 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
        ("FONTNAME", (1, 0), (1, -1), FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#334155")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    return t


# ════════════════════════════════════════════════════════════════════
# 1. FIRST INFORMATION REPORT (FIR)
# ════════════════════════════════════════════════════════════════════

def build_fir(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title="FIR No. 427/2024 — Whitefield PS",
        author="Karnataka State Police",
        subject="First Information Report — sample evidence",
    )
    H = []
    H.append(Paragraph("FIRST INFORMATION REPORT", S["DocTitle"]))
    H.append(Paragraph(
        "Karnataka State Police — Bangalore City, Whitefield Police Station",
        S["DocSub"]))
    H.append(HRFlowable(width="100%", thickness=1,
                        color=colors.HexColor("#0f172a"), spaceAfter=6))

    H.append(Paragraph("Section 154 Cr.P.C. — Registered Complaint", S["Section"]))
    H.append(field_table([
        ["FIR No.", "427 / 2024"],
        ["Police Station", "Whitefield PS, Bangalore City, Karnataka"],
        ["District", "Bengaluru Urban"],
        ["Date of Registration", "14 October 2024"],
        ["Time of Registration", "19:40 hrs"],
        ["FIR Type", "Non-Cognizable, upgraded to Cognizable (Sec. 420 IPC)"],
    ]))

    H.append(Paragraph("Complainant / Informant", S["Section"]))
    H.append(field_table([
        ["Name:", ANIL],
        ["Father's Name:", "Rajesh Kapoor"],
        ["Address:", "42, Palm Meadows, Whitefield, Bengaluru — 560066"],
        ["Phone:", P_ROHAN.replace("+91 98220 14567", "+91 98456 11023")],
        ["Occupation:", "Logistics Coordinator, BluePeak Imports Pvt. Ltd."],
    ]))

    H.append(Paragraph("Accused Persons", S["Section"]))
    H.append(field_table([
        ["Accused 1:", ROHAN + ", Director, Apex Trading Solutions Pvt. Ltd."],
        ["Accused 2:", MEERA + ", Proprietor, Iyer Components & Logistics"],
        ["Accused 3:", KABIR + ", Cash Courier / Field Agent"],
        ["Suspect:", SAMEER + ", Owner, Qureshi Warehouse, Andheri, Mumbai"],
    ]))

    H.append(Paragraph("Place of Occurrence", S["Section"]))
    H.append(field_table([
        ["Place of Occurrence:", LOC_WAREHOUSE],
        ["Date / Time:", "13 October 2024, approx. 23:15 hrs"],
        ["Distance from PS:", "4.2 km"],
    ]))

    H.append(Paragraph("Sections of Law", S["Section"]))
    H.append(Paragraph(
        "Section 420 (Cheating), Section 406 (Criminal Breach of Trust), "
        "Section 120B (Criminal Conspiracy), Section 465 (Forgery), "
        "Section 471 (Using forged document) of the Indian Penal Code, 1860.",
        S["Body"]))

    H.append(Paragraph("Information / Statement (verbatim)", S["Section"]))
    narrative = (
        f"I, {ANIL}, state that on the night of 13 October 2024, at the "
        f"{LOC_WAREHOUSE}, I witnessed large-scale cash movement and "
        f"fabricated invoices being prepared by the accused persons. "
        f"Accused {ROHAN}, who is the Director of Apex Trading Solutions, "
        f"was personally coordinating the operation and was in constant "
        f"telephone communication with accused {MEERA} and suspect "
        f"{KABIR}. The phone used by {ROHAN} was {P_ROHAN}. "
        f"{MEERA} could be reached at {P_MEERA} and {KABIR} at {P_KABIR}. "
        f"I overheard {ROHAN} instruct {KABIR} to transport cash of "
        f"Rs. 45 lakh to a godown near {LOC_INDUSTRIAL}. "
        f"The vehicle used by {KABIR} for the transport was a white sedan "
        f"bearing registration number {V_ROHAN}, which is registered in the "
        f"name of {ROHAN}. Another vehicle {V_MEERA}, registered to "
        f"{MEERA}, was seen parked outside the warehouse earlier the same "
        f"evening. "
        f"During the conversation, {ROHAN} referred to his bank account "
        f"Axis A/c No. {ACCT_ROHAN} (IFSC {IFSC_ROHAN}) and asked {MEERA} "
        f"to route the proceeds through her HDFC account number "
        f"{ACCT_MEERA} with IFSC {IFSC_MEERA}. {KABIR} stated that his "
        f"own SBI account number {ACCT_KABIR} (IFSC {IFSC_KABIR}) would be "
        f"used to receive Rs. 8.5 lakh as his commission. "
        f"The total fraud value is estimated at Rs. 2.5 crore. "
        f"Accused {SAMEER}, who OWNS the Qureshi Warehouse, was earlier "
        f"spotted at {LOC_MARKET} meeting {MEERA}. "
        f"I request that an FIR be registered against the accused persons "
        f"and the financial trail be investigated."
    )
    H.append(Paragraph(narrative, S["Body"]))

    H.append(Paragraph("Investigating Officer", S["Section"]))
    H.append(field_table([
        ["IO Name:", "Inspector " + RATHORE],
        ["Badge No:", "KA-PS-4471"],
        ["Phone:", P_SAMEER.replace(P_SAMEER, "+91 99001 22034")],
    ]))

    H.append(Paragraph(
        "This FIR is registered based on the statement of the informant. "
        "The accused are to be produced before the jurisdictional magistrate "
        "within 24 hours of arrest as mandated under Section 56 Cr.P.C.",
        S["Body"]))

    doc.build(
        H,
        onFirstPage=lambda c, d: header_footer(c, d, "FIR No. 427/2024 — Whitefield PS"),
        onLaterPages=lambda c, d: header_footer(c, d, "FIR No. 427/2024 — Whitefield PS"),
    )
    print("  ✓", os.path.basename(path))


# ════════════════════════════════════════════════════════════════════
# 2. CALL DETAIL RECORD (CDR)
# ════════════════════════════════════════════════════════════════════

def build_cdr(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title="CDR — +91 9822014567 — Oct 2024",
        author="Service Provider — Lawful Intercept",
        subject="Call Detail Record — sample evidence",
    )
    H = []
    H.append(Paragraph("CALL DETAIL RECORD (CDR)", S["DocTitle"]))
    H.append(Paragraph(
        "Service Provider: Bharat Cellular Ltd. — Lawful Intercept Output",
        S["DocSub"]))
    H.append(HRFlowable(width="100%", thickness=1,
                        color=colors.HexColor("#0f172a"), spaceAfter=6))

    H.append(Paragraph("Subscriber Details", S["Section"]))
    H.append(field_table([
        ["Subscriber Name:", ROHAN],
        ["MSISDN:", P_ROHAN],
        ["IMEI:", "356938035643809"],
        ["Circle:", "Karnataka"],
        ["Request Ref:", "LI-2024-4471"],
        ["Period:", "10 Oct 2024 to 14 Oct 2024"],
    ]))

    H.append(Paragraph("Call Records", S["Section"]))

    hdr = [Paragraph(x, S["CellH"]) for x in
           ["#", "Calling Number", "Called Number", "Date", "Time",
            "Dur (s)", "Cell ID", "Location"]]
    rows = [
        ["1", P_ROHAN, P_MEERA,  "13/10/2024", "21:12:04", "324", "BLR-WF-014", "Whitefield, Bengaluru"],
        ["2", P_ROHAN, P_KABIR,  "13/10/2024", "21:41:55", "118", "BLR-WF-014", "Whitefield, Bengaluru"],
        ["3", P_KABIR, P_ROHAN,  "13/10/2024", "22:08:30",  "46", "BLR-MG-007", "MG Road, Bengaluru"],
        ["4", P_MEERA, P_SAMEER, "13/10/2024", "22:33:11", "207", "MUM-AD-021", "Andheri, Mumbai"],
        ["5", P_ROHAN, P_MEERA,  "13/10/2024", "22:51:09", "512", "BLR-WF-014", "Whitefield, Bengaluru"],
        ["6", P_ROHAN, P_KABIR,  "13/10/2024", "23:05:22", "289", "BLR-WF-014", "Whitefield, Bengaluru"],
        ["7", P_KABIR, P_SAMEER, "14/10/2024", "00:14:48",  "63", "MUM-AD-021", "Andheri, Mumbai"],
        ["8", P_MEERA, P_ROHAN,  "14/10/2024", "08:02:17",  "98", "MUM-AD-021", "Andheri, Mumbai"],
        ["9", P_ROHAN, P_SAMEER, "14/10/2024", "09:30:05", "411", "BLR-WF-014", "Whitefield, Bengaluru"],
        ["10",P_SAMEER,P_MEERA,  "14/10/2024", "10:12:36", "176", "DEL-KB-009", "Karol Bagh, New Delhi"],
        ["11",P_KABIR, P_MEERA,  "14/10/2024", "11:44:02",  "54", "DEL-KB-009", "Karol Bagh, New Delhi"],
        ["12",P_ROHAN, P_MEERA,  "14/10/2024", "12:20:19", "268", "BLR-WF-014", "Whitefield, Bengaluru"],
    ]
    data = [hdr]
    for r in rows:
        data.append([Paragraph(r[0], S["CellR"])] +
                    [Paragraph(c, S["Cell"]) for c in r[1:7]] +
                    [Paragraph(r[7], S["Cell"])])

    col_widths = [8*mm, 28*mm, 28*mm, 22*mm, 20*mm, 16*mm, 22*mm, 34*mm]
    tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#475569")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    H.append(tbl)

    H.append(Spacer(1, 6))
    H.append(Paragraph(
        "Observation: The subscriber " + ROHAN + " (" + P_ROHAN +
        ") made 8 calls to co-accused " + MEERA + " and " + KABIR +
        " between 21:12 and 23:05 on 13 Oct 2024, coinciding with the "
        "reported time of occurrence at " + LOC_WAREHOUSE + ". "
        "Suspect " + SAMEER + " (" + P_SAMEER + ") was in contact with "
        + MEERA + " and " + KABIR + " from Mumbai and Delhi cells.",
        S["Body"]))

    doc.build(
        H,
        onFirstPage=lambda c, d: header_footer(c, d, "CDR — " + P_ROHAN),
        onLaterPages=lambda c, d: header_footer(c, d, "CDR — " + P_ROHAN),
    )
    print("  ✓", os.path.basename(path))


# ════════════════════════════════════════════════════════════════════
# 3. BANK STATEMENT
# ════════════════════════════════════════════════════════════════════

def build_bank(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title="Axis Bank Statement — A/c " + ACCT_ROHAN,
        author="Axis Bank Ltd.",
        subject="Account Statement — sample evidence",
    )
    H = []
    H.append(Paragraph("ACCOUNT STATEMENT", S["DocTitle"]))
    H.append(Paragraph("Axis Bank Ltd. — Retail Banking Division", S["DocSub"]))
    H.append(HRFlowable(width="100%", thickness=1,
                        color=colors.HexColor("#0f172a"), spaceAfter=6))

    H.append(Paragraph("Account Details", S["Section"]))
    H.append(field_table([
        ["Account Holder:", ROHAN],
        ["Account No.:", "A/c No. " + ACCT_ROHAN],
        ["IFSC:", IFSC_ROHAN],
        ["Branch:", "Whitefield, Bengaluru — IFSC " + IFSC_ROHAN],
        ["Account Type:", "Savings"],
        ["Statement Period:", "01 Oct 2024 to 14 Oct 2024"],
        ["Opening Balance:", "Rs. 4,82,310.00"],
    ]))

    H.append(Paragraph("Transaction History", S["Section"]))

    hdr = [Paragraph(x, S["CellH"]) for x in
           ["Txn Date", "Narration", "Debit (Rs.)", "Credit (Rs.)",
            "Balance (Rs.)"]]
    txns = [
        ["08/10/2024", "NEFT-IN  " + SAMEER + " DL01EF9012",        "",       "12,50,000.00", "17,32,310.00"],
        ["10/10/2024", "RTGS-OUT HDFC " + ACCT_MEERA + " " + MEERA,  "25,00,000.00", "",           "1,82,310.00"],
        ["12/10/2024", "IMPS-OUT SBIN " + ACCT_KABIR + " " + KABIR,  "8,50,000.00",  "",           "1,32,310.00"],
        ["13/10/2024", "CASH-WDL Whitefield Warehouse ATM",         "2,00,000.00",  "",           "1,12,310.00"],
        ["13/10/2024", "NEFT-IN  " + MEERA + " " + P_MEERA,         "",       "45,00,000.00", "69,32,310.00"],
        ["14/10/2024", "RTGS-OUT HDFC " + ACCT_MEERA + " " + MEERA,  "45,00,000.00", "",         "24,32,310.00"],
        ["14/10/2024", "IMPS-OUT SBIN " + ACCT_KABIR + " " + KABIR,  "3,75,000.00",  "",           "20,57,310.00"],
    ]
    data = [hdr]
    for r in txns:
        data.append([Paragraph(r[0], S["CellR"])] +
                    [Paragraph(r[1], S["Cell"])] +
                    [Paragraph(r[2], S["CellR"]) if r[2] else Paragraph("", S["CellR"]),
                     Paragraph(r[3], S["CellR"]) if r[3] else Paragraph("", S["CellR"]),
                     Paragraph(r[4], S["CellR"])])

    col_widths = [22*mm, 72*mm, 26*mm, 26*mm, 26*mm]
    tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#475569")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 1), (4, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    H.append(tbl)

    H.append(Spacer(1, 6))
    H.append(Paragraph(
        "Closing Balance: Rs. 20,57,310.00    Total Debits: "
        "Rs. 84,25,000.00    Total Credits: Rs. 1,29,75,000.00",
        S["Field"]))
    H.append(Spacer(1, 4))
    H.append(Paragraph(
        "Suspicious Pattern: Large round-value RTGS transfers to HDFC "
        "account number " + ACCT_MEERA + " (held by co-accused " + MEERA +
        ") and IMPS transfers to SBI account number " + ACCT_KABIR +
        " (held by courier " + KABIR + ") within 96 hours. A cash "
        "withdrawal of Rs. 2,00,000 was made from the Whitefield "
        "Warehouse ATM on 13 Oct 2024 — the reported date of occurrence. "
        "Total outward flow of Rs. 80.75 lakh matches a significant "
        "portion of the estimated fraud value of Rs. 2.5 crore when combined with parallel "
        "transfers from linked accounts.",
        S["Body"]))

    doc.build(
        H,
        onFirstPage=lambda c, d: header_footer(c, d, "Axis Bank Stmt — A/c " + ACCT_ROHAN),
        onLaterPages=lambda c, d: header_footer(c, d, "Axis Bank Stmt — A/c " + ACCT_ROHAN),
    )
    print("  ✓", os.path.basename(path))


# ════════════════════════════════════════════════════════════════════
# 4. VEHICLE REGISTRATION CERTIFICATE (RC)
# ════════════════════════════════════════════════════════════════════

def build_rc(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title="RC — " + V_ROHAN + " — Karnataka RTO",
        author="Karnataka Transport Department",
        subject="Registration Certificate — sample evidence",
    )
    H = []
    H.append(Paragraph("CERTIFICATE OF REGISTRATION", S["DocTitle"]))
    H.append(Paragraph(
        "Form 23 — Central Motor Vehicles Rules, 1989 (Rule 26)",
        S["DocSub"]))
    H.append(HRFlowable(width="100%", thickness=1,
                        color=colors.HexColor("#0f172a"), spaceAfter=6))

    H.append(Paragraph("Registration Details", S["Section"]))
    H.append(field_table([
        ["Registration No.:", V_ROHAN],
        ["Registering Authority:", "RTO Bengaluru East, KA-03"],
        ["Date of Registration:", "06 March 2022"],
        ["Valid Upto:", "05 March 2037"],
        ["Class of Vehicle:", "Motor Car (LMV) — Sedan"],
        ["Maker:", "Hyundai Motor India Ltd."],
        ["Model:", "Verna SX(O) 1.5 Turbo"],
        ["Body Type:", "Saloon / Sedan"],
        ["Fuel Type:", "Petrol"],
        ["Engine No.:", "G4FG-HM2401048K"],
        ["Chassis No.:", "MALBA51PNSM1048729"],
        ["Colour:", "White"],
        ["Seating Capacity:", "5"],
        ["Gross Vehicle Weight:", "1,580 kg"],
    ]))

    H.append(Paragraph("Registered Owner", S["Section"]))
    H.append(field_table([
        ["Owner Name:", ROHAN],
        ["Father's Name:", "Suresh Malhotra"],
        ["Address:", "B-204, Prestige Shantiniketan, Whitefield, Bengaluru — 560048"],
        ["Phone:", P_ROHAN],
    ]))

    H.append(Paragraph("Finance / Hypothecation", S["Section"]))
    H.append(field_table([
        ["Hypothecated To:", "Axis Bank Ltd., Retail Loan Division"],
        ["Loan A/c No.:", "AXRW" + ACCT_ROHAN],
        ["IFSC:", IFSC_ROHAN],
        ["Loan Amount:", "Rs. 12,40,000.00"],
        ["Agreement Date:", "06 March 2022"],
        ["Status:", "Active — hypothecation subsisting"],
    ]))

    H.append(Paragraph("Insurance & Pollution", S["Section"]))
    H.append(field_table([
        ["Insurance Co.:", "ICICI Lombard General Insurance"],
        ["Policy No.:", "3004/BE/2024/" + V_ROHAN.replace(" ", "")],
        ["Valid Upto:", "05 March 2025"],
        ["PUCC No.:", "KA03-PUCC-" + V_ROHAN[-4:]],
        ["PUCC Valid Upto:", "14 October 2025"],
    ]))

    H.append(Paragraph("Linked Persons / Suspect Cross-Reference", S["Section"]))
    H.append(Paragraph(
        "Per ANPR camera logs on 13 Oct 2024, vehicle " + V_ROHAN +
        " was captured at " + LOC_WAREHOUSE + " at 23:08 hrs and at "
        + LOC_INDUSTRIAL + " at 04:12 hrs the following morning. "
        "The owner " + ROHAN + " is Accused-1 in FIR 427/2024 "
        "(Whitefield PS). A second vehicle " + V_MEERA +
        " registered to co-accused " + MEERA + " was also logged at "
        "the same warehouse at 22:45 hrs on 13 Oct 2024. A third vehicle "
        + V_SAMEER + " registered to suspect " + SAMEER +
        " was captured at " + LOC_MARKET + " on 14 Oct 2024.",
        S["Body"]))

    doc.build(
        H,
        onFirstPage=lambda c, d: header_footer(c, d, "RC — " + V_ROHAN),
        onLaterPages=lambda c, d: header_footer(c, d, "RC — " + V_ROHAN),
    )
    print("  ✓", os.path.basename(path))


# ════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("Generating sample evidence PDFs in", OUT_DIR)
    build_fir(os.path.join(OUT_DIR, "sample_fir.pdf"))
    build_cdr(os.path.join(OUT_DIR, "sample_cdr.pdf"))
    build_bank(os.path.join(OUT_DIR, "sample_bank_statement.pdf"))
    build_rc(os.path.join(OUT_DIR, "sample_vehicle_rc.pdf"))
    print("Done.")
