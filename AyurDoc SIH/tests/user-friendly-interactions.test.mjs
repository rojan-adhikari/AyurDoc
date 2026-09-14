import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hospitalModules = await readFile(new URL("../app/hospital-modules.tsx", import.meta.url), "utf8");
const voiceGuide = await readFile(new URL("../app/context-aware-voice-guide.tsx", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const adminUsers = await readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8");
const patientRegistration = await readFile(new URL("../app/patient-registration.tsx", import.meta.url), "utf8");
const patientRegistrationApi = await readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8");

test("removes the overview voice-navigation help from patient and doctor portals", () => {
  assert.doesNotMatch(hospitalModules, /className="portal-voice-guide"/);
  assert.doesNotMatch(hospitalModules, /Voice navigation help/);
});

test("patient voice guide waits for complete answers and uses the current question", () => {
  assert.match(voiceGuide, /const \[open, setOpen\] = useState\(true\)/);
  assert.match(voiceGuide, /speak\(responseRef\.current, true\)/);
  assert.match(voiceGuide, /recognition\.continuous = true/);
  assert.match(voiceGuide, /commitTranscript/);
  assert.match(voiceGuide, /interpretRef\.current\(answer\)/);
  assert.match(voiceGuide, /Listening patiently—take your time/);
});

test("AyurAI has proactive help and repetition protection", () => {
  assert.match(hospitalModules, /ayurai-welcome-nudge/);
  assert.match(hospitalModules, /How can I help you today/);
  assert.match(hospitalModules, /Open AyurAI assistant/);
  assert.doesNotMatch(hospitalModules, /className="floating-chat-launcher"/);
  assert.doesNotMatch(hospitalModules, />Ask AyurAI</);
  assert.match(hospitalModules, /repetitionRecovery/);
  assert.match(hospitalModules, /normalizedReply/);
});

test("administration can search accounts and manage biometric access", () => {
  assert.match(adminPage, /Search name, username, Gmail or phone/);
  assert.match(adminPage, /value="biometrics"/);
  assert.match(adminPage, /clearBiometrics/);
  assert.match(adminUsers, /clear-passkeys/);
  assert.match(adminUsers, /DELETE FROM passkey_credentials WHERE username = \?/);
});

test("verified patient registration activates access without administrator approval", () => {
  assert.match(patientRegistrationApi, /CURRENT_TIMESTAMP, 1, 'self-registration-auto'/);
  assert.match(patientRegistrationApi, /pendingApproval: false/);
  assert.match(patientRegistrationApi, /accessActive: true/);
  assert.match(patientRegistration, /administrator approval is not required/);
});
