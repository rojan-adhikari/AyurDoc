import assert from "node:assert/strict";
import test from "node:test";

import { analyzeClinicalText } from "../lib/document-intelligence.ts";
import { createClinicalWorkflow } from "../lib/clinical-workflow.ts";

test("extracts source-linked prescription, laboratory and timeline findings", () => {
  const result = analyzeClinicalText(`
    Laboratory Report 08/09/2026
    Haemoglobin: 8.4 g/dL (12-16)
    Creatinine: 1.0 mg/dL (0.6-1.2)
    Tablet Amoxicillin 500 mg twice daily
    Diagnosis: iron deficiency anaemia
  `);

  assert.equal(result.documentType, "Prescription / medication record");
  assert.ok(result.findings.some((item) => item.kind === "medicine"));
  assert.ok(result.findings.some((item) => item.kind === "diagnosis"));
  assert.ok(result.findings.some((item) => item.kind === "laboratory" && item.status === "possible-abnormal"));
  assert.deepEqual(result.timelineDates, ["08/09/2026"]);
});

test("creates a clinician-gated Ayurveda record with consent and document provenance", () => {
  const result = createClinicalWorkflow({
    intakeId: 42,
    patientUsername: "patient",
    fullName: "Demo Patient",
    age: 40,
    sex: "Male",
    department: "Kayachikitsa",
    doctorId: "kaya-01",
    doctorName: "Dr Demo",
    language: "English",
    complaint: "Digestive complaint",
    onset: "2–3 days ago",
    symptoms: "Bloating",
    conditions: "None known",
    allergies: "None known",
    narrative: "No chest pain",
    documentName: "lab-report.txt",
    documentType: "Laboratory report",
    documentFeedback: "Haemoglobin requires review",
    answers: {
      satmya: ["Sensitive to spicy or oily food"],
      sattva: ["Mild worry or irritability"],
      ahara_shakti: ["Only a small meal feels comfortable"],
      vyayama_shakti: ["Normal daily activity and exercise"],
    },
    consentedAt: "2026-09-09T10:00:00.000Z",
  });

  assert.equal(result.redFlags.length, 0);
  assert.deepEqual(result.structured.ayurvedaAssessment.patientReported.satmya, ["Sensitive to spicy or oily food"]);
  assert.ok(result.structured.ayurvedaAssessment.vaidyaExaminationRequired.includes("Nadi"));
  const resourceTypes = result.fhirBundle.entry.map((entry) => entry.resource.resourceType);
  assert.ok(resourceTypes.includes("Consent"));
  assert.ok(resourceTypes.includes("DocumentReference"));
});
