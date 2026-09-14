export type ClinicalFinding = {
  kind: "medicine" | "laboratory" | "date" | "diagnosis";
  label: string;
  value: string;
  status: "review" | "possible-abnormal";
  source: string;
};

export type ClinicalTextAnalysis = {
  documentType: string;
  findings: ClinicalFinding[];
  timelineDates: string[];
  confidence: "low" | "moderate" | "high";
};

const MEDICINE_LINE = /(?:tab(?:let)?|cap(?:sule)?|syr(?:up)?|inj(?:ection)?|medicine|rx)\.?\s*[:\-]?\s*([^\n,;]{2,80})/gi;
const LAB_LINE = /\b(ha?emoglobin|hb|glucose|creatinine|urea|platelets?|wbc|rbc|tsh|cholesterol|triglycerides?)\b\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z/%µ]+)?(?:\s*\(?\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)?)?/gi;
const DATE_TOKEN = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|\d{4})|(?:\d{1,2}\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4})\b/gi;
const DIAGNOSIS_LINE = /(?:diagnosis|diagnoses|impression|assessment)\s*[:\-]\s*([^\n]{3,140})/gi;

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function addUnique(findings: ClinicalFinding[], finding: ClinicalFinding) {
  const key = `${finding.kind}:${finding.label}:${finding.value}`.toLowerCase();
  if (!findings.some((item) => `${item.kind}:${item.label}:${item.value}`.toLowerCase() === key)) findings.push(finding);
}

/**
 * Deterministic extraction for machine-readable prescriptions and reports.
 * Every result remains unverified and includes its source text so a clinician
 * can correct it instead of treating OCR output as a clinical fact.
 */
export function analyzeClinicalText(input: string): ClinicalTextAnalysis {
  const text = input.replace(/\r/g, "\n").slice(0, 60_000);
  const findings: ClinicalFinding[] = [];

  for (const match of text.matchAll(MEDICINE_LINE)) {
    addUnique(findings, {
      kind: "medicine",
      label: "Possible medicine instruction",
      value: compact(match[1]).slice(0, 120),
      status: "review",
      source: compact(match[0]).slice(0, 180),
    });
  }

  for (const match of text.matchAll(LAB_LINE)) {
    const numericValue = Number(match[2]);
    const lower = match[4] ? Number(match[4]) : null;
    const upper = match[5] ? Number(match[5]) : null;
    const outsideRange = lower !== null && upper !== null && (numericValue < lower || numericValue > upper);
    addUnique(findings, {
      kind: "laboratory",
      label: compact(match[1]),
      value: `${match[2]}${match[3] ? ` ${match[3]}` : ""}${lower !== null && upper !== null ? ` (printed range ${lower}–${upper})` : ""}`,
      status: outsideRange ? "possible-abnormal" : "review",
      source: compact(match[0]).slice(0, 180),
    });
  }

  for (const match of text.matchAll(DIAGNOSIS_LINE)) {
    addUnique(findings, {
      kind: "diagnosis",
      label: "Documented assessment",
      value: compact(match[1]).slice(0, 180),
      status: "review",
      source: compact(match[0]).slice(0, 220),
    });
  }

  const timelineDates = Array.from(new Set(Array.from(text.matchAll(DATE_TOKEN), (match) => compact(match[0])))).slice(0, 12);
  timelineDates.forEach((date) => addUnique(findings, {
    kind: "date",
    label: "Possible record date",
    value: date,
    status: "review",
    source: date,
  }));

  const lowerText = text.toLowerCase();
  const documentType = /prescription|medicine|tablet|capsule|\brx\b/.test(lowerText)
    ? "Prescription / medication record"
    : /\becg\b|electrocardiogram|sinus rhythm|ventricular rate/.test(lowerText)
      ? "ECG report"
    : /lab|pathology|ha?emoglobin|glucose|creatinine|platelet|cbc|lipid/.test(lowerText)
      ? "Laboratory report"
      : /previous consultation|consultation note|clinical note|follow[- ]?up visit/.test(lowerText)
        ? "Previous consultation record"
      : /discharge|admission|hospital course|procedure/.test(lowerText)
        ? "Discharge summary"
        : /x-?ray|ct scan|mri|ultrasound|sonography|radiology/.test(lowerText)
          ? "Imaging / radiology record"
          : "Medical record";

  return {
    documentType,
    findings: findings.slice(0, 30),
    timelineDates,
    confidence: findings.length >= 5 ? "high" : findings.length >= 2 ? "moderate" : "low",
  };
}
