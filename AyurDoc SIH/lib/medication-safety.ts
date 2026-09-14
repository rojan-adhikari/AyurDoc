export type OpenFdaDrugLabel = {
  id?: string;
  set_id?: string;
  effective_time?: string;
  openfda?: {
    generic_name?: string[];
    brand_name?: string[];
    manufacturer_name?: string[];
  };
  drug_interactions?: string[];
  boxed_warning?: string[];
  contraindications?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
};

export type MedicationLabelSummary = {
  requestedName: string;
  status: "found" | "not-found" | "unavailable";
  officialNames: string[];
  manufacturer: string;
  effectiveDate: string;
  interactionWarnings: string[];
  boxedWarnings: string[];
  contraindications: string[];
  warnings: string[];
  mentionedMedicines: string[];
  source: string;
};

const MAX_MEDICINES = 5;
const MAX_SECTION_LENGTH = 1400;

export function normalizeMedicineName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s.'()\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseMedicineNames(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(/[\n,;]/);
  const unique = new Map<string, string>();
  for (const item of raw) {
    const name = normalizeMedicineName(String(item));
    if (name.length < 2) continue;
    const key = name.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, name);
    if (unique.size >= MAX_MEDICINES) break;
  }
  return [...unique.values()];
}

function cleanSections(values: string[] | undefined, limit = 2) {
  return (values ?? [])
    .map((value) => value.replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_LENGTH))
    .filter(Boolean)
    .slice(0, limit);
}

function containsMedicine(text: string, medicine: string) {
  const escaped = medicine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
}

export function summarizeOpenFdaLabel(
  requestedName: string,
  label: OpenFdaDrugLabel,
  allMedicines: string[],
): MedicationLabelSummary {
  const interactionWarnings = cleanSections(label.drug_interactions);
  const boxedWarnings = cleanSections(label.boxed_warning, 1);
  const contraindications = cleanSections(label.contraindications, 1);
  const warnings = cleanSections(label.warnings_and_cautions?.length ? label.warnings_and_cautions : label.warnings, 1);
  const searchable = [...interactionWarnings, ...boxedWarnings, ...contraindications, ...warnings].join(" ");
  return {
    requestedName,
    status: "found",
    officialNames: [...new Set([...(label.openfda?.generic_name ?? []), ...(label.openfda?.brand_name ?? [])])].slice(0, 8),
    manufacturer: label.openfda?.manufacturer_name?.[0] ?? "Not listed",
    effectiveDate: label.effective_time ?? "Not listed",
    interactionWarnings,
    boxedWarnings,
    contraindications,
    warnings,
    mentionedMedicines: allMedicines.filter((name) => name.toLocaleLowerCase() !== requestedName.toLocaleLowerCase() && containsMedicine(searchable, name)),
    source: "U.S. FDA Structured Product Labeling via openFDA",
  };
}

export function missingMedicationLabel(requestedName: string, unavailable = false): MedicationLabelSummary {
  return {
    requestedName,
    status: unavailable ? "unavailable" : "not-found",
    officialNames: [],
    manufacturer: "",
    effectiveDate: "",
    interactionWarnings: [],
    boxedWarnings: [],
    contraindications: [],
    warnings: [],
    mentionedMedicines: [],
    source: "U.S. FDA Structured Product Labeling via openFDA",
  };
}
