"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, LoaderCircle, Pill, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MedicationLabelSummary } from "@/lib/medication-safety";

type MedicationSafetyResponse = {
  results?: MedicationLabelSummary[];
  error?: string;
  source?: { name: string; url: string; limitation: string };
};

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) as MedicationSafetyResponse : {}; }
  catch { return {} as MedicationSafetyResponse; }
}

function SafetySection({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return <div className="medication-safety-section"><strong>{label}</strong>{values.map((value, index) => <p key={`${label}-${index}`}>{value}</p>)}</div>;
}

export function MedicationSafetyPanel() {
  const [medicineText, setMedicineText] = useState("");
  const [result, setResult] = useState<MedicationSafetyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkLabels() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/medication-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicines: medicineText }),
      });
      const data = await readJson(response);
      setResult(response.ok ? data : { error: data.error || "Medication labels could not be checked." });
    } catch {
      setResult({ error: "Medication-label service is temporarily unavailable." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="medication-safety-panel">
      <header>
        <div className="medication-safety-icon"><Pill size={22} /></div>
        <div><span>Official label evidence</span><h3>Medication safety review</h3><p>Check up to five allopathic medicine names against current FDA product labels before confirming the case.</p></div>
      </header>
      <div className="medication-safety-controls">
        <label><span>Medicine names</span><Textarea value={medicineText} onChange={(event) => setMedicineText(event.target.value)} rows={2} placeholder="Enter one medicine per line, for example: warfarin, aspirin" /></label>
        <Button type="button" onClick={() => void checkLabels()} disabled={loading || medicineText.trim().length < 2}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Check official labels
        </Button>
      </div>
      {result?.error && <div className="medication-safety-error" role="alert"><AlertTriangle size={17} />{result.error}</div>}
      {result?.results?.length ? <div className="medication-label-results">
        {result.results.map((item) => <article key={item.requestedName} className={`status-${item.status}`}>
          <div className="medication-label-head"><div><strong>{item.requestedName}</strong><span>{item.status === "found" ? item.officialNames.join(" · ") || "FDA label found" : item.status === "not-found" ? "No matching U.S. label found—check spelling or verify manually" : "Label service temporarily unavailable"}</span></div><em>{item.status}</em></div>
          {item.mentionedMedicines.length > 0 && <div className="medication-pair-signal"><AlertTriangle size={16} /><span>The label text mentions another entered medicine: <strong>{item.mentionedMedicines.join(", ")}</strong>. Review the exact warning below.</span></div>}
          <SafetySection label="Drug interactions" values={item.interactionWarnings} />
          <SafetySection label="Boxed warning" values={item.boxedWarnings} />
          <SafetySection label="Contraindications" values={item.contraindications} />
          <SafetySection label="Warnings and precautions" values={item.warnings} />
          {item.status === "found" && <small>Manufacturer: {item.manufacturer} · Label effective date: {item.effectiveDate}</small>}
        </article>)}
      </div> : null}
      <footer><ShieldCheck size={15} /><span>Decision support only. Absence of a warning does not prove safety. Verify with a qualified doctor or pharmacist.</span><a href="https://open.fda.gov/apis/drug/label/" target="_blank" rel="noreferrer">About the source <ExternalLink size={13} /></a></footer>
    </section>
  );
}
