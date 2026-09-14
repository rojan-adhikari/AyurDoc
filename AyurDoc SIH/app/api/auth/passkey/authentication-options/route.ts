import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { passkeyRequestContext, savePasskeyChallenge } from "../../../../../lib/passkeys";

export async function POST(request: Request) {
  const { rpID, expectedOrigin } = passkeyRequestContext(request);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required",
  });
  const challengeId = await savePasskeyChallenge({
    username: "",
    purpose: "authentication",
    challenge: options.challenge,
    rpID,
    expectedOrigin,
  });
  return Response.json({ challengeId, options });
}
