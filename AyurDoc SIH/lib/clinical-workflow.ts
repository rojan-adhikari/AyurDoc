import { parseDocumentEvidence } from "./document-evidence.ts";

export type ClinicalIntakeSource = {
  intakeId: number;
  patientUsername: string;
  fullName: string;
  age: number;
  sex: string;
  department: string;
  doctorId: string;
  doctorName: string;
  language: string;
  complaint: string;
  onset: string;
  symptoms: string;
  conditions: string;
  allergies: string;
  narrative?: string;
  documentName?: string;
  documentType?: string;
  documentFeedback?: string;
  answers?: Record<string, string[]>;
  notes?: Record<string, string>;
  consentedAt: string;
};

const RED_FLAG_RULES: Array<{ code: string; pattern: RegExp; label: string }> = [
  { code: "RF-BREATHING", pattern: /breathing difficulty|shortness of breath|breathless(?:ness)?(?: at rest| with minimal activity)?|cannot breathe|सांस|மூச்சு/i, label: "Breathing difficulty" },
  { code: "RF-NEURO", pattern: /faint|confusion|seizure|sudden weakness|speech|face change|बेहोश|வலிப்பு/i, label: "Acute neurological warning sign" },
  { code: "RF-BLEED", pattern: /heavy bleeding|blood in vomit|blood in stool|रक्तस्राव|இரத்த/i, label: "Possible significant bleeding" },
  { code: "RF-PAIN", pattern: /rapidly worsening pain|severe chest|crushing chest|கடுமையான வலி/i, label: "Severe or rapidly worsening pain" },
  { code: "RF-DEHYDRATION", pattern: /severe dehydration|very low urine|reduced urination|unable to keep (?:food|fluids)|निर्जलीकरण/i, label: "Possible dehydration or reduced urine output" },
];

function withoutSimpleNegations(value: string) {
  return value
    .replace(/\b(?:no|not|denies|without)\s+(?:current\s+|any\s+)?(?:chest pain|breathing difficulty|shortness of breath|fainting|confusion|seizure|bleeding|blood in stool|sudden weakness|reduced urination)\b/gi, "");
}

