"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Stethoscope,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/doctor-directory";
import {
  isStrongPassword,
  isValidPhoneNumber,
  isValidUsername,
  normalizePhone,
} from "@/lib/validation";

type CredentialKind = "councilFile" | "degreeFile" | "identityFile";

async function responseData<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

export function DoctorRegistration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    medicalSystem: "Ayurveda",
    degree: "",
    councilRegistration: "",
    phone: "",
    department: "",
    university: "",
    stateCouncil: "",
    experienceYears: "",
  });
  const [files, setFiles] = useState<Partial<Record<CredentialKind, File>>>({});
  const [declaration, setDeclaration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: number; username: string } | null>(null);

  const valid = useMemo(
    () =>
      form.fullName.trim().length >= 3 &&
      isValidUsername(form.username) &&
      isStrongPassword(form.password) &&
      form.medicalSystem &&
      form.degree.trim().length >= 3 &&
      form.councilRegistration.trim().length >= 4 &&
      isValidPhoneNumber(form.phone) &&
      form.department &&
      form.university.trim().length >= 3 &&
      form.stateCouncil.trim().length >= 3 &&
      Number.isInteger(Number(form.experienceYears)) &&
      Number(form.experienceYears) >= 0 &&
      Number(form.experienceYears) <= 70 &&
      Boolean(files.councilFile && files.degreeFile && files.identityFile) &&
      declaration,
    [form, files, declaration],
  );
  const invalidFields = useMemo(() => [
    form.fullName.trim().length >= 3 ? "" : "Full name",
    isValidUsername(form.username) ? "" : "Login username",
    isStrongPassword(form.password) ? "" : "Password",
    form.degree.trim().length >= 3 ? "" : "Degree and qualifications",
    form.councilRegistration.trim().length >= 4 ? "" : "Medical council registration number",
    isValidPhoneNumber(form.phone) ? "" : "Valid 10-digit mobile number",
    form.department ? "" : "Department assignment",
    form.university.trim().length >= 3 ? "" : "University or medical college",
    form.stateCouncil.trim().length >= 3 ? "" : "State medical council",
    Number.isInteger(Number(form.experienceYears)) && Number(form.experienceYears) >= 0 && Number(form.experienceYears) <= 70 ? "" : "Years of clinical experience",
    files.councilFile ? "" : "Council registration document",
    files.degreeFile ? "" : "Degree certificate",
    files.identityFile ? "" : "Government photo ID",
    declaration ? "" : "Credential declaration",
  ].filter(Boolean), [form, files, declaration]);

  function reset() {
    setForm({
      fullName: "",
      username: "",
      password: "",
      medicalSystem: "Ayurveda",
      degree: "",
      councilRegistration: "",
      phone: "",
      department: "",
      university: "",
      stateCouncil: "",
      experienceYears: "",
    });
    setFiles({});
    setDeclaration(false);
    setError("");
    setShowValidation(false);
    setSubmitted(null);
  }

  function chooseFile(kind: CredentialKind, file?: File) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Each credential document must be smaller than 1.5 MB.");
      return;
    }
    setError("");
    setFiles((current) => ({ ...current, [kind]: file }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowValidation(true);
    if (!valid) {
      setError("Complete every required field and upload all three credential documents.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) body.set(key, value);
      body.set("phone", normalizePhone(form.phone));
      body.set("username", form.username.trim().toLowerCase());
      body.set("councilFile", files.councilFile!);
      body.set("degreeFile", files.degreeFile!);
      body.set("identityFile", files.identityFile!);
      const response = await fetch("/api/auth/doctor-register", {
        method: "POST",
        body,
      });
      const data = await responseData<{
        id?: number;
        username?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.id || !data.username)
        throw new Error(data.error || "Doctor application could not be submitted.");
      setSubmitted({ id: data.id, username: data.username });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Doctor application could not be submitted.",
      );
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
      <DialogContent className="doctor-registration-dialog">
        {submitted ? (
          <section className="doctor-application-success">
            <div><CheckCircle2 size={36} /></div>
            <span>Application #{submitted.id}</span>
            <h2>Credential application submitted</h2>
            <p>
              Hospital administration must verify all three documents before
              EHR access is activated for <strong>@{submitted.username}</strong>.
            </p>
            <div className="credential-status-flow">
              <span className="complete"><CheckCircle2 size={15} /> Submitted</span>
              <span><ShieldCheck size={15} /> Admin review</span>
              <span><BadgeCheck size={15} /> Portal activation</span>
            </div>
            <Button onClick={() => onOpenChange(false)}>Return to doctor login</Button>
          </section>
        ) : (
          <>
            <DialogHeader>
              <div className="registration-title-icon"><Stethoscope size={21} /></div>
              <DialogTitle>User Registration & Medical Credentialing</DialogTitle>
              <DialogDescription>
                Doctor Verification Application · EHR access remains locked until hospital approval.
              </DialogDescription>
            </DialogHeader>
            <form className="doctor-credential-form" onSubmit={submit}>
              <section>
                <div className="credential-section-title">
                  <Stethoscope size={20} />
                  <div><span>Doctor verification application</span><h3>Professional information</h3></div>
                </div>
                <div className="credential-grid">
                  <label><span>Full name *</span><Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Name as printed on certificates" autoComplete="name" /></label>
                  <label><span>Medical System *</span><Select value={form.medicalSystem} onValueChange={(value) => setForm({ ...form, medicalSystem: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ayurveda">Ayurveda</SelectItem><SelectItem value="Ayurveda with modern diagnostic support">Ayurveda with modern diagnostic support</SelectItem><SelectItem value="Integrative Ayurveda">Integrative Ayurveda</SelectItem></SelectContent></Select></label>
                  <label><span>Degree & Qualifications *</span><Input value={form.degree} onChange={(event) => setForm({ ...form, degree: event.target.value })} placeholder="Example: BAMS, MD (Ayurveda)" /></label>
                  <label><span>Medical Council Reg. Number *</span><Input value={form.councilRegistration} onChange={(event) => setForm({ ...form, councilRegistration: event.target.value.toUpperCase() })} placeholder="Registration number" /></label>
                  <label><span>Mobile Phone Number *</span><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} inputMode="tel" placeholder="10-digit mobile number" /></label>
                  <label><span>Department Assignment *</span><Select value={form.department} onValueChange={(value) => setForm({ ...form, department: value })}><SelectTrigger><SelectValue placeholder="Choose Ayurvedic department" /></SelectTrigger><SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></label>
                  <label><span>University / Medical College *</span><Input value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value })} /></label>
                  <label><span>State Medical Council *</span><Input value={form.stateCouncil} onChange={(event) => setForm({ ...form, stateCouncil: event.target.value })} /></label>
                  <label><span>Years of Clinical Experience *</span><Input type="number" min="0" max="70" value={form.experienceYears} onChange={(event) => setForm({ ...form, experienceYears: event.target.value })} /></label>
                  <label><span>Login username *</span><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} placeholder="3–24 characters" autoComplete="username" /></label>
                  <label><span>Create password *</span><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="8+ characters with letter and number" autoComplete="new-password" /></label>
                </div>
              </section>

              <section className="credential-documents-section">
                <div className="credential-section-title">
                  <ShieldCheck size={20} />
                  <div>
                    <span>Mandatory credentials</span>
                    <h3>Identity verification documents</h3>
                    <p>Uploaded certificates are restricted to hospital administrators.</p>
                  </div>
                </div>
                <div className="credential-upload-grid">
                  {([
                    ["councilFile", "1. Council Registration"],
                    ["degreeFile", "2. Degree Certificate"],
                    ["identityFile", "3. Govt Photo ID"],
                  ] as [CredentialKind, string][]).map(([kind, label]) => (
                    <label key={kind} className={files[kind] ? "has-file" : ""}>
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(kind, event.target.files?.[0])} />
                      {files[kind] ? <FileCheck2 size={23} /> : <Upload size={23} />}
                      <strong>{label}</strong>
                      <span>{files[kind]?.name ?? "PDF, JPG, PNG or WebP · max 1.5 MB"}</span>
                    </label>
                  ))}
                </div>
              </section>

              <label className="credential-declaration">
                <Checkbox checked={declaration} onCheckedChange={(value) => setDeclaration(value === true)} />
                <span>I confirm that the professional details and uploaded credentials are authentic and may be verified by hospital administration.</span>
              </label>
              {showValidation && invalidFields.length > 0 && (
                <div className="registration-error credential-validation-list" role="alert">
                  <AlertTriangle size={18} />
                  <div><strong>Correct these sections before submitting:</strong><ul>{invalidFields.map((field) => <li key={field}>{field}</li>)}</ul></div>
                </div>
              )}
              {error && <div className="registration-error" role="alert"><AlertTriangle size={16} />{error}</div>}
              <div className="credential-submit-row">
                <span><GraduationCap size={16} /> EHR access remains disabled while verification is pending.</span>
                <Button type="submit" size="lg" disabled={loading}>
                  {loading ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}
                  Submit verification application
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
