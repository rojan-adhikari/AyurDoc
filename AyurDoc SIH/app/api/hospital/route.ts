import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { isValidPhoneNumber } from "../../../lib/validation";
import { doctorForId, scopedDoctorId } from "../../../lib/doctor-directory";

const BED_BASELINE: Record<string, number> = {
  "OPD Observation": 18,
  ICU: 6,
  CCU: 4,
  "General Ward": 42,
  "Private Ward": 12,
};

const BLOOD_BASELINE: Record<string, number> = {
  "A+": 24,
  "A-": 8,
  "B+": 20,
  "B-": 7,
  "O+": 31,
  "O-": 10,
  "AB+": 12,
  "AB-": 5,
};

const COMPONENT_BASELINE: Record<string, number> = {
  "Packed Red Blood Cells": 64,
  Plasma: 38,
  Platelets: 22,
};

type Row = Record<string, unknown>;

async function resolveDoctor(doctorId: string) {
  const builtIn = doctorForId(doctorId);
  if (builtIn) return builtIn;
  const managed = await env.DB.prepare(
    `SELECT doctor_id AS id, name, degree, department, hours
     FROM doctor_directory_overrides WHERE doctor_id = ? AND visible = 1`,
  )
    .bind(doctorId)
    .first<{ id: string; name: string; degree: string; department: string; hours: string }>();
  return managed;
}

