"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  IdCard,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type AbhaProfileRow = {
  username: string;
  abha_number: string;
  abha_address: string;
  verification_status: "not-linked" | "verification-pending" | "verified";
  consent_granted: number | boolean;
  consented_at: string | null;
  linked_at: string | null;
  updated_at: string;
};

function formatAbhaNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

async function readResponse<T>(response: Response) {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export function AbhaProfile() {
  const [profile, setProfile] = useState<AbhaProfileRow | null>(null);
  const [officialUrl, setOfficialUrl] = useState(
    "https://abha.abdm.gov.in/abha/v3/register",
  );
  const [abhaNumber, setAbhaNumber] = useState("");
  const [abhaAddress, setAbhaAddress] = useState("");
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/abha", { cache: "no-store" });
      const data = await readResponse<{
        profile?: AbhaProfileRow;
        officialCreationUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.profile)
        throw new Error(data.error || "Unable to load the ABHA profile.");
      setProfile(data.profile);
      setAbhaNumber(data.profile.abha_number ?? "");
      setAbhaAddress(data.profile.abha_address ?? "");
      setConsented(Boolean(data.profile.consent_granted));
      if (data.officialCreationUrl) setOfficialUrl(data.officialCreationUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the ABHA profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  async function linkAbha() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abhaNumber, abhaAddress, consentGranted: consented }),
      });
      const data = await readResponse<{
        profile?: AbhaProfileRow;
        error?: string;
      }>(response);
      if (!response.ok || !data.profile)
        throw new Error(data.error || "ABHA could not be linked.");
      setProfile(data.profile);
      setMessage("ABHA saved to your patient profile. Official verification remains pending.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ABHA could not be linked.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function unlinkAbha() {
    if (!window.confirm("Unlink this ABHA from AyurDoc? Your ABHA itself will not be deleted."))
      return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/abha", { method: "DELETE" });
    const data = await readResponse<{ error?: string }>(response);
    if (!response.ok) setError(data.error || "ABHA could not be unlinked.");
    else {
      setAbhaNumber("");
      setAbhaAddress("");
      setConsented(false);
      setMessage("ABHA unlinked from this patient profile.");
      await load();
    }
    setSaving(false);
  }

  const linked = Boolean(profile?.abha_number);
  const validNumber = abhaNumber.replace(/\D/g, "").length === 14;

  return (
    <section className="module-page abha-page">
      <header className="module-hero abha-hero">
        <div>
          <span className="status-pill status-teal">
            <IdCard size={14} /> ABDM health identity
          </span>
          <h1>ABHA profile</h1>
          <p>
            Create an ABHA on the official National Health Authority portal,
            then link the 14-digit number to your AyurDoc patient profile with
            informed consent.
          </p>
        </div>
        <a
          className="official-abha-link"
          href={officialUrl}
          target="_blank"
          rel="noreferrer"
        >
          Create or verify ABHA <ExternalLink size={16} />
        </a>
      </header>

      <div className="abha-info-strip">
        <ShieldCheck size={21} />
        <div>
          <strong>Consent-controlled ABDM readiness</strong>
          <span>
            ABHA is operated by the National Health Authority under the Ministry
            of Health &amp; Family Welfare. It can connect records from AYUSH and
            other participating facilities only with patient consent.
          </span>
        </div>
      </div>

      {loading ? (
        <div className="abha-loading">
          <LoaderCircle className="spin" /> Loading ABHA profile…
        </div>
      ) : (
        <div className="abha-grid">
          <article className="abha-status-card">
            <div className="abha-card-heading">
              <div className="abha-card-icon"><IdCard size={26} /></div>
              <div>
                <span>Patient ABHA status</span>
                <h2>{linked ? "ABHA linked" : "ABHA not linked"}</h2>
              </div>
            </div>
            {linked ? (
              <div className="abha-linked-details">
                <div>
                  <small>ABHA number</small>
                  <strong data-no-translate>{formatAbhaNumber(profile?.abha_number ?? "")}</strong>
                </div>
                <div>
                  <small>ABHA address</small>
                  <strong data-no-translate>{profile?.abha_address || "Not entered"}</strong>
                </div>
                <div className="abha-verification-state">
                  <CheckCircle2 size={17} />
                  <span>
                    <strong>Linked to AyurDoc</strong>
                    {profile?.verification_status === "verified"
                      ? "Official verification complete"
                      : "Official ABDM verification pending"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="danger-action"
                  disabled={saving}
                  onClick={() => void unlinkAbha()}
                >
                  <Trash2 size={16} /> Unlink ABHA
                </Button>
              </div>
            ) : (
              <div className="abha-empty-state">
                <Link2 size={28} />
                <p>
                  Every patient has an ABHA section. Linking is voluntary; use
                  the official portal first if you do not yet have an ABHA.
                </p>
              </div>
            )}
          </article>

          <form
            className="abha-link-card"
            onSubmit={(event) => {
              event.preventDefault();
              void linkAbha();
            }}
          >
            <div className="abha-card-heading">
              <div className="abha-card-icon secondary"><Link2 size={23} /></div>
              <div>
                <span>Existing ABHA</span>
                <h2>{linked ? "Update linked details" : "Link to this profile"}</h2>
              </div>
            </div>
            <label>
              <span>14-digit ABHA number *</span>
              <Input
                value={formatAbhaNumber(abhaNumber)}
                onChange={(event) =>
                  setAbhaNumber(event.target.value.replace(/\D/g, "").slice(0, 14))
                }
                inputMode="numeric"
                autoComplete="off"
                placeholder="XX-XXXX-XXXX-XXXX"
                data-no-translate
              />
            </label>
            <label>
              <span>ABHA address (optional)</span>
              <Input
                value={abhaAddress}
                onChange={(event) => setAbhaAddress(event.target.value.toLowerCase())}
                autoComplete="off"
                placeholder="yourname@abdm"
                data-no-translate
              />
            </label>
            <label className="abha-consent-row">
              <Checkbox
                checked={consented}
                onCheckedChange={(value) => setConsented(value === true)}
              />
              <span>
                <strong>I consent to link this ABHA to my AyurDoc profile.</strong>
                I understand that sharing health records requires separate,
                purpose-specific consent.
              </span>
            </label>
            <div className="abha-privacy-note">
              <LockKeyhole size={15} /> AyurDoc does not ask for or store your
              Aadhaar number or ABDM OTP in this flow.
            </div>
            {error && (
              <div className="module-alert error">
                <AlertTriangle size={16} /> {error}
              </div>
            )}
            {message && (
              <div className="module-alert success">
                <CheckCircle2 size={16} /> {message}
              </div>
            )}
            <Button type="submit" size="lg" disabled={saving || !validNumber || !consented}>
              {saving ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />}
              {linked ? "Update ABHA link" : "Link ABHA"}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
