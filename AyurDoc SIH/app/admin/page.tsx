"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, BedDouble, CalendarDays, CheckCircle2, Droplets,
  ExternalLink, FileCheck2, History, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus,
  RefreshCw, Search, ShieldCheck, Stethoscope, Trash2, UserRound, Users, Volume2,
  ScanFace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mergeDoctorDirectory, type DoctorOverride, type DoctorProfile } from "../hospital-modules";
import { DEPARTMENTS } from "@/lib/doctor-directory";
import { isValidGmailAddress, isValidPhoneNumber, normalizeEmail, normalizePhone } from "@/lib/validation";
import { AyurDocLogo } from "@/components/ayurdoc-logo";

type AdminUser = {
  username: string; role: "patient" | "doctor" | "admin"; display_name: string; phone: string; email: string;
  active: number; created_by: string; managed: boolean; id_type: string | null;
  review_status: string | null; abha_status: string | null; abha_linked: number;
  abha_number: string | null; abha_address: string | null;
  passkey_count: number;
};
type PatientRegistryRow = {
  patient_username: string; full_name: string; age: number; sex: string; phone: string;
  address: string; department: string; doctor_name: string; intake_count: number; last_seen: string;
};
type OperationRow = Record<string, string | number | boolean | null> & { id: number; status: string };
type OperationsData = {
  patients: PatientRegistryRow[];
  records: Record<string, OperationRow[]>;
  inventory: Array<{ item_key: string; category: string; label: string; total_count: number; updated_at: string | null }>;
  statusOptions: Record<string, string[]>;
};
type AdminDoctor = DoctorProfile & { visible: boolean; managed: boolean };
type DoctorApplication = {
  id: number; username: string; full_name: string; medical_system: string;
  degree: string; council_registration: string; phone: string; department: string;
  university: string; state_council: string; experience_years: number;
  council_file_name: string; degree_file_name: string; identity_file_name: string;
  status: "pending" | "approved" | "rejected"; admin_note: string;
  reviewed_at: string | null; created_at: string;
};
type IntegrationData = {
  services: Array<{
    id: string; label: string; status: "ready" | "needs-configuration" | "available";
    detail: string; requirements: string[];
  }>;
  safeguards: string[];
};

