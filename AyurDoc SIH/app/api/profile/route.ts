import { env } from "cloudflare:workers";
import { demoAccountFor } from "../../../lib/demo-accounts";
import { doctorForUsername } from "../../../lib/doctor-directory";
import { getAppSession } from "../../../lib/session";

type UserRow = {
  display_name: string;
  phone: string;
  email: string;
};

type IntakeProfileRow = {
  full_name: string;
  age: number;
  sex: string;
  phone: string;
  address: string;
};

type AbhaRow = {
  abha_number: string;
  abha_address: string;
  verification_status: string;
};

type IdentityRow = { review_status: string };

type DoctorApplicationRow = {
  full_name: string;
  degree: string;
  department: string;
  phone: string;
  council_registration: string;
  status: string;
};

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role === "admin")
    return Response.json({ error: "Patient or doctor sign-in required." }, { status: 401 });

  const user = await env.DB.prepare(
    "SELECT display_name, phone, email FROM user_profiles WHERE username = ?",
  ).bind(session.username).first<UserRow>();
  const demo = demoAccountFor(session.username);

  if (session.role === "patient") {
    const [intake, abha, identity] = await Promise.all([
      env.DB.prepare(
        `SELECT full_name, age, sex, phone, address
         FROM patient_intakes WHERE patient_username = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
      ).bind(session.username).first<IntakeProfileRow>(),
      env.DB.prepare(
        `SELECT abha_number, abha_address, verification_status
         FROM patient_abha_profiles WHERE username = ?`,
      ).bind(session.username).first<AbhaRow>(),
      env.DB.prepare(
        "SELECT review_status FROM government_ids WHERE username = ?",
      ).bind(session.username).first<IdentityRow>(),
    ]);

    return Response.json({
      profile: {
        username: session.username,
        role: session.role,
        name: intake?.full_name || user?.display_name || demo?.displayName || session.username,
        email: user?.email || "",
        phone: intake?.phone || user?.phone || "",
        address: intake?.address || "",
        age: intake?.age ? String(intake.age) : "",
        sex: intake?.sex || "",
        abhaNumber: abha?.abha_number || "",
        abhaAddress: abha?.abha_address || "",
        abhaStatus: abha?.verification_status || "not-linked",
        governmentIdStatus: identity?.review_status || "not-uploaded",
      },
    });
  }

  const directoryDoctor = doctorForUsername(session.username);
  const application = await env.DB.prepare(
    `SELECT full_name, degree, department, phone, council_registration, status
     FROM doctor_applications WHERE username = ? ORDER BY id DESC LIMIT 1`,
  ).bind(session.username).first<DoctorApplicationRow>();

  return Response.json({
    profile: {
      username: session.username,
      role: session.role,
      name: directoryDoctor?.name || application?.full_name || user?.display_name || demo?.displayName || "Doctor Supervisor",
      email: user?.email || "",
      phone: application?.phone || user?.phone || "",
      doctorId: directoryDoctor?.id || (session.username === "doctor" ? "SUPERVISOR" : `managed-${session.username}`),
      department: directoryDoctor?.department || application?.department || (session.username === "doctor" ? "All hospital departments" : "Pending assignment"),
      qualification: directoryDoctor?.degree || application?.degree || "Hospital clinical supervisor",
      councilRegistration: application?.council_registration || "",
      credentialStatus: directoryDoctor ? "verified-demo" : application?.status || (session.username === "doctor" ? "supervisor" : "pending"),
    },
  });
}