function uuidReference() {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export function createClinicalWorkflow(source: ClinicalIntakeSource) {
  const answer = (key: string) => source.answers?.[key] ?? [];
  const searchable = [
    source.complaint,
    source.symptoms,
    source.narrative,
    ...Object.values(source.answers ?? {}).flat(),
    ...Object.values(source.notes ?? {}),
  ].join(" | ");
  const safetySearchable = withoutSimpleNegations(searchable);
  const redFlags = RED_FLAG_RULES.filter((rule) => rule.pattern.test(safetySearchable)).map(
    ({ code, label }) => ({ code, label, source: "patient-reported" }),
  );
  const required = [
    source.fullName,
    source.age,
    source.sex,
    source.department,
    source.doctorId,
    source.complaint,
    source.onset,
    source.symptoms,
    source.conditions,
    source.allergies,
    source.consentedAt,
  ];
  const answeredRequired = required.filter((value) => String(value ?? "").trim()).length;
  const completenessScore = Math.round((answeredRequired / required.length) * 100);
  const focusedPathway = Object.entries(source.answers ?? {})
    .filter(([key]) => key.endsWith("_pathway"))
    .flatMap(([, values]) => values);
  const parsedDocument = parseDocumentEvidence(source.documentFeedback ?? "");
  const structured = {
    schemaVersion: "ayurdoc-clinical-v1",
    recordId: `clinical-${source.intakeId}`,
    source: "patient-entered-and-machine-structured",
    subject: {
      localPatientId: source.patientUsername,
      name: source.fullName,
      age: source.age,
      sex: source.sex,
    },
    encounter: {
      intakeId: source.intakeId,
      language: source.language,
      department: source.department,
      assignedPractitioner: { id: source.doctorId, name: source.doctorName },
      consentedAt: source.consentedAt,
    },
    history: {
      chiefComplaint: source.complaint,
      onsetAndCourse: source.onset,
      associatedAndAyurvedicHistory: source.symptoms,
      pastConditions: source.conditions,
      medicinesAndAllergies: source.allergies,
      patientNarrative: source.narrative ?? "",
      questionnaireAnswers: source.answers ?? {},
      answerNotes: source.notes ?? {},
    },
    ayurvedaAssessment: {
      patientReported: {
        agni: answer("agni"),
        koshtha: answer("koshtha"),
        aharaVihara: answer("ahara"),
        nidra: answer("nidra"),
        malaMutra: answer("mala_mutra"),
        perceivedPrakritiVikritiTendency: answer("deha"),
        satmya: answer("satmya"),
        sattva: answer("sattva"),
        aharaShakti: answer("ahara_shakti"),
        vyayamaShakti: answer("vyayama_shakti"),
        vaya: source.age,
      },
      vaidyaExaminationRequired: [
        "Prakriti",
        "Vikriti",
        "Sara",
        "Samhanana",
        "Pramana",
        "Nadi",
        "Jihva",
        "Sparshana",
        "Darshana",
        "Samprapti",
      ],
      status: "patient-history-complete-clinician-examination-pending",
    },
    documentEvidence: source.documentName
      ? {
          fileName: source.documentName,
          classifiedType: source.documentType || "Medical record",
          extraction: parsedDocument.evidence,
          assistedReview: parsedDocument.displayLines,
          verificationStatus: "unverified",
        }
      : null,
    triage: {
      level: redFlags.length ? "priority-review" : "routine-review",
      redFlags,
      disclaimer: "Decision support only; a licensed clinician must verify all findings.",
    },
    provenance: {
      createdAt: new Date().toISOString(),
      completenessScore,
      humanConfirmationRequired: true,
      evidenceSources: [
        { type: "patient-questionnaire", status: "patient-reported" },
        ...(source.narrative ? [{ type: "patient-narrative", status: "patient-reported" }] : []),
        ...(source.documentName
          ? [{ type: "uploaded-document", fileName: source.documentName, status: "unverified-extraction" }]
          : []),
      ],
    },
  };

  const physicianSummary = [
    `${source.fullName}, ${source.age}-year-old ${source.sex.toLowerCase()}, reports ${source.complaint.toLowerCase()} (${source.onset.toLowerCase()}).`,
    focusedPathway.length ? `Complaint-specific findings: ${focusedPathway.join(", ")}.` : "No complaint-specific pathway finding was recorded.",
    `Associated and Ayurvedic history: ${source.symptoms}.`,
    `Dashavidha patient-reported context: Satmya—${answer("satmya").join(", ") || "not recorded"}; Sattva—${answer("sattva").join(", ") || "not recorded"}; Ahara Shakti—${answer("ahara_shakti").join(", ") || "not recorded"}; Vyayama Shakti—${answer("vyayama_shakti").join(", ") || "not recorded"}. Prakriti, Vikriti, Sara, Samhanana, Pramana and Samprapti remain for Vaidya examination.`,
    `Known conditions: ${source.conditions}. Medicines/allergies: ${source.allergies}.`,
    redFlags.length
      ? `PRIORITY: ${redFlags.map((item) => item.label).join(", ")}; verify immediately.`
      : "No configured emergency warning sign was selected; clinician verification remains required.",
    source.documentName
      ? `Attached evidence: ${source.documentName} (${source.documentType || "medical record"}); extracted content is unverified.`
      : "No previous medical document was attached.",
  ].join("\n");

  const patientRef = uuidReference();
  const encounterRef = uuidReference();
  const compositionRef = uuidReference();
  const questionnaireRef = uuidReference();
  const consentRef = uuidReference();
  const fhirBundle = {
    resourceType: "Bundle",
    id: `ayurdoc-intake-${source.intakeId}`,
    type: "document",
    timestamp: new Date().toISOString(),
    identifier: { system: "https://ayurdoc.medzone.in/intakes", value: String(source.intakeId) },
    entry: [
      {
        fullUrl: compositionRef,
        resource: {
          resourceType: "Composition",
          id: `composition-${source.intakeId}`,
          status: "preliminary",
          type: { text: "Clinical intake summary" },
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          date: new Date().toISOString(),
          author: [{ reference: `Practitioner/${source.doctorId}`, display: source.doctorName }],
          title: "AyurDoc patient-entered clinical intake",
          section: [
            { title: "Chief complaint", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeFhirText(source.complaint)}</div>` } },
            { title: "Clinical summary", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeFhirText(physicianSummary)}</div>` } },
          ],
        },
      },
      {
        fullUrl: patientRef,
        resource: {
          resourceType: "Patient",
          id: `patient-${source.intakeId}`,
          identifier: [{ system: "https://ayurdoc.medzone.in/patients", value: source.patientUsername }],
          name: [{ text: source.fullName }],
          gender: source.sex === "Male" ? "male" : source.sex === "Female" ? "female" : "unknown",
        },
      },
      {
        fullUrl: encounterRef,
        resource: {
          resourceType: "Encounter",
          id: `encounter-${source.intakeId}`,
          status: "planned",
          class: { code: "AMB", display: "ambulatory" },
          subject: { reference: patientRef },
          serviceType: { text: source.department },
          participant: [{ individual: { reference: `Practitioner/${source.doctorId}`, display: source.doctorName } }],
        },
      },
      {
        fullUrl: questionnaireRef,
        resource: {
          resourceType: "QuestionnaireResponse",
          id: `questionnaire-${source.intakeId}`,
          status: "completed",
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          authored: source.consentedAt,
          item: Object.entries(source.answers ?? {}).map(([linkId, values]) => ({
            linkId,
            answer: values.map((value) => ({ valueString: value })),
          })),
        },
      },
      {
        fullUrl: consentRef,
        resource: {
          resourceType: "Consent",
          id: `consent-${source.intakeId}`,
          status: "active",
          scope: { text: "Patient-entered pre-consultation clinical intake" },
          category: [{ text: "Clinical data processing and physician review" }],
          patient: { reference: patientRef },
          dateTime: source.consentedAt,
          provision: { type: "permit" },
        },
      },
      ...(source.documentName
        ? [{
            fullUrl: uuidReference(),
            resource: {
              resourceType: "DocumentReference",
              id: `document-${source.intakeId}`,
              status: "current",
              subject: { reference: patientRef },
              context: { encounter: [{ reference: encounterRef }] },
              content: [{
                attachment: {
                  title: source.documentName,
                  contentType: "application/octet-stream",
                },
              }],
              description: `${source.documentType || "Medical record"}; machine extraction is unverified and requires clinician review.`,
            },
          }]
        : []),
      ...redFlags.map((flag, index) => ({
        fullUrl: uuidReference(),
        resource: {
          resourceType: "Flag",
          id: `flag-${source.intakeId}-${index + 1}`,
          status: "active",
          category: [{ text: "Clinical safety" }],
          code: { coding: [{ system: "https://ayurdoc.medzone.in/red-flags", code: flag.code }], text: flag.label },
          subject: { reference: patientRef },
        },
      })),
    ],
  };

  return { structured, physicianSummary, fhirBundle, redFlags, completenessScore };
}

function escapeFhirText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
