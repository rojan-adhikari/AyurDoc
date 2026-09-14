import { env } from "cloudflare:workers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { canRegisterPasskey } from "../../../../../lib/passkeys";

type Challenge = {
  challenge: string;
  rp_id: string;
  expected_origin: string;
  expires_at: string;
};

export async function POST(request: Request) {
  let payload: {
    username?: string;
    challengeId?: string;
    registrationChallengeId?: string;
    response?: RegistrationResponseJSON;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid passkey response." }, { status: 400 });
  }
  const username = payload.username?.trim().toLowerCase() ?? "";
  if (!username || !payload.challengeId || !payload.response)
    return Response.json({ error: "The passkey response is incomplete." }, { status: 400 });
  if (!(await canRegisterPasskey(request, username, payload.registrationChallengeId)))
    return Response.json({ error: "Passkey enrollment is not authorised." }, { status: 403 });

  const saved = await env.DB.prepare(
    `SELECT challenge, rp_id, expected_origin, expires_at
     FROM passkey_challenges
     WHERE id = ? AND username = ? AND purpose = 'registration'`,
  )
    .bind(payload.challengeId, username)
    .first<Challenge>();
  if (!saved || saved.expires_at <= new Date().toISOString())
    return Response.json({ error: "This biometric setup request expired. Please try again." }, { status: 400 });

  try {
    const verification = await verifyRegistrationResponse({
      response: payload.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: saved.expected_origin,
      expectedRPID: saved.rp_id,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo)
      return Response.json({ error: "Biometric verification was not completed." }, { status: 400 });

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR REPLACE INTO passkey_credentials
         (credential_id, username, public_key, counter, transports, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).bind(
        credential.id,
        username,
        isoBase64URL.fromBuffer(credential.publicKey),
        credential.counter,
        JSON.stringify(credential.transports ?? []),
        credentialDeviceType,
        credentialBackedUp ? 1 : 0,
      ),
      env.DB.prepare(`DELETE FROM passkey_challenges WHERE id = ?`).bind(payload.challengeId),
    ]);
    return Response.json({ verified: true });
  } catch (error) {
    console.error("Passkey registration verification failed", error);
    return Response.json({ error: "The device could not verify this biometric passkey." }, { status: 400 });
  }
}