async function scopedRows(table: string, role: string, username: string) {
  const allowed = new Set([
    "emergency_requests",
    "blood_requests",
    "donors",
    "appointments",
  ]);
  if (!allowed.has(table)) return [];
  const doctorId = role === "doctor" ? scopedDoctorId(username) : null;
  const statement =
    role === "doctor" && table === "appointments" && doctorId
      ? env.DB.prepare(
          `SELECT * FROM ${table} WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 50`,
        ).bind(doctorId)
      : role === "doctor"
        ? env.DB.prepare(
            `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 50`,
          )
      : env.DB.prepare(
          `SELECT * FROM ${table} WHERE patient_username = ? ORDER BY created_at DESC LIMIT 25`,
        ).bind(username);
  return (await statement.all()).results as Row[];
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const [
    bedCounts,
    bloodCounts,
    componentCounts,
    emergencies,
    bloodRequests,
    donations,
    appointments,
    inventory,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT bed_type, COUNT(*) AS count FROM emergency_requests WHERE status IN ('alerted', 'dispatched', 'admitted') GROUP BY bed_type",
    ).all<{ bed_type: string; count: number }>(),
    env.DB.prepare(
      "SELECT blood_group, SUM(units) AS units FROM blood_requests WHERE status IN ('requested', 'matched') GROUP BY blood_group",
    ).all<{ blood_group: string; units: number }>(),
    env.DB.prepare(
      "SELECT component, SUM(units) AS units FROM blood_requests WHERE status IN ('requested', 'matched') GROUP BY component",
    ).all<{ component: string; units: number }>(),
    scopedRows("emergency_requests", session.role, session.username),
    scopedRows("blood_requests", session.role, session.username),
    scopedRows("donors", session.role, session.username),
    scopedRows("appointments", session.role, session.username),
    env.DB.prepare(
      "SELECT item_key, total_count FROM facility_inventory",
    ).all<{ item_key: string; total_count: number }>(),
  ]);

  const bedUsage = Object.fromEntries(
    bedCounts.results.map((row) => [row.bed_type, Number(row.count)]),
  );
  const bloodUsage = Object.fromEntries(
    bloodCounts.results.map((row) => [row.blood_group, Number(row.units)]),
  );
  const componentUsage = Object.fromEntries(
    componentCounts.results.map((row) => [row.component, Number(row.units)]),
  );
  const inventoryTotals = Object.fromEntries(
    inventory.results.map((row) => [row.item_key, Number(row.total_count)]),
  );

  return Response.json({
    bedAvailability: Object.entries(BED_BASELINE).map(([type, baseline]) => ({
      type,
      available: Math.max(
        0,
        (inventoryTotals[`bed:${type}`] ?? baseline) - (bedUsage[type] ?? 0),
      ),
      total: inventoryTotals[`bed:${type}`] ?? baseline,
    })),
    bloodInventory: Object.entries(BLOOD_BASELINE).map(([group, baseline]) => ({
      group,
      units: Math.max(
        0,
        (inventoryTotals[`blood:${group}`] ?? baseline) -
          (bloodUsage[group] ?? 0),
      ),
    })),
    componentInventory: Object.entries(COMPONENT_BASELINE).map(
      ([component, baseline]) => ({
        component,
        units: Math.max(
          0,
          (inventoryTotals[`component:${component}`] ?? baseline) -
            (componentUsage[component] ?? 0),
        ),
      }),
    ),
    emergencies,
    bloodRequests,
    donations,
    appointments,
    updatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const payload = (await request.json()) as Record<string, unknown>;
  const action = String(payload.action ?? "");

  if (action === "emergency") {
    const patientName = String(payload.patientName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const bedType = String(payload.bedType ?? "").trim();
    const symptoms = String(payload.symptoms ?? "").trim();
    const ambulance = Boolean(payload.ambulance);
    const pickupAddress = String(payload.pickupAddress ?? "").trim();
    if (
      !patientName ||
      !isValidPhoneNumber(phone) ||
      !BED_BASELINE[bedType] ||
      !symptoms ||
      (ambulance && !pickupAddress)
    ) {
      return Response.json(
        { error: "Complete all required emergency details." },
        { status: 400 },
      );
    }
    const result = await env.DB.prepare(
      "INSERT INTO emergency_requests (patient_username, patient_name, phone, bed_type, symptoms, ambulance, pickup_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        session.username,
        patientName,
        phone,
        bedType,
        symptoms,
        ambulance ? 1 : 0,
        pickupAddress,
      )
      .run();
    return Response.json(
      { id: result.meta.last_row_id, status: "alerted" },
      { status: 201 },
    );
  }

  if (action === "blood_request") {
    const patientName = String(payload.patientName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const bloodGroup = String(payload.bloodGroup ?? "").trim();
    const component = String(payload.component ?? "").trim();
    const units = Number(payload.units);
    const urgency = String(payload.urgency ?? "").trim();
    const hospitalLocation = String(payload.hospitalLocation ?? "").trim();
    if (
      !patientName ||
      !isValidPhoneNumber(phone) ||
      !BLOOD_BASELINE[bloodGroup] ||
      !COMPONENT_BASELINE[component] ||
      !Number.isInteger(units) ||
      units < 1 ||
      units > 10 ||
      !urgency ||
      !hospitalLocation
    ) {
      return Response.json(
        { error: "Complete all required blood request details." },
        { status: 400 },
      );
    }
    const result = await env.DB.prepare(
      "INSERT INTO blood_requests (patient_username, patient_name, phone, blood_group, component, units, urgency, hospital_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        session.username,
        patientName,
        phone,
        bloodGroup,
        component,
        units,
        urgency,
        hospitalLocation,
      )
      .run();
    return Response.json(
      { id: result.meta.last_row_id, status: "requested" },
      { status: 201 },
    );
  }

  if (action === "donor") {
    const donorName = String(payload.donorName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const bloodGroup = String(payload.bloodGroup ?? "").trim();
    const donationDate = String(payload.donationDate ?? "").trim();
    const timeSlot = String(payload.timeSlot ?? "").trim();
    if (
      !donorName ||
      !isValidPhoneNumber(phone) ||
      !BLOOD_BASELINE[bloodGroup] ||
      !donationDate ||
      donationDate < new Date().toISOString().slice(0, 10) ||
      !timeSlot ||
      !payload.eligibleConfirmed
    ) {
      return Response.json(
        { error: "Confirm eligibility and complete all donor details." },
        { status: 400 },
      );
    }
    const result = await env.DB.prepare(
      "INSERT INTO donors (patient_username, donor_name, phone, blood_group, donation_date, time_slot, eligible_confirmed) VALUES (?, ?, ?, ?, ?, ?, 1)",
    )
      .bind(
        session.username,
        donorName,
        phone,
        bloodGroup,
        donationDate,
        timeSlot,
      )
      .run();
    return Response.json(
      { id: result.meta.last_row_id, status: "scheduled" },
      { status: 201 },
    );
  }

  if (action === "appointment") {
    if (session.role !== "patient")
      return Response.json(
        { error: "Patient sign-in required." },
        { status: 403 },
      );
    const patientName = String(payload.patientName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const doctorId = String(payload.doctorId ?? "");
    const doctor = await resolveDoctor(doctorId);
    const visitMode = String(payload.visitMode ?? "").trim();
    const appointmentDate = String(payload.appointmentDate ?? "").trim();
    const timeSlot = String(payload.timeSlot ?? "").trim();
    const reason = String(payload.reason ?? "").trim();
    if (
      !patientName ||
      !isValidPhoneNumber(phone) ||
      !doctor ||
      !["In-person", "Video consultation"].includes(visitMode) ||
      !appointmentDate ||
      appointmentDate < new Date().toISOString().slice(0, 10) ||
      !timeSlot ||
      !reason
    ) {
      return Response.json(
        { error: "Complete all appointment details." },
        { status: 400 },
      );
    }
    const meetingCode = `AYR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await env.DB.prepare(
      "INSERT INTO appointments (patient_username, patient_name, phone, doctor_id, doctor_name, department, visit_mode, appointment_date, time_slot, reason, meeting_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        session.username,
        patientName,
        phone,
        doctorId,
        doctor.name,
        doctor.department,
        visitMode,
        appointmentDate,
        timeSlot,
        reason,
        meetingCode,
      )
      .run();
    return Response.json(
      { id: result.meta.last_row_id, meetingCode, status: "confirmed" },
      { status: 201 },
    );
  }

  return Response.json({ error: "Unknown hospital action." }, { status: 400 });
}

export async function PUT(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "doctor")
    return Response.json(
      { error: "Doctor sign-in required." },
      { status: 403 },
    );
  const payload = (await request.json()) as {
    resource?: string;
    id?: number;
    status?: string;
  };
  const tables: Record<string, string> = {
    emergency: "emergency_requests",
    blood: "blood_requests",
    appointment: "appointments",
  };
  const table = tables[payload.resource ?? ""];
  if (
    !table ||
    !payload.id ||
    !["acknowledged", "allocated", "closed", "confirmed", "completed"].includes(
      payload.status ?? "",
    )
  ) {
    return Response.json(
      { error: "Valid resource, record and status are required." },
      { status: 400 },
    );
  }
  const doctorId = scopedDoctorId(session.username);
  const statement = table === "appointments" && doctorId
    ? env.DB.prepare(`UPDATE ${table} SET status = ? WHERE id = ? AND doctor_id = ?`)
        .bind(payload.status, payload.id, doctorId)
    : env.DB.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`)
        .bind(payload.status, payload.id);
  const result = await statement.run();
  if (!result.meta.changes)
    return Response.json({ error: "Record not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const id = Number(url.searchParams.get("id"));
  if (resource !== "appointment" || !Number.isInteger(id) || id < 1)
    return Response.json(
      { error: "A valid appointment is required." },
      { status: 400 },
    );

  const appointment = await env.DB.prepare(
    "SELECT patient_username, doctor_id, meeting_code, visit_mode FROM appointments WHERE id = ?",
  )
    .bind(id)
    .first<{
      patient_username: string;
      doctor_id: string;
      meeting_code: string;
      visit_mode: string;
    }>();

  if (!appointment)
    return Response.json({ error: "Appointment not found." }, { status: 404 });
  if (
    session.role === "patient" &&
    appointment.patient_username !== session.username
  )
    return Response.json(
      { error: "You can delete only your own meeting." },
      { status: 403 },
    );
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (session.role === "doctor" && doctorId && appointment.doctor_id !== doctorId)
    return Response.json(
      { error: "You can delete only your own video meetings." },
      { status: 403 },
    );
  if (appointment.visit_mode !== "Video consultation")
    return Response.json(
      { error: "Only video meetings can be deleted here." },
      { status: 400 },
    );

  await env.DB.batch([
    env.DB.prepare("DELETE FROM video_signals WHERE meeting_code = ?").bind(
      appointment.meeting_code,
    ),
    env.DB.prepare("DELETE FROM appointments WHERE id = ?").bind(id),
  ]);
  return Response.json({ ok: true });
}
