import { env } from "cloudflare:workers";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import {
  canRegisterPasskey,
  PASSKEY_RP_NAME,
  passkeyRequestContext,
  savePasskeyChallenge,
} from "../../../../../lib/passkeys";

export async function POST(request: Request) {
  let payload: { username?: string; registrationChallengeId?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid passkey request." }, { status: 400 });
  }
  const username = payload.username?.trim().toLowerCase() ?? "";
  if (!username || !(await canRegisterPasskey(request, username, payload.registrationChallengeId)))
    return Response.json({ error: "Sign in or complete verified registration first." }, { status: 403 });

  const { rpID, expectedOrigin } = passkeyRequestContext(request);
  const existing = await env.DB.prepare(
    `SELECT credential_id, transports FROM passkey_credentials WHERE username = ?`,
  )
    .bind(username)
    .all<{ credential_id: string; transports: string }>();

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID,
    userName: username,
    userDisplayName: username,
    attestationType: "none",
    timeout: 60_000,
    excludeCredentials: existing.results.map((row) => ({
      id: row.credential_id,
      transports: JSON.parse(row.transports || "[]"),
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
  });
  const challengeId = await savePasskeyChallenge({
    username,
    purpose: "registration",
    challenge: options.challenge,
    rpID,
    expectedOrigin,
  });
  return Response.json({ challengeId, options });
}
