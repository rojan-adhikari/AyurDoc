"use client";

import { CalendarDays, ExternalLink, FileText, History, Stethoscope } from "lucide-react";
import { evidenceDate, parseDocumentEvidence, type DocumentEvidence } from "@/lib/document-evidence";

export type HistoryRecord = {
  id: number;
  patient_username: string;
  full_name: string;
  complaint: string;
  onset: string;
  department: string;
  doctor_name: string;
  document_name: string;
  document_type: string;
  document_feedback: string;
  document_file_id: number | null;
  created_at: string;
  status: string;
};

function displayDate(record: HistoryRecord, evidence: DocumentEvidence | null) {
  const sourceDate = evidenceDate(evidence);
  if (sourceDate) return { value: sourceDate, uncertain: evidence?.recordDate?.confidence !== "high" };
  return { value: new Date(record.created_at).toLocaleDateString(), uncertain: true };
}

function timestamp(record: HistoryRecord) {
  const extracted = evidenceDate(parseDocumentEvidence(record.document_feedback).evidence);
  const parsed = Date.parse(extracted || record.created_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MedicalTimeline({ records, title = "Longitudinal medical timeline" }: { records: HistoryRecord[]; title?: string }) {
  const ordered = [...records].sort((a, b) => timestamp(b) - timestamp(a));
  return (
    <section className="medical-timeline-panel">
      <div className="timeline-panel-head">
        <div><History size={20} /><span><strong>{title}</strong><small>Facts remain linked to their source record</small></span></div>
        <span className="evidence-status patient-reported">Patient reported</span>
      </div>
      {!ordered.length ? (
        <p className="timeline-empty-copy">No previous clinical records are available yet.</p>
      ) : (
        <div className="medical-timeline-list">
          {ordered.map((record) => {
            const evidence = parseDocumentEvidence(record.document_feedback).evidence;
            const date = displayDate(record, evidence);
            return (
              <article key={record.id}>
                <span className="timeline-dot" />
                <div className="timeline-date"><CalendarDays size={14} /> {date.value}{date.uncertain ? " · date uncertain" : ""}</div>
                <div className="timeline-event">
                  <strong>{record.document_name ? evidence?.documentType || record.document_type || "Medical document" : "Consultation"}</strong>
                  <p>{record.document_name ? evidence?.summary || `Original document: ${record.document_name}` : `${record.complaint} · ${record.onset}`}</p>
                  <small>Case #{record.id} · {record.department} · {record.doctor_name || "Unassigned"}</small>
                  {record.document_file_id && (
                    <a href={`/api/documents?intakeId=${record.id}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open source document</a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function RelevantPreviousHistory({ current, records }: { current: HistoryRecord; records: HistoryRecord[] }) {
  const previous = records
    .filter((item) => item.id !== current.id && item.patient_username === current.patient_username)
    .sort((a, b) => timestamp(b) - timestamp(a));
  return (
    <section className="relevant-history-panel">
      <div className="timeline-panel-head">
        <div><Stethoscope size={20} /><span><strong>Relevant previous history</strong><small>Historical records—not the patient&apos;s current diagnosis</small></span></div>
        <span className="evidence-status ai-extracted">AI extracted</span>
      </div>
      {!previous.length ? <p className="timeline-empty-copy">No earlier records were found for this patient.</p> : (
        <div className="previous-record-grid">
          {previous.slice(0, 6).map((record) => {
            const evidence = parseDocumentEvidence(record.document_feedback).evidence;
            const date = displayDate(record, evidence);
            return (
              <article key={record.id}>
                <FileText size={18} />
                <div><strong>Related previous record — {date.value}</strong><p>{record.complaint}</p><small>{record.document_name ? `${record.document_type || "Document"} available` : "Previous consultation available"}</small></div>
                {record.document_file_id && <a href={`/api/documents?intakeId=${record.id}`} target="_blank" rel="noreferrer" aria-label="Open source document"><ExternalLink size={16} /></a>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DoctorCaseContext({ record, structuredRecord, physicianSummary, verified }: {
  record: HistoryRecord & { symptoms: string; conditions: string; allergies: string; narrative: string; red_flag: number | boolean };
  structuredRecord?: Record<string, unknown>;
  physicianSummary: string;
  verified: boolean;
}) {
  const history = (structuredRecord?.history ?? {}) as Record<string, unknown>;
  const ayurveda = ((structuredRecord?.ayurvedaAssessment as Record<string, unknown> | undefined)?.patientReported ?? {}) as Record<string, unknown>;
  const text = (value: unknown, fallback = "Not reported") => Array.isArray(value) ? value.join(", ") || fallback : String(value || fallback);
  return (
    <section className="doctor-case-context">
      <div className="timeline-panel-head">
        <div><Stethoscope size={20} /><span><strong>Doctor consultation context</strong><small>Current case separated from historical and machine-generated evidence</small></span></div>
        <span className={`evidence-status ${verified ? "physician-verified" : "ai-generated"}`}>{verified ? "Physician verified" : "AI generated"}</span>
      </div>
      <div className="context-status-legend">
        <span className="evidence-status patient-reported">Patient reported</span>
        <span className="evidence-status ai-extracted">AI extracted</span>
        <span className="evidence-status ai-generated">AI generated</span>
        <span className="evidence-status physician-verified">Physician verified</span>
      </div>
      <div className="doctor-context-grid">
        <article><span>Chief complaint</span><strong>{text(history.chiefComplaint, record.complaint)}</strong><small>Patient reported</small></article>
        <article><span>HPI · onset and course</span><strong>{text(history.onsetAndCourse, record.onset)}</strong><small>Patient reported</small></article>
        <article><span>Past medical / surgical history</span><strong>{text(history.pastConditions, record.conditions)}</strong><small>Patient reported</small></article>
        <article><span>Drug history & allergies</span><strong>{text(history.medicinesAndAllergies, record.allergies)}</strong><small>Patient reported</small></article>
        <article><span>Family / personal history</span><strong>{text((history.questionnaireAnswers as Record<string, unknown> | undefined)?.family_personal)}</strong><small>Patient reported</small></article>
        <article><span>ROS / associated symptoms</span><strong>{text(history.associatedAndAyurvedicHistory, record.symptoms)}</strong><small>Patient reported</small></article>
        <article className={record.red_flag ? "context-red-flag" : ""}><span>Deterministic red flags</span><strong>{record.red_flag ? "Priority review signal detected" : "No configured warning sign selected"}</strong><small>Rules based · clinician verification required</small></article>
        <article><span>Patient narrative</span><strong>{text(history.patientNarrative, record.narrative || "Not reported")}</strong><small>Patient reported</small></article>
      </div>
      <div className="dashavidha-context">
        <strong>AYUSH / Dashavidha patient-reported context</strong>
        <div>{Object.entries(ayurveda).map(([key, value]) => <span key={key}><small>{key.replaceAll(/([A-Z])/g, " $1")}</small><b>{text(value)}</b></span>)}</div>
        <p>Prakriti, Vikriti, Nadi, Jihva, Sparshana and other clinician examinations remain for the Vaidya; they are not inferred here.</p>
      </div>
      <div className="generated-summary-context">
        <span className="evidence-status ai-generated">AI generated</span>
        <strong>Current consultation summary</strong>
        <pre>{physicianSummary || "Summary is being prepared."}</pre>
      </div>
    </section>
  );
}
