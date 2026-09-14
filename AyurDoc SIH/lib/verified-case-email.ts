export type CaseEmailEnvironment = {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

export type VerifiedCaseReport = {
  intakeId: number;
  patientName: string;
  patientUsername: string;
  patientEmail: string;
  age: number;
  sex: string;
  phone: string;
  address: string;
  abhaNumber: string;
  abhaAddress: string;
  abhaStatus: string;
  language: string;
  department: string;
  doctorName: string;
  doctorId: string;
  complaint: string;
  onset: string;
  symptoms: string;
  conditions: string;
  allergies: string;
  narrative: string;
  documentName: string;
  documentType: string;
  documentFeedback: string;
  physicianSummary: string;
  physicianNote: string;
  reviewedBy: string;
  consentedAt: string;
  verifiedAt: string;
};

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: unknown, width = 86) {
  const clean = ascii(value) || "Not provided";
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) current = candidate;
    else {
      if (current) lines.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type ReportLine = { text: string; kind: "section" | "field" | "body" | "space" };

function reportLines(report: VerifiedCaseReport): ReportLine[] {
  const lines: ReportLine[] = [];
  const section = (text: string) => lines.push({ text, kind: "section" });
  const field = (label: string, value: unknown) =>
    wrap(`${label}: ${ascii(value) || "Not provided"}`).forEach((text) => lines.push({ text, kind: "field" }));
  const body = (value: unknown) => wrap(value).forEach((text) => lines.push({ text, kind: "body" }));
  const space = () => lines.push({ text: "", kind: "space" });

  section("PATIENT & HEALTH IDENTITY");
  field("Patient", report.patientName);
  field("Username", `@${report.patientUsername}`);
  field("Age / sex", `${report.age} years / ${report.sex}`);
  field("Phone", report.phone);
  field("Address", report.address);
  field("ABHA number", report.abhaNumber);
  field("ABHA address", report.abhaAddress);
  field("ABHA verification", report.abhaStatus);
  space();

  section("ROUTING & ENCOUNTER");
  field("Case ID", `AYD-${String(report.intakeId).padStart(6, "0")}`);
  field("Language", report.language);
  field("Department", report.department);
  field("Assigned Vaidya", report.doctorName);
  field("Doctor ID", report.doctorId);
  field("Patient consented", report.consentedAt);
  space();

  section("PATIENT-REPORTED CLINICAL HISTORY");
  field("Main complaint", report.complaint);
  field("Onset", report.onset);
  field("Symptoms and Ayurvedic history", report.symptoms);
  field("Known conditions", report.conditions);
  field("Medicines / allergies", report.allergies);
  field("Patient narrative", report.narrative);
  space();

  section("MEDICAL DOCUMENT REVIEW");
  field("Document", report.documentName);
  field("Document type", report.documentType);
  field("Assisted review", report.documentFeedback);
  space();

  section("PHYSICIAN-VERIFIED SUMMARY");
  body(report.physicianSummary);
  space();
  field("Physician note", report.physicianNote);
  field("Verified by", `@${report.reviewedBy}`);
  field("Verified at", report.verifiedAt);
  space();

  section("IMPORTANT");
  body("This document records patient-provided information and the Vaidya's review in AyurDoc. It is intended for continuity of care. Treatment and prescriptions must follow the examining clinician's signed advice.");
  return lines;
}

function pageContent(lines: ReportLine[], report: VerifiedCaseReport, page: number, total: number) {
  const commands = [
    "q 0.047 0.424 0.365 rg 0 770 595 72 re f Q",
    "BT /F2 21 Tf 1 1 1 rg 42 808 Td (AyurDoc) Tj ET",
    "BT /F1 9 Tf 0.88 1 0.97 rg 42 789 Td (Physician-Verified Clinical Report) Tj ET",
    `BT /F1 8 Tf 0.28 0.36 0.34 rg 42 32 Td (Case AYD-${String(report.intakeId).padStart(6, "0")}  |  Page ${page} of ${total}  |  Med Zone) Tj ET`,
  ];
  let y = 742;
  for (const line of lines) {
    if (line.kind === "space") { y -= 7; continue; }
    if (line.kind === "section") {
      y -= 5;
      commands.push(`BT /F2 11 Tf 0.047 0.424 0.365 rg 42 ${y} Td (${pdfEscape(line.text)}) Tj ET`);
      y -= 17;
      continue;
    }
    const font = line.kind === "field" ? "/F1 9.5" : "/F1 9.5";
    commands.push(`BT ${font} Tf 0.16 0.25 0.23 rg 42 ${y} Td (${pdfEscape(line.text)}) Tj ET`);
    y -= 14;
  }
  return commands.join("\n");
}

export function createVerifiedCasePdf(report: VerifiedCaseReport) {
  const lines = reportLines(report);
  const pages: ReportLine[][] = [];
  let current: ReportLine[] = [];
  let used = 0;
  for (const line of lines) {
    const height = line.kind === "section" ? 25 : line.kind === "space" ? 7 : 14;
    if (used + height > 680 && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += height;
  }
  if (current.length) pages.push(current);

  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((pageLines, index) => {
    const contentNumber = 5 + index * 2;
    const pageNumber = contentNumber + 1;
    pageObjectNumbers.push(pageNumber);
    const content = pageContent(pageLines, report, index + 1, pages.length);
    objects[contentNumber] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = new TextEncoder().encode(pdf).length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1)
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function brandedSender(configured: string) {
  const match = configured.match(/<([^>]+)>/);
  const address = match?.[1] || configured.trim();
  return `AyurDoc <${address}>`;
}

export async function sendVerifiedCaseEmail(report: VerifiedCaseReport, emailEnv: CaseEmailEnvironment) {
  if (!report.patientEmail)
    return { status: "not-sent", reason: "Patient account has no registered email address." } as const;
  if (!emailEnv.RESEND_API_KEY || !emailEnv.RESEND_FROM_EMAIL)
    return { status: "not-sent", reason: "Email delivery is not configured." } as const;

  const caseCode = `AYD-${String(report.intakeId).padStart(6, "0")}`;
  const pdf = createVerifiedCasePdf(report);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: brandedSender(emailEnv.RESEND_FROM_EMAIL),
      to: [report.patientEmail],
      subject: `AyurDoc verified clinical report · ${caseCode}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;color:#173f38"><div style="border-radius:18px 18px 0 0;background:#0c6c5d;padding:24px;color:white"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Physician-verified record</div><h1 style="margin:8px 0 0;font-size:27px">AyurDoc clinical report</h1></div><div style="border:1px solid #d7e7e2;border-top:0;border-radius:0 0 18px 18px;padding:24px"><p style="font-size:16px;line-height:1.6">Hello ${htmlEscape(report.patientName)},</p><p style="font-size:15px;line-height:1.65">Your clinical case has been reviewed and confirmed by the assigned Vaidya. The attached PDF contains your identity details, ABHA status, clinical history, document review, routing information and physician-verified summary.</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:10px;background:#f1f8f6;color:#60736e">Case ID</td><td style="padding:10px;background:#f1f8f6;font-weight:700">${caseCode}</td></tr><tr><td style="padding:10px;color:#60736e">Vaidya</td><td style="padding:10px;font-weight:700">${htmlEscape(report.doctorName)}</td></tr><tr><td style="padding:10px;background:#f1f8f6;color:#60736e">Department</td><td style="padding:10px;background:#f1f8f6;font-weight:700">${htmlEscape(report.department)}</td></tr><tr><td style="padding:10px;color:#60736e">Verified</td><td style="padding:10px;font-weight:700">${htmlEscape(report.verifiedAt)}</td></tr></table><p style="font-size:13px;line-height:1.5;color:#6a7d77">Keep this report for continuity of care. Clinical treatment remains subject to examination and the clinician's signed prescription.</p><p style="margin-top:24px;font-size:13px;color:#6a7d77">Med Zone · AyurDoc</p></div></div>`,
      attachments: [{
        filename: `AyurDoc-${caseCode}-Verified-Report.pdf`,
        content: toBase64(pdf),
      }],
    }),
  });
  const provider = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !provider.id)
    return { status: "failed", reason: provider.error?.message || provider.message || "Email provider rejected the report." } as const;
  return { status: "sent", providerId: provider.id } as const;
}
