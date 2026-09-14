"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { AlertTriangle, CheckCircle2, LoaderCircle, ScanFace, Volume2 } from "lucide-react";

async function responseData<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try { return JSON.parse(body) as T; } catch { return {} as T; }
}

export function BiometricEnrollment({
  username,
  language,
}: {
  username: string;
  language: "English" | "हिन्दी" | "தமிழ்";
}) {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  function speak() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const instruction = language === "हिन्दी"
      ? "अपने डिवाइस की ओर देखें और बायोमेट्रिक निर्देश का पालन करें।"
      : language === "தமிழ்"
        ? "உங்கள் சாதனத்தைப் பார்த்து பயோமெட்ரிக் வழிமுறையைப் பின்பற்றுங்கள்."
        : "Look at your device and follow the secure biometric prompt.";
    const utterance = new SpeechSynthesisUtterance(instruction);
    utterance.lang = language === "हिन्दी" ? "hi-IN" : language === "தமிழ்" ? "ta-IN" : "en-IN";
    utterance.rate = .82;
    window.speechSynthesis.speak(utterance);
  }

  async function enroll() {
    if (!("PublicKeyCredential" in window)) {
      setError("This browser does not support secure biometric login.");
      return;
    }
    setLoading(true);
    setError("");
    speak();
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const optionsData = await responseData<{
        challengeId?: string;
        options?: Parameters<typeof startRegistration>[0]["optionsJSON"];
        error?: string;
      }>(optionsResponse);
      if (!optionsResponse.ok || !optionsData.challengeId || !optionsData.options)
        throw new Error(optionsData.error || "Unable to start biometric setup.");
      const credential = await startRegistration({ optionsJSON: optionsData.options });
      const verifyResponse = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, challengeId: optionsData.challengeId, response: credential }),
      });
      const verifyData = await responseData<{ verified?: boolean; error?: string }>(verifyResponse);
      if (!verifyResponse.ok || !verifyData.verified)
        throw new Error(verifyData.error || "Biometric setup could not be verified.");
      setComplete(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Biometric setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`profile-biometric ${complete ? "complete" : ""}`}>
      <span className="profile-biometric-icon">{complete ? <CheckCircle2 size={28} /> : <ScanFace size={30} />}</span>
      <div>
        <strong>{complete ? "Face / biometric login ready" : "Enable no-typing login"}</strong>
        <small>{complete ? "Next time, tap the face picture on the login page." : "Use this device’s Face ID, fingerprint or secure screen lock."}</small>
      </div>
      {!complete && <button type="button" onClick={enroll} disabled={loading}>{loading ? <LoaderCircle className="spin" size={20} /> : <ScanFace size={20} />} Set up</button>}
      <button type="button" className="profile-biometric-speak" onClick={speak} aria-label="Hear biometric instructions"><Volume2 size={20} /></button>
      {error && <p role="alert"><AlertTriangle size={17} /> {error}</p>}
    </section>
  );
}
