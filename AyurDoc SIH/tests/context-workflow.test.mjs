import test from "node:test";
import assert from "node:assert/strict";
import { deriveWorkflowState, guideMessage } from "../lib/workflow-state.ts";
import { createDocumentEvidence, parseDocumentEvidence, serializeDocumentFeedback } from "../lib/document-evidence.ts";

test("derives next action from the real patient workflow state", () => {
  const context = deriveWorkflowState({
    currentModule: "intake",
    phase: "documents",
    hasIdentity: true,
    hasConsent: true,
    patientInformationComplete: true,
    clinicalInterviewComplete: true,
    documentUploaded: false,
    documentProcessed: false,
    patientConfirmed: false,
    currentCase: null,
    physicianVerified: false,
  });
  assert.equal(context.currentState, "documents");
  assert.equal(context.nextBestAction, "add-or-skip-documents");
  assert.match(guideMessage({ ...context, previousState: "clinical-interview", selectedLanguage: "English", lastAction: "moved-to-documents" }), /upload or photograph/i);
});
test("preserves machine-readable document evidence with human-readable review lines", () => {
  const evidence = createDocumentEvidence({
    documentType: "Laboratory report",
    summary: "One source-linked laboratory value was extracted.",
    confidence: "high",
    findings: [{ kind: "laboratory", label: "Hb", value: "10 g/dL (printed range 12–16)", status: "possible-abnormal", source: "Hb 10 g/dL 12-16" }],
  });
  const encoded = serializeDocumentFeedback(evidence, ["Clinician confirmation required."]);
  const parsed = parseDocumentEvidence(encoded);
  assert.equal(parsed.evidence?.findings[0].source, "Hb 10 g/dL 12-16");
  assert.deepEqual(parsed.displayLines, ["Clinician confirmation required."]);
});