const emptyOperations: OperationsData = {
  patients: [], records: {
    intakes: [], voice: [], appointments: [], emergencies: [], bloodRequests: [], donations: [],
    workflows: [], clarifications: [], documents: [], consents: [], audit: [], identities: [], abha: [],
  },
  inventory: [], statusOptions: {},
};
const emptyIntegrations: IntegrationData = { services: [], safeguards: [] };
const RESOURCE_LABELS: Record<string, string> = {
  intakes: "Clinical intakes", voice: "Voice messages", appointments: "Appointments",
  emergencies: "Emergency requests", bloodRequests: "Blood requests", donations: "Donations",
  workflows: "Clinical workflow records", clarifications: "Doctor clarifications",
  documents: "Medical documents", consents: "Consent history", audit: "System audit trail",
  identities: "Government ID records", abha: "ABHA profiles",
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

function adminDoctorRows(overrides: DoctorOverride[]): AdminDoctor[] {
  const merged: AdminDoctor[] = mergeDoctorDirectory(overrides).map((doctor) => ({
    ...doctor, visible: true, managed: doctor.id.startsWith("managed-"),
  }));
  return merged.sort((a, b) => a.department.localeCompare(b.department));
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [operations, setOperations] = useState<OperationsData>(emptyOperations);
  const [doctorOverrides, setDoctorOverrides] = useState<DoctorOverride[]>([]);
  const [applications, setApplications] = useState<DoctorApplication[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationData>(emptyIntegrations);
  const [applicationNotes, setApplicationNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [adminTab, setAdminTab] = useState("accounts");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountRole, setAccountRole] = useState("all");
  const [resource, setResource] = useState("intakes");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userEdit, setUserEdit] = useState({ displayName: "", email: "", phone: "", newPassword: "", active: true });
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctor | null>(null);
  const [doctorEdit, setDoctorEdit] = useState({ name: "", degree: "", department: "", hours: "" });
  const [form, setForm] = useState({
    username: "", password: "", role: "patient", displayName: "", email: "", phone: "",
    degree: "", department: "", hours: "",
  });
  const doctors = useMemo(() => adminDoctorRows(doctorOverrides), [doctorOverrides]);
  const filteredUsers = useMemo(() => {
    const query = accountQuery.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesRole = accountRole === "all" || user.role === accountRole;
      const haystack = `${user.display_name} ${user.username} ${user.email} ${user.phone}`.toLocaleLowerCase();
      return matchesRole && (!query || haystack.includes(query));
    });
  }, [accountQuery, accountRole, users]);

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [usersResponse, operationsResponse, doctorsResponse, applicationsResponse, integrationsResponse] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/operations", { cache: "no-store" }),
        fetch("/api/doctors", { cache: "no-store" }),
        fetch("/api/admin/doctor-applications", { cache: "no-store" }),
        fetch("/api/admin/integrations", { cache: "no-store" }),
      ]);
      const usersData = (await usersResponse.json()) as { users?: AdminUser[]; error?: string };
      const operationsData = (await operationsResponse.json()) as OperationsData & { error?: string };
      const doctorsData = (await doctorsResponse.json()) as { overrides?: DoctorOverride[]; error?: string };
      const applicationsData = (await applicationsResponse.json()) as { applications?: DoctorApplication[]; error?: string };
      const integrationsData = (await integrationsResponse.json()) as IntegrationData & { error?: string };
      if (!usersResponse.ok) throw new Error(usersData.error || "Unable to load accounts.");
      if (!operationsResponse.ok) throw new Error(operationsData.error || "Unable to load hospital records.");
      if (!doctorsResponse.ok) throw new Error(doctorsData.error || "Unable to load doctors.");
      if (!applicationsResponse.ok) throw new Error(applicationsData.error || "Unable to load credential applications.");
      if (!integrationsResponse.ok) throw new Error(integrationsData.error || "Unable to load integration readiness.");
      setUsers(usersData.users ?? []); setOperations(operationsData); setDoctorOverrides(doctorsData.overrides ?? []);
      setApplications(applicationsData.applications ?? []);
      setIntegrations(integrationsData);
      setApplicationNotes(Object.fromEntries((applicationsData.applications ?? []).map((item) => [item.id, item.admin_note])));
      setInventoryDrafts(Object.fromEntries((operationsData.inventory ?? []).map((item) => [item.item_key, String(item.total_count)])));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load administration data.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? ((await readJsonResponse(response)) as { user?: { role?: string } }) : null)
      .then((data) => { const isAdmin = data?.user?.role === "admin"; setAuthenticated(isAdmin); if (isAdmin) void loadAll(); })
      .finally(() => setChecking(false));
  }, [loadAll]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = (await readJsonResponse(response)) as { user?: { role?: string }; error?: string };
    if (!response.ok || data.user?.role !== "admin") setError(data.error || "Administrator credentials required.");
    else { setAuthenticated(true); await loadAll(); }
    setLoading(false);
  }

  async function addUser(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to create profile.");
    else {
      setForm({ username: "", password: "", role: "patient", displayName: "", email: "", phone: "", degree: "", department: "", hours: "" });
      setMessage("Account created and added to the platform."); await loadAll();
    }
    setLoading(false);
  }

  function beginEditUser(user: AdminUser) {
    setEditingUser(user);
    setUserEdit({ displayName: user.display_name, email: user.email, phone: user.phone, newPassword: "", active: Boolean(user.active) });
  }
  async function saveUser() {
    if (!editingUser) return;
    setLoading(true);
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: editingUser.username, ...userEdit }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to update account.");
    else { setEditingUser(null); setMessage("Account updated."); await loadAll(); }
    setLoading(false);
  }
  async function removeUser(user: AdminUser) {
    if (!window.confirm(`Remove login access for ${user.display_name}? Clinical records will be retained.`)) return;
    setLoading(true);
    const response = await fetch(`/api/admin/users?username=${encodeURIComponent(user.username)}`, { method: "DELETE" });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to remove profile.");
    else { setMessage("Account access removed; clinical records were retained."); await loadAll(); }
    setLoading(false);
  }
  async function clearBiometrics(user: AdminUser) {
    if (!user.passkey_count || !window.confirm(`Remove all biometric/passkey logins for ${user.display_name}? They can enrol this device again later.`)) return;
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, action: "clear-passkeys" }),
    });
    const data = (await readJsonResponse(response)) as { error?: string; removed?: number };
    if (!response.ok) setError(data.error || "Unable to reset biometric access.");
    else { setMessage(`Biometric access reset for @${user.username}. ${data.removed ?? user.passkey_count} enrolled passkey(s) removed.`); await loadAll(); }
    setLoading(false);
  }
  async function reviewIdentity(user: AdminUser, status: "pending" | "verified" | "rejected") {
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/identity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, status }),
    });
    const data = (await readJsonResponse(response)) as { error?: string; accessActive?: boolean };
    if (!response.ok) setError(data.error || "Unable to update identity review.");
    else {
      setMessage(`Identity for @${user.username} marked ${status}. Patient portal access is ${data.accessActive ? "active" : "disabled"} and can be managed separately from account settings.`);
      await loadAll();
    }
    setLoading(false);
  }
  async function reviewAbha(user: AdminUser, status: "verification-pending" | "verified" | "rejected") {
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/abha", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, status }),
    });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to verify ABHA.");
    else { setMessage(`ABHA for @${user.username} marked ${status}.`); await loadAll(); }
    setLoading(false);
  }
  async function archivePatient(patient: PatientRegistryRow) {
    if (!window.confirm(`Archive all platform records for ${patient.full_name}?`)) return;
    setLoading(true);
    const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "patient", username: patient.patient_username }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to archive patient records.");
    else { setMessage("Patient records archived across all modules."); await loadAll(); }
    setLoading(false);
  }

  function beginEditDoctor(doctor: AdminDoctor) {
    setEditingDoctor(doctor); setDoctorEdit({ name: doctor.name, degree: doctor.degree, department: doctor.department, hours: doctor.hours });
  }
  async function saveDoctor() {
    if (!editingDoctor) return;
    setLoading(true);
    const response = await fetch("/api/admin/doctors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingDoctor.id, ...doctorEdit, visible: true }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to update doctor.");
    else { setEditingDoctor(null); setMessage("Doctor directory profile updated."); await loadAll(); }
    setLoading(false);
  }
  async function hideDoctor(doctor: AdminDoctor) {
    if (!window.confirm(`Hide ${doctor.name} from directory, intake and booking lists?`)) return;
    setLoading(true);
    const response = await fetch(`/api/admin/doctors?id=${encodeURIComponent(doctor.id)}`, { method: "DELETE" });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to hide doctor.");
    else { setMessage("Doctor hidden from patient-facing lists."); await loadAll(); }
    setLoading(false);
  }
  async function enableDoctor(doctor: AdminDoctor) {
    setLoading(true);
    const response = await fetch("/api/admin/doctors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doctor.id, name: doctor.name, degree: doctor.degree, department: doctor.department, hours: doctor.hours, visible: true }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to show doctor.");
    else { setMessage("Doctor restored to patient-facing lists."); await loadAll(); }
    setLoading(false);
  }

  async function reviewDoctorApplication(application: DoctorApplication, status: DoctorApplication["status"]) {
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/doctor-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: application.id, status, adminNote: applicationNotes[application.id] ?? "" }),
    });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to review the application.");
    else {
      setMessage(`@${application.username} marked ${status}. ${status === "approved" ? "Doctor portal and EHR access are now active." : "Portal access remains disabled."}`);
      await loadAll();
    }
    setLoading(false);
  }

  async function updateRecord(item: OperationRow) {
    const nextStatus = statusDrafts[`${resource}:${item.id}`] ?? item.status;
    setLoading(true);
    const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, id: item.id, status: nextStatus }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to update record.");
    else { setMessage(`${RESOURCE_LABELS[resource]} record #${item.id} updated.`); await loadAll(); }
    setLoading(false);
  }
  async function updateInventory(itemKey: string) {
    setLoading(true);
    const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "inventory", itemKey, totalCount: Number(inventoryDrafts[itemKey]) }) });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) setError(data.error || "Unable to update inventory.");
    else { setMessage("Live capacity updated for patient and doctor portals."); await loadAll(); }
    setLoading(false);
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setAuthenticated(false); setUsers([]); }

  if (checking) return <main className="admin-loading"><LoaderCircle className="spin" /></main>;
  if (!authenticated) return (
    <main className="admin-login-page"><form className="admin-login-card" onSubmit={login}>
      <Link className="admin-brand-mark" href="/" aria-label="Return to AyurDoc login"><AyurDocLogo size={40} /></Link><span>Restricted system route</span>
      <h1>AyurDoc administration</h1><p>Authorised administrators only.</p>
      <label><span>Administrator username</span><Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
      <label><span>Password</span><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
      {error && <div className="admin-error"><AlertTriangle size={16} />{error}</div>}
      <Button type="submit" disabled={loading || !username || !password}>{loading ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />} Enter administration</Button>
      <small><ShieldCheck size={13} /> Restricted to authorised hospital administrators.</small>
    </form></main>
  );

  const selectedRecords = operations.records[resource] ?? [];
  const pendingIdentityCount = users.filter((user) => user.role === "patient" && user.review_status === "pending").length;
  const pendingAbhaCount = users.filter((user) => user.role === "patient" && Boolean(user.abha_linked) && user.abha_status === "verification-pending").length;
  const pendingCredentialCount = applications.filter((item) => item.status === "pending").length;
  const biometricEnrollmentCount = users.filter((user) => user.passkey_count > 0).length;
  const readyIntegrationCount = integrations.services.filter((service) => service.status !== "needs-configuration").length;
  return (
    <main className="admin-page">
      <header className="admin-topbar"><Link href="/" className="admin-topbar-brand" aria-label="Return to AyurDoc login"><AyurDocLogo size={35} /><strong>AyurDoc</strong><span>Administration</span></Link><div className="admin-topbar-actions"><Button variant="outline" onClick={loadAll} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh all</Button><Button variant="outline" onClick={logout}><LogOut size={16} /> Sign out</Button></div></header>
      <section className="admin-heading"><div><span><ShieldCheck size={15} /> Complete hospital control centre</span><h1>Manage AyurDoc</h1><p>Accounts, patients, Vaidyas, credentialing, clinical activity and live capacity in one place.</p></div></section>
      {error && <div className="admin-error wide" role="alert"><AlertTriangle size={16} />{error}</div>}
      {message && <div className="admin-success wide" role="status"><CheckCircle2 size={16} />{message}</div>}
      <section className="admin-summary-grid">
        <button type="button" onClick={() => setAdminTab("accounts")}><Users /><span><strong>{users.length}</strong>Accounts</span><small>Open management</small></button>
        <button type="button" onClick={() => setAdminTab("patients")}><UserRound /><span><strong>{operations.patients.length}</strong>Patients</span><small>View EHR records</small></button>
        <button type="button" onClick={() => setAdminTab("doctors")}><Stethoscope /><span><strong>{doctors.filter((doctor) => doctor.visible && !doctor.managed).length}</strong>Verified Vaidyas</span><small>Manage directory</small></button>
        <button type="button" onClick={() => setAdminTab("operations")}><Activity /><span><strong>{Object.values(operations.records).reduce((total, rows) => total + rows.length, 0)}</strong>Hospital records</span><small>Review activity</small></button>
        <button type="button" onClick={() => { setAdminTab("accounts"); setAccountRole("patient"); }}><ShieldCheck /><span><strong>{pendingIdentityCount}</strong>Pending IDs</span><small>Review patients</small></button>
        <button type="button" onClick={() => { setAdminTab("accounts"); setAccountRole("patient"); }}><UserRound /><span><strong>{pendingAbhaCount}</strong>Pending ABHA</span><small>Verify identity</small></button>
        <button type="button" onClick={() => setAdminTab("credentialing")}><FileCheck2 /><span><strong>{pendingCredentialCount}</strong>Pending credentials</span><small>Review Vaidyas</small></button>
        <button type="button" onClick={() => setAdminTab("biometrics")}><ScanFace /><span><strong>{biometricEnrollmentCount}</strong>Device biometrics</span><small>View or reset</small></button>
        <button type="button" onClick={() => setAdminTab("readiness")}><Activity /><span><strong>{readyIntegrationCount}/{integrations.services.length || 5}</strong>Integrations ready</span><small>Check connectivity</small></button>
      </section>
      <section className="admin-approval-flow" aria-label="Administrator approval workflow">
        <div><span>1</span><strong>Patient registration</strong><small>Immediate access after OTP and ID upload</small></div>
        <div><span>2</span><strong>ABHA verification</strong><small>Confirm linked health identity</small></div>
        <div><span>3</span><strong>Doctor credentialing</strong><small>Review all three mandatory documents</small></div>
        <div><span>4</span><strong>Clinical operations</strong><small>Monitor routed records, consent and audit</small></div>
      </section>
      <Tabs value={adminTab} onValueChange={setAdminTab} className="admin-workspace">
        <TabsList className="admin-tabs"><TabsTrigger value="accounts"><Users size={15} /> Accounts</TabsTrigger><TabsTrigger value="patients"><History size={15} /> Patients & EHR</TabsTrigger><TabsTrigger value="doctors"><Stethoscope size={15} /> Vaidyas</TabsTrigger><TabsTrigger value="biometrics"><ScanFace size={15} /> Biometrics</TabsTrigger><TabsTrigger value="credentialing"><FileCheck2 size={15} /> Credentialing</TabsTrigger><TabsTrigger value="operations"><CalendarDays size={15} /> Operations</TabsTrigger><TabsTrigger value="inventory"><BedDouble size={15} /> Live inventory</TabsTrigger><TabsTrigger value="readiness"><Activity size={15} /> Readiness</TabsTrigger></TabsList>

        <TabsContent value="accounts" className="admin-tab-panel">
          <div className="admin-grid"><form className="admin-create-card" onSubmit={addUser}><div className="admin-card-title"><Plus size={20} /><div><h2>Add account</h2><p>Create a patient or doctor login.</p></div></div>
            <label><span>Full name</span><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label><span>Account type</span><Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value, department: "", degree: "", hours: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="patient">Patient</SelectItem><SelectItem value="doctor">Vaidya / doctor</SelectItem></SelectContent></Select></label><label><span>Gmail address</span><Input value={form.email} onChange={(event) => setForm({ ...form, email: normalizeEmail(event.target.value) })} type="email" placeholder="name@gmail.com" /></label><label><span>Mobile number (optional)</span><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} inputMode="tel" /></label><label><span>Username</span><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} /></label><label><span>Temporary password</span><Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" /></label>
            {form.role === "doctor" && <><label><span>Qualification</span><Input value={form.degree} onChange={(event) => setForm({ ...form, degree: event.target.value })} placeholder="BAMS, MD (Ayurveda)…" /></label><label><span>Department</span><Select value={form.department} onValueChange={(value) => setForm({ ...form, department: value })}><SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger><SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></label><label><span>Clinic hours</span><Input value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} placeholder="Mon–Fri · 9 AM–2 PM" /></label></>}
            <Button type="submit" disabled={loading || !form.displayName || !form.username || !form.password || !isValidGmailAddress(form.email) || Boolean(form.phone && !isValidPhoneNumber(form.phone))}><Plus size={17} /> Add account</Button></form>
            <section className="admin-users-card"><div className="admin-card-title"><Users size={20} /><div><h2>Existing accounts</h2><p>{filteredUsers.length} of {users.length} patient and doctor logins</p></div></div>
            <div className="admin-account-toolbar"><label><Search size={16} /><Input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="Search name, username, Gmail or phone" aria-label="Search accounts" /></label><Select value={accountRole} onValueChange={setAccountRole}><SelectTrigger aria-label="Filter account type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem><SelectItem value="patient">Patients only</SelectItem><SelectItem value="doctor">Doctors only</SelectItem><SelectItem value="admin">Administrators</SelectItem></SelectContent></Select></div>
            <div className="admin-user-list">
              {filteredUsers.map((user) => <article key={user.username}><div className={`admin-user-icon ${user.role}`}>{user.role === "admin" ? <ShieldCheck size={18} /> : user.role === "doctor" ? <Stethoscope size={18} /> : <UserRound size={18} />}</div><div className="admin-user-copy"><strong>{user.display_name}</strong><span>@{user.username} · {user.role} · {user.active ? "active" : "disabled"}</span><small>{user.email || user.phone || "Protected demo account"}{user.email && user.phone ? ` · ${user.phone}` : ""}{user.id_type ? ` · ${user.id_type} ${user.review_status}` : ""}{user.role === "patient" ? ` · ABHA ${user.abha_linked ? `${user.abha_number}${user.abha_address ? ` · ${user.abha_address}` : ""} · ${user.abha_status}` : "not linked"}` : ""}</small><small><ScanFace size={13} /> Device biometric: {user.passkey_count > 0 ? `${user.passkey_count} enrolled` : "not enrolled"}</small>{user.id_type && <a className="admin-document-link" href={`/api/admin/identity?username=${encodeURIComponent(user.username)}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open government ID</a>}</div><div className="admin-row-actions">{user.id_type && <Select value={user.review_status ?? "pending"} onValueChange={(value) => void reviewIdentity(user, value as "pending" | "verified" | "rejected")}><SelectTrigger aria-label={`Review ID for ${user.username}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">ID review pending</SelectItem><SelectItem value="verified">Mark ID verified</SelectItem><SelectItem value="rejected">Mark ID rejected</SelectItem></SelectContent></Select>}{user.role === "patient" && Boolean(user.abha_linked) && <Select value={user.abha_status ?? "verification-pending"} onValueChange={(value) => void reviewAbha(user, value as "verification-pending" | "verified" | "rejected")}><SelectTrigger aria-label={`Review ABHA for ${user.username}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="verification-pending">ABHA pending</SelectItem><SelectItem value="verified">ABHA verified</SelectItem><SelectItem value="rejected">ABHA rejected</SelectItem></SelectContent></Select>}{user.managed ? <><Button variant="outline" size="icon" aria-label={`Edit ${user.username}`} title="Edit account" onClick={() => beginEditUser(user)}><Pencil size={16} /></Button><Button variant="outline" size="icon" className="danger-action" aria-label={`Remove ${user.username}`} title="Remove account access" onClick={() => void removeUser(user)}><Trash2 size={16} /></Button></> : <span className="admin-protected">Protected</span>}</div></article>)}
              {!filteredUsers.length && <div className="admin-empty">No account matches this search.</div>}
            </div></section></div>
          {editingUser && <section className="admin-inline-editor"><div><h3>Edit @{editingUser.username}</h3><p>Change access, contact details or set a new password.</p></div><div className="admin-editor-grid"><label><span>Full name</span><Input value={userEdit.displayName} onChange={(event) => setUserEdit({ ...userEdit, displayName: event.target.value })} /></label><label><span>Gmail address</span><Input type="email" value={userEdit.email} onChange={(event) => setUserEdit({ ...userEdit, email: normalizeEmail(event.target.value) })} /></label><label><span>Phone (optional)</span><Input value={userEdit.phone} onChange={(event) => setUserEdit({ ...userEdit, phone: normalizePhone(event.target.value) })} /></label><label><span>New password (optional)</span><Input type="password" value={userEdit.newPassword} onChange={(event) => setUserEdit({ ...userEdit, newPassword: event.target.value })} /></label><label><span>Access</span><Select value={userEdit.active ? "active" : "disabled"} onValueChange={(value) => setUserEdit({ ...userEdit, active: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select></label></div><div className="admin-editor-actions"><Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button><Button onClick={saveUser} disabled={!isValidGmailAddress(userEdit.email) || Boolean(userEdit.phone && !isValidPhoneNumber(userEdit.phone))}>Save account</Button></div></section>}
        </TabsContent>

        <TabsContent value="biometrics" className="admin-tab-panel">
          <div className="admin-section-heading"><div><h2>Biometric and passkey access</h2><p>See every account’s enrolled device access and reset it safely if a phone or computer is lost.</p></div></div>
          <div className="admin-biometric-grid">
            {users.map((user) => (
              <article key={`biometric-${user.username}`} className={user.passkey_count ? "enrolled" : ""}>
                <div className="admin-biometric-icon"><ScanFace size={24} /></div>
                <div><strong>{user.display_name}</strong><span>@{user.username} · {user.role}</span><small>{user.passkey_count ? `${user.passkey_count} secure passkey(s) enrolled` : "No biometric device enrolled"}</small></div>
                {user.passkey_count ? (
                  <Button type="button" variant="outline" className="danger-action" disabled={loading} onClick={() => void clearBiometrics(user)}>
                    {loading ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Reset access
                  </Button>
                ) : <span className="admin-readonly-status">Not enrolled</span>}
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="readiness" className="admin-tab-panel">
          <div className="admin-section-heading"><div><h2>Integration and security readiness</h2><p>See which SIH services are active and exactly what still needs authorised hospital credentials.</p></div></div>
          <div className="admin-readiness-grid">
            {integrations.services.map((service) => (
              <article key={service.id} className={`status-${service.status}`}>
                <div>{service.status === "needs-configuration" ? <AlertTriangle size={21} /> : <CheckCircle2 size={21} />}</div>
                <span><strong>{service.label}</strong><p>{service.detail}</p>{service.requirements.length > 0 && <small>Required configuration: {service.requirements.join(" · ")}</small>}</span>
                <em>{service.status === "needs-configuration" ? "Needs setup" : service.status === "ready" ? "Ready" : "Available"}</em>
              </article>
            ))}
          </div>
          <section className="admin-safeguards-card">
            <div className="admin-card-title"><ShieldCheck size={20} /><div><h2>Active safeguards</h2><p>Controls already enforced by AyurDoc.</p></div></div>
            <div>{integrations.safeguards.map((item) => <span key={item}><CheckCircle2 size={16} />{item}</span>)}</div>
            <p><AlertTriangle size={15} /> Formal DPDP compliance still requires institutional policy, a security assessment and legal approval; software alone cannot certify compliance.</p>
          </section>
        </TabsContent>

        <TabsContent value="patients" className="admin-tab-panel"><div className="admin-section-heading"><div><h2>Existing patient details</h2><p>Patients entered through Ayurvedic Intake, including demo and newly registered accounts.</p></div></div><div className="admin-patient-grid">
          {operations.patients.length ? operations.patients.map((patient) => <article key={`${patient.patient_username}-${patient.full_name}`}><div className="admin-patient-head"><div><UserRound size={20} /></div><span><strong>{patient.full_name}</strong><small>@{patient.patient_username} · {patient.age} years · {patient.sex}</small></span></div><dl><div><dt>Phone</dt><dd>{patient.phone}</dd></div><div><dt>Address</dt><dd>{patient.address}</dd></div><div><dt>Department</dt><dd>{patient.department}</dd></div><div><dt>Referred doctor</dt><dd>{patient.doctor_name || "Unassigned"}</dd></div><div><dt>Clinical intakes</dt><dd>{patient.intake_count}</dd></div><div><dt>Last activity</dt><dd>{new Date(patient.last_seen).toLocaleString()}</dd></div></dl><Button variant="outline" className="danger-action" onClick={() => void archivePatient(patient)}><Trash2 size={15} /> Archive patient records</Button></article>) : <div className="admin-empty">No clinical patient records yet.</div>}
        </div></TabsContent>

        <TabsContent value="doctors" className="admin-tab-panel"><div className="admin-section-heading"><div><h2>Vaidya directory management</h2><p>Changes appear in Vaidya search, Ayurvedic Intake, voice referral and appointment booking.</p></div></div><div className="admin-doctor-grid">
          {doctors.map((doctor) => <article key={doctor.id} className={!doctor.visible ? "is-hidden" : ""}><div className={`doctor-avatar tone-${doctor.tone}`}>{doctor.initials}</div><div><span>{doctor.department}</span><h3>{doctor.name}</h3><p>{doctor.degree}</p><small>{doctor.username ? `@${doctor.username} · ` : ""}ID {doctor.id} · {doctor.hours}</small></div><div className="admin-row-actions"><Button variant="outline" size="sm" onClick={() => beginEditDoctor(doctor)}><Pencil size={14} /> Edit</Button>{doctor.visible ? <Button variant="outline" size="sm" className="danger-action" onClick={() => void hideDoctor(doctor)}><Trash2 size={14} /> Hide</Button> : <Button size="sm" onClick={() => void enableDoctor(doctor)}>Show doctor</Button>}</div></article>)}
        </div>{editingDoctor && <section className="admin-inline-editor"><div><h3>Edit {editingDoctor.name}</h3><p>Profile ID: {editingDoctor.id}</p></div><div className="admin-editor-grid"><label><span>Name</span><Input value={doctorEdit.name} onChange={(event) => setDoctorEdit({ ...doctorEdit, name: event.target.value })} /></label><label><span>Department</span><Select value={doctorEdit.department} onValueChange={(value) => setDoctorEdit({ ...doctorEdit, department: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></label><label className="wide"><span>Exact qualification</span><Textarea value={doctorEdit.degree} onChange={(event) => setDoctorEdit({ ...doctorEdit, degree: event.target.value })} /></label><label className="wide"><span>Clinic hours</span><Input value={doctorEdit.hours} onChange={(event) => setDoctorEdit({ ...doctorEdit, hours: event.target.value })} /></label></div><div className="admin-editor-actions"><Button variant="outline" onClick={() => setEditingDoctor(null)}>Cancel</Button><Button onClick={() => void saveDoctor()}>Save Vaidya</Button></div></section>}</TabsContent>

        <TabsContent value="credentialing" className="admin-tab-panel">
          <div className="admin-section-heading"><div><h2>Medical credentialing queue</h2><p>Review professional details and all mandatory documents before activating EHR access.</p></div></div>
          <div className="admin-credential-list">
            {applications.length ? applications.map((application) => (
              <article key={application.id} className={`admin-credential-card status-${application.status}`}>
                <header>
                  <div><FileCheck2 size={21} /></div>
                  <span><strong>{application.full_name}</strong><small>@{application.username} · Application #{application.id}</small></span>
                  <em>{application.status}</em>
                </header>
                <dl>
                  <div><dt>Medical system</dt><dd>{application.medical_system}</dd></div>
                  <div><dt>Degree & qualifications</dt><dd>{application.degree}</dd></div>
                  <div><dt>Council registration</dt><dd>{application.council_registration}</dd></div>
                  <div><dt>Department</dt><dd>{application.department}</dd></div>
                  <div><dt>University / college</dt><dd>{application.university}</dd></div>
                  <div><dt>State council</dt><dd>{application.state_council}</dd></div>
                  <div><dt>Experience</dt><dd>{application.experience_years} years</dd></div>
                  <div><dt>Mobile</dt><dd>{application.phone}</dd></div>
                </dl>
                <div className="admin-credential-documents">
                  <a href={`/api/admin/doctor-applications?id=${application.id}&document=council`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Council registration</a>
                  <a href={`/api/admin/doctor-applications?id=${application.id}&document=degree`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Degree certificate</a>
                  <a href={`/api/admin/doctor-applications?id=${application.id}&document=identity`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Govt photo ID</a>
                </div>
                <label><span>Administrator review note</span><Textarea value={applicationNotes[application.id] ?? ""} onChange={(event) => setApplicationNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Record verification checks, corrections or rejection reason…" /></label>
                <footer>
                  <Button variant="outline" disabled={loading} onClick={() => void reviewDoctorApplication(application, "pending")}>Return to pending</Button>
                  <Button variant="outline" className="danger-action" disabled={loading} onClick={() => void reviewDoctorApplication(application, "rejected")}>Reject</Button>
                  <Button disabled={loading} onClick={() => void reviewDoctorApplication(application, "approved")}><ShieldCheck size={15} /> Approve & activate EHR</Button>
                </footer>
              </article>
            )) : <div className="admin-empty">No doctor credential applications yet.</div>}
          </div>
        </TabsContent>

        <TabsContent value="operations" className="admin-tab-panel"><div className="admin-section-heading"><div><h2>Hospital module records</h2><p>Review and change workflow status without deleting clinical evidence.</p></div><Select value={resource} onValueChange={setResource}><SelectTrigger className="admin-resource-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RESOURCE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="admin-operation-list">
          {selectedRecords.length ? selectedRecords.map((item) => <article key={`${resource}-${item.id}`}><div className="admin-operation-icon">{resource === "voice" ? <Volume2 /> : resource === "emergencies" ? <BedDouble /> : resource === "bloodRequests" || resource === "donations" ? <Droplets /> : resource === "appointments" ? <CalendarDays /> : resource === "documents" || resource === "identities" ? <FileCheck2 /> : resource === "consents" ? <ShieldCheck /> : <Activity />}</div><div className="admin-operation-copy"><strong>#{item.id} · {String(item.patient_name ?? item.full_name ?? item.donor_name ?? item.patient_username ?? "Record")}</strong><span>{String(item.doctor_name ?? item.department ?? item.blood_group ?? item.bed_type ?? item.resource_type ?? item.status ?? "Hospital record")}</span><small>{String(item.summary ?? item.complaint ?? item.question ?? item.answer ?? item.reason ?? item.symptoms ?? item.file_name ?? item.purpose ?? item.action ?? item.id_type ?? item.abha_address ?? item.component ?? item.created_at ?? "")}</small><div className="admin-record-links">{resource === "voice" && item.mime_type !== "text/plain" && <a href={`/api/direct-voice?audio=${item.id}`} target="_blank" rel="noreferrer"><Volume2 size={13} /> Open audio</a>}{resource === "voice" && item.mime_type === "text/plain" && <span><Volume2 size={13} /> Guided transcript</span>}{resource === "documents" && <a href={`/api/documents?intakeId=${item.intake_id}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open document</a>}{resource === "workflows" && <a href={`/api/fhir?intakeId=${item.id}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Export FHIR</a>}</div><details className="admin-record-details"><summary>View complete record</summary><pre>{JSON.stringify(item, null, 2)}</pre></details></div>{(operations.statusOptions[resource] ?? []).length ? <><Select value={statusDrafts[`${resource}:${item.id}`] ?? item.status} onValueChange={(value) => setStatusDrafts((current) => ({ ...current, [`${resource}:${item.id}`]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(operations.statusOptions[resource] ?? []).map((status) => <SelectItem value={status} key={status}>{status}</SelectItem>)}</SelectContent></Select><Button size="sm" onClick={() => void updateRecord(item)}>Save</Button></> : <span className="admin-readonly-status">{String(item.status ?? "stored")}</span>}</article>) : <div className="admin-empty">No records in this module yet.</div>}
        </div></TabsContent>

        <TabsContent value="inventory" className="admin-tab-panel"><div className="admin-section-heading"><div><h2>Live beds and blood inventory</h2><p>These totals immediately drive availability shown on the main patient and doctor pages.</p></div></div><div className="admin-inventory-grid">
          {operations.inventory.map((item) => <article key={item.item_key}><div>{item.category === "bed" ? <BedDouble /> : <Droplets />}</div><span><strong>{item.label}</strong><small>{item.category}</small></span><Input type="number" min="0" max="10000" value={inventoryDrafts[item.item_key] ?? ""} onChange={(event) => setInventoryDrafts((current) => ({ ...current, [item.item_key]: event.target.value }))} /><Button size="sm" onClick={() => void updateInventory(item.item_key)}>Update</Button></article>)}
        </div></TabsContent>
      </Tabs>
    </main>
  );
}
