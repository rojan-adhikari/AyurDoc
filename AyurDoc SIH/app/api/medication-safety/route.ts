import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import {
  missingMedicationLabel,
  parseMedicineNames,
  summarizeOpenFdaLabel,
  type OpenFdaDrugLabel,
} from "../../../lib/medication-safety";

type OpenFdaResponse = { results?: OpenFdaDrugLabel[] };

async function fetchLabel(name: string, allMedicines: string[]) {
  try {
    let response: Response | null = null;
    for (const field of ["openfda.generic_name", "openfda.brand_name"]) {
      const url = new URL("https://api.fda.gov/drug/label.json");
      url.searchParams.set("search", `${field}:"${name}"`);
      url.searchParams.set("limit", "1");
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 3600, cacheEverything: true },
      } as RequestInit);
      if (response.ok || response.status !== 404) break;
    }
    if (!response || response.status === 404) return missingMedicationLabel(name);
    if (!response.ok) return missingMedicationLabel(name, true);
    const payload = await response.json() as OpenFdaResponse;
    const label = payload.results?.[0];
    return label ? summarizeOpenFdaLabel(name, label, allMedicines) : missingMedicationLabel(name);
  } catch {
    return missingMedicationLabel(name, true);
  }
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || (session.role !== "doctor" && session.role !== "admin"))
    return Response.json({ error: "Doctor or administrator sign-in required." }, { status: 403 });

  const payload = await request.json().catch(() => null) as null | { medicines?: string[] | string };
  const medicines = parseMedicineNames(payload?.medicines ?? []);
  if (!medicines.length)
    return Response.json({ error: "Enter at least one medicine name." }, { status: 400 });

  const results = await Promise.all(medicines.map((name) => fetchLabel(name, medicines)));
  try {
    await env.DB.prepare(
      `INSERT INTO audit_events (actor_username, actor_role, action, resource_type, resource_id, detail_json)
       VALUES (?, ?, 'medication-label.reviewed', 'MedicationKnowledge', ?, ?)`,
    ).bind(session.username, session.role, crypto.randomUUID(), JSON.stringify({ medicineCount: medicines.length, source: "openFDA" })).run();
  } catch {
    // A label review remains useful if the optional audit write is temporarily unavailable.
  }

  return Response.json({
    results,
    source: {
      name: "openFDA drug product labeling",
      url: "https://open.fda.gov/apis/drug/label/",
      limitation: "Official labeling support, not a complete drug-interaction clearance. A doctor or pharmacist must verify every decision.",
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
