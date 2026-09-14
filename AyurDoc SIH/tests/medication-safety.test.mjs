import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMedicineNames,
  summarizeOpenFdaLabel,
} from "../lib/medication-safety.ts";
import { createClinicalWorkflow } from "../lib/clinical-workflow.ts";

test("normalizes and limits medication names before external lookup", () => {
  assert.deepEqual(
    parseMedicineNames(" Warfarin, aspirin\nWARFARIN; sildenafil; nitroglycerin; metformin; amoxicillin "),
    ["Warfarin", "aspirin", "sildenafil", "nitroglycerin", "metformin"],
  );
});

test("keeps official label evidence separate and detects entered medicine mentions", () => {
  const result = summarizeOpenFdaLabel("warfarin", {
    effective_time: "20260901",
    openfda: { generic_name: ["WARFARIN SODIUM"], manufacturer_name: ["Example manufacturer"] },
    drug_interactions: ["Aspirin may increase bleeding risk when used with warfarin."],
    boxed_warning: ["Bleeding risk requires clinical monitoring."],
  }, ["warfarin", "aspirin"]);
  assert.equal(result.status, "found");
  assert.deepEqual(result.mentionedMedicines, ["aspirin"]);
  assert.match(result.interactionWarnings[0], /bleeding risk/i);
});

test("structures 5,000 complete clinical histories in a bounded scale smoke check", () => {
  const startedAt = performance.now();
  let priorityCount = 0;
  for (let index = 1; index <= 5_000; index += 1) {
    const workflow = createClinicalWorkflow({
      intakeId: index,
      patientUsername: `patient-${index}`,
      fullName: `Scale Patient ${index}`,
      age: 40,
      sex: "Male",
      department: "Kayachikitsa",
      doctorId: "kaya-01",
      doctorName: "Dr Demo",
      language: "English",
      complaint: index % 50 === 0 ? "Severe chest pain" : "Digestive complaint",
      onset: "2 days ago",
      symptoms: index % 50 === 0 ? "Breathing difficulty" : "Bloating",
      conditions: "None reported",
      allergies: "None reported",
      answers: { satmya: ["Usual diet tolerated"], sattva: ["Calm"] },
      consentedAt: "2026-09-14T08:00:00.000Z",
    });
    if (workflow.redFlags.length) priorityCount += 1;
    assert.equal(workflow.completenessScore, 100);
  }
  assert.equal(priorityCount, 100);
  assert.ok(performance.now() - startedAt < 12_000, "Scale smoke check exceeded 12 seconds");
});
