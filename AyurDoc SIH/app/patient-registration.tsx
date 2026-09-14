"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ScanFace,
  Upload,
  UserPlus,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  gmailValidationMessage,
  isValidGmailAddress,
  isStrongPassword,
  isValidUsername,
  normalizeEmail,
} from "@/lib/validation";

type RegisteredUser = { username: string; role: "patient" };

async function responseData<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

export function PatientRegistration({
  open,
  onOpenChange,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "English" | "हिन्दी" | "தமிழ்";
}) {
  const [step, setStep] = useState<"email" | "otp" | "account" | "submitted">("email");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [idType, setIdType] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricComplete, setBiometricComplete] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  function reset() {
    setStep("email");
    setEmail("");
    setChallengeId("");
    setOtp("");
    setDeliveryMessage("");
    setVerified(false);
    setDisplayName("");
    setUsername("");
    setPassword("");
    setIdType("");
    setIdFile(null);
    setError("");
    setShowValidation(false);
    setRegisteredUsername("");
    setBiometricLoading(false);
    setBiometricComplete(false);
    setBiometricError("");
  }

  function speakBiometric() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const instruction = language === "हिन्दी"
      ? "अपने डिवाइस की ओर देखें और बायोमेट्रिक निर्देश का पालन करें।"
      : language === "தமிழ்"
        ? "உங்கள் சாதனத்தைப் பார்த்து பயோமெட்ரிக் வழிமுறையைப் பின்பற்றுங்கள்."
        : "Look at your device and follow the secure biometric prompt.";
    const speech = new SpeechSynthesisUtterance(instruction);
    speech.lang = language === "हिन्दी" ? "hi-IN" : language === "தமிழ்" ? "ta-IN" : "en-IN";
    speech.rate = 0.82;
    window.speechSynthesis.speak(speech);
  }

  async function enrollBiometric() {
    if (!("PublicKeyCredential" in window)) {
      setBiometricError("This browser does not support secure biometric login.");
      return;
    }
    setBiometricLoading(true);
    setBiometricError("");
    speakBiometric();
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: registeredUsername, registrationChallengeId: challengeId }),
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
        body: JSON.stringify({
          username: registeredUsername,
          registrationChallengeId: challengeId,
          challengeId: optionsData.challengeId,
          response: credential,
        }),
      });
      const verifyData = await responseData<{ verified?: boolean; error?: string }>(verifyResponse);
      if (!verifyResponse.ok || !verifyData.verified)
        throw new Error(verifyData.error || "Biometric setup could not be verified.");
      setBiometricComplete(true);
    } catch (setupError) {
      setBiometricError(setupError instanceof Error ? setupError.message : "Biometric setup failed.");
    } finally {
      setBiometricLoading(false);
    }
  }

  async function requestOtp() {
    if (!isValidGmailAddress(email)) {
      setError(gmailValidationMessage(email));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: normalizeEmail(email) }),
      });
      const data = await responseData<{
        challengeId?: string;
        message?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.challengeId)
        throw new Error(data.error || "Unable to send OTP.");
      setChallengeId(data.challengeId);
      setDeliveryMessage(data.message ?? "OTP sent to your Gmail inbox.");
      setOtp("");
      setStep("otp");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError("Enter the complete 6-digit OTP shown in your Gmail.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", challengeId, code: otp }),
      });
      const data = await responseData<{ verified?: boolean; error?: string }>(response);
      if (!response.ok || !data.verified)
        throw new Error(data.error || "OTP verification failed.");
      setVerified(true);
      setStep("account");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setShowValidation(true);
    if (!verified || !isValidUsername(username) || !isStrongPassword(password) || !displayName.trim() || !idType || !idFile) {
      setError("Complete every account and identity field before continuing.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("challengeId", challengeId);
      form.set("displayName", displayName.trim());
      form.set("username", username.trim().toLowerCase());
      form.set("password", password);
      form.set("idType", idType);
      form.set("governmentId", idFile);
      const response = await fetch("/api/auth/register", { method: "POST", body: form });
      const data = await responseData<{ user?: RegisteredUser; error?: string }>(response);
      if (!response.ok || !data.user)
        throw new Error(data.error || "Registration failed.");
      setRegisteredUsername(data.user.username);
      setStep("submitted");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="registration-dialog">
        <DialogHeader>
          <div className="registration-title-icon"><UserPlus size={21} /></div>
          <DialogTitle>Create patient account</DialogTitle>
          <DialogDescription>
            Verify a Gmail address, create secure login details and attach a government-issued ID.
          </DialogDescription>
        </DialogHeader>
        {step !== "submitted" && <div className="registration-steps" aria-label="Registration progress">
          {["Gmail", "OTP", "Account + ID"].map((label, index) => {
            const activeIndex = step === "email" ? 0 : step === "otp" ? 1 : 2;
            return <span key={label} className={index <= activeIndex ? "active" : ""}>{index < activeIndex ? <CheckCircle2 size={14} /> : index + 1} {label}</span>;
          })}
        </div>}

        {step === "submitted" && (
          <section className="registration-stage registration-approved-stage">
            <div className="registration-stage-icon"><ShieldCheck size={25} /></div>
            <h3>Your patient account is ready</h3>
            <p>Your Gmail OTP was verified and your government ID was securely attached. You can sign in to the Patient Portal immediately—administrator approval is not required.</p>
            <div className="identity-safety-note"><CheckCircle2 size={17} /><span>Use the username and password you just created. Administrators can review the ID later without delaying your access.</span></div>
            <section className={`registration-biometric ${biometricComplete ? "complete" : ""}`}>
              <div className="registration-biometric-icon"><ScanFace size={42} /></div>
              <div>
                <h4>{biometricComplete ? "Biometric login is ready" : "Set up face / biometric login"}</h4>
                <p>{biometricComplete ? "Tap the face picture on the login page—no username or password needed." : "Optional: let this device recognise you securely. Your face image never leaves the device."}</p>
              </div>
              {!biometricComplete && (
                <Button type="button" size="lg" onClick={enrollBiometric} disabled={biometricLoading}>
                  {biometricLoading ? <LoaderCircle className="spin" size={20} /> : <ScanFace size={21} />}
                  {biometricLoading ? "Follow device prompt…" : "Set up on this device"}
                </Button>
              )}
              <button type="button" className="biometric-speak-link" onClick={speakBiometric}>
                <Volume2 size={18} /> Hear instructions
              </button>
              {biometricError && <div className="registration-error" role="alert"><AlertTriangle size={16} />{biometricError}</div>}
            </section>
            <Button size="lg" onClick={() => { onOpenChange(false); reset(); }}>Return to sign in</Button>
          </section>
        )}

        {step === "email" && (
          <section className="registration-stage">
            <div className="registration-stage-icon"><Mail size={25} /></div>
            <h3>Verify your Gmail address</h3>
            <p>We will email a 6-digit code that expires after five minutes.</p>
            <label><span>Gmail address *</span><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="yourname@gmail.com" inputMode="email" type="email" autoComplete="email" /></label>
            {email && !isValidGmailAddress(email) && <small className="field-error">{gmailValidationMessage(email)}</small>}
            <Button size="lg" onClick={requestOtp} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} Email OTP</Button>
          </section>
        )}

        {step === "otp" && (
          <section className="registration-stage otp-stage">
            <div className="registration-stage-icon"><LockKeyhole size={25} /></div>
            <h3>Enter the OTP</h3>
            <p>Sent to {normalizeEmail(email)}. Five incorrect attempts invalidate the code.</p>
            <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric">
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
            </InputOTP>
            {deliveryMessage && (
              <div className="demo-otp-note sms-delivery-note">
                <ShieldCheck size={17} />
                <span><strong>Email sent</strong>{deliveryMessage}</span>
              </div>
            )}
            <div className="registration-actions"><Button variant="outline" onClick={() => setStep("email")}><ArrowLeft size={16} /> Change Gmail</Button><Button variant="outline" onClick={requestOtp} disabled={loading}>Resend email</Button><Button onClick={verifyOtp} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Verify OTP</Button></div>
          </section>
        )}

        {step === "account" && (
          <form className="registration-account" onSubmit={register}>
            <div className="registration-grid">
              <label className="wide-field"><span>Full name *</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" aria-invalid={showValidation && displayName.trim().length < 2} />{showValidation && displayName.trim().length < 2 && <small className="field-error">Enter the patient’s full name.</small>}</label>
              <label><span>Username *</span><Input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} autoComplete="username" placeholder="Example: rozan.a" aria-invalid={showValidation && !isValidUsername(username)} /><small className={showValidation && !isValidUsername(username) ? "field-error" : ""}>{showValidation && !isValidUsername(username) ? "Start with a letter and use 3–24 valid characters." : "3–24 characters; begin with a letter."}</small></label>
              <label><span>Password *</span><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" aria-invalid={showValidation && !isStrongPassword(password)} /><small className={showValidation && !isStrongPassword(password) ? "field-error" : ""}>{showValidation && !isStrongPassword(password) ? "Use at least 8 characters with a letter and number." : "At least 8 characters with a letter and number."}</small></label>
              <label><span>Government ID type *</span><Select value={idType} onValueChange={setIdType}><SelectTrigger aria-invalid={showValidation && !idType}><SelectValue placeholder="Choose ID type" /></SelectTrigger><SelectContent>{["Aadhaar", "PAN", "Voter ID", "Passport", "Driving licence", "Other government ID"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>{showValidation && !idType && <small className="field-error">Choose the government ID type.</small>}</label>
              <label className="id-upload-field"><span>Government ID file *</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setIdFile(event.target.files?.[0] ?? null)} /><div className={idFile ? "has-file" : ""}>{idFile ? <FileCheck2 size={20} /> : <Upload size={20} />}<span>{idFile ? idFile.name : "PDF, JPG, PNG or WebP · maximum 1.5 MB"}</span></div>{showValidation && !idFile && <small className="field-error">Upload a government ID document.</small>}</label>
            </div>
            <div className="identity-safety-note"><AlertTriangle size={17} /><span><strong>Public prototype safety:</strong> upload only a sample or redacted ID. Identity documents require an approved production privacy policy.</span></div>
            <Button type="submit" size="lg" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Create secure patient account</Button>
          </form>
        )}

        {error && <div className="registration-error" role="alert"><AlertTriangle size={16} />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
