import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";

const OFFICIAL_ABHA_URL = "https://abha.abdm.gov.in/abha/v3/register";

type AbhaRow = {
  username: string;
  abha_number: string;
  abha_address: string;
  verification_status: string;
  consent_granted: number | boolean;
  consented_at: string | null;
  linked_at: string | null;
  updated_at: string;
};

function normalizeAbhaNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

function normalizeAbhaAddress(value: string) {
  return value.trim().toLowerCase().slice(0, 100);
}

function validAbhaAddress(value: string) {
  return !value || /^[a-z0-9][a-z0-9._-]{2,63}@[a-z0-9.-]{2,30}$/.test(value);
}

async function ensurePatientProfile(username: string) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO patient_abha_profiles
     (username, abha_number, abha_address, verification_status, consent_granted)
     VALUES (?, '', '', 'not-linked', 0)`,
  )
    .bind(username)
    .run();
  return env.DB.prepare(
    `SELECT username, abha_number, abha_address, verification_status,
            consent_granted, consented_at, linked_at, updated_at
     FROM patient_abha_profiles WHERE username = ?`,
  )
    .bind(username)
    .first<AbhaRow>();
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );
  const profile = await ensurePatientProfile(session.username);
  return Response.json({ profile, officialCreationUrl: OFFICIAL_ABHA_URL });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );

  const payload = (await request.json()) as {
    abhaNumber?: string;
    abhaAddress?: string;
    consentGranted?: boolean;
  };
  const abhaNumber = normalizeAbhaNumber(String(payload.abhaNumber ?? ""));
  const abhaAddress = normalizeAbhaAddress(String(payload.abhaAddress ?? ""));
  if (abhaNumber.length !== 14)
    return Response.json(
      { error: "Enter the complete 14-digit ABHA number." },
      { status: 400 },
    );
  if (!validAbhaAddress(abhaAddress))
    return Response.json(
      { error: "Enter a valid ABHA address, for example name@abdm." },
      { status: 400 },
    );
  if (payload.consentGranted !== true)
    return Response.json(
      { error: "Informed consent is required to link an ABHA profile." },
      { status: 400 },
    );

  try {
    await env.DB.prepare(
      `INSERT INTO patient_abha_profiles (
         username, abha_number, abha_address, verification_status,
         consent_granted, consented_at, linked_at, updated_at
       ) VALUES (?, ?, ?, 'verification-pending', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(username) DO UPDATE SET
         abha_number = excluded.abha_number,
         abha_address = excluded.abha_address,
         verification_status = 'verification-pending',
         consent_granted = 1,
         consented_at = CURRENT_TIMESTAMP,
         linked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(session.username, abhaNumber, abhaAddress)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|constraint/i.test(message))
      return Response.json(
        { error: "This ABHA number is already linked to another patient account." },
        { status: 409 },
      );
    throw error;
  }

  const profile = await ensurePatientProfile(session.username);
  return Response.json({ profile, officialCreationUrl: OFFICIAL_ABHA_URL });
}

export async function DELETE(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );
  await ensurePatientProfile(session.username);
  await env.DB.prepare(
    `UPDATE patient_abha_profiles SET
       abha_number = '', abha_address = '', verification_status = 'not-linked',
       consent_granted = 0, consented_at = NULL, linked_at = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE username = ?`,
  )
    .bind(session.username)
    .run();
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "admin")
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as { username?: string; status?: string };
  const username = String(payload.username ?? "").trim().toLowerCase();
  const status = String(payload.status ?? "");
  if (!username || !["verification-pending", "verified", "rejected"].includes(status))
    return Response.json({ error: "Choose a valid ABHA review status." }, { status: 400 });
  const profile = await env.DB.prepare(
    "SELECT abha_number, consent_granted FROM patient_abha_profiles WHERE username = ?",
  ).bind(username).first<{ abha_number: string; consent_granted: number }>();
  if (!profile?.abha_number || !profile.consent_granted)
    return Response.json({ error: "The patient must link an ABHA with consent before verification." }, { status: 400 });
  const result = await env.DB.prepare(
    "UPDATE patient_abha_profiles SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
  ).bind(status, username).run();
  if (!result.meta.changes)
    return Response.json({ error: "ABHA profile not found." }, { status: 404 });
  return Response.json({ ok: true, status });
}
