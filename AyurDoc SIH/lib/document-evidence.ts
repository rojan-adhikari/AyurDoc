import type { ClinicalFinding } from "./document-intelligence";

export type EvidenceStatus = "AI extracted" | "Rule extracted" | "Patient reported" | "Physician verified";
export type DocumentEvidence = {
  schemaVersion: "ayurdoc-document-v1";
  documentType: string;
  recordDate: { value: string; confidence: "low" | "moderate" | "high"; source: string } | null;
  issuingFacility: { value: string; source: string } | null;
  findings: Array<ClinicalFinding & { referenceRange?: string; evidenceStatus: EvidenceStatus }>;
  warnings: string[];
  extractionMethod: "external-ai" | "deterministic-fallback";
  summary: string;
};

const EVIDENCE_PREFIX = "@@AYURDOC_DOCUMENT_EVIDENCE@@";

export function createDocumentEvidence(input: {
  documentType: string;
  summary: string;
  confidence: "low" | "moderate" | "high";
  findings: ClinicalFinding[];
  recordDate?: string;
  issuingFacility?: string;
  warnings?: string[];
  external?: boolean;
}): DocumentEvidence {
  const dateFinding = input.findings.find((item) => item.kind === "date");
  const date = input.recordDate?.trim() || dateFinding?.value || "";
  return {
    schemaVersion: "ayurdoc-document-v1",
    documentType: input.documentType,
    recordDate: date ? { value: date, confidence: input.confidence, source: dateFinding?.source || date } : null,
    issuingFacility: input.issuingFacility?.trim()
      ? { value: input.issuingFacility.trim(), source: input.issuingFacility.trim() }
      : null,
    findings: input.findings.map((item) => ({
      ...item,
      referenceRange: item.kind === "laboratory" ? item.value.match(/(?:printed range|range)\s+([^\)]+)/i)?.[1] : undefined,
      evidenceStatus: input.external ? "AI extracted" : "Rule extracted",
    })),
    warnings: input.warnings ?? [],
    extractionMethod: input.external ? "external-ai" : "deterministic-fallback",
    summary: input.summary,
  };
}

export function serializeDocumentFeedback(evidence: DocumentEvidence, feedback: string[]) {
  return `${EVIDENCE_PREFIX}${JSON.stringify(evidence)}\n${feedback.join("\n")}`;
}

export function parseDocumentEvidence(value: string): { evidence: DocumentEvidence | null; displayLines: string[] } {
  if (!value.startsWith(EVIDENCE_PREFIX)) return { evidence: null, displayLines: value.split("\n").filter(Boolean) };
  const newline = value.indexOf("\n");
  const encoded = newline < 0 ? value.slice(EVIDENCE_PREFIX.length) : value.slice(EVIDENCE_PREFIX.length, newline);
  try {
    return {
      evidence: JSON.parse(encoded) as DocumentEvidence,
      displayLines: newline < 0 ? [] : value.slice(newline + 1).split("\n").filter(Boolean),
    };
  } catch {
    return { evidence: null, displayLines: value.split("\n").filter(Boolean) };
  }
}

export function evidenceDate(evidence: DocumentEvidence | null, fallback = "") {
  const value = evidence?.recordDate?.value?.trim();
  return value || fallback;
}
