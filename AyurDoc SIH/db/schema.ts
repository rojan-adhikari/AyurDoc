import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const storedFiles = sqliteTable(
  "stored_files",
  {
    objectKey: text("object_key").primaryKey(),
    ownerUsername: text("owner_username").notNull(),
    category: text("category").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    fileData: blob("file_data", { mode: "buffer" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_stored_files_owner_category").on(
      table.ownerUsername,
      table.category,
    ),
  ],
);

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  username: text("username").notNull(),
  role: text("role").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const passkeyChallenges = sqliteTable(
  "passkey_challenges",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().default(""),
    purpose: text("purpose").notNull(),
    challenge: text("challenge").notNull(),
    rpId: text("rp_id").notNull(),
    expectedOrigin: text("expected_origin").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_passkey_challenges_expiry").on(table.expiresAt)],
);

export const passkeyCredentials = sqliteTable(
  "passkey_credentials",
  {
    credentialId: text("credential_id").primaryKey(),
    username: text("username").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").notNull().default("[]"),
    deviceType: text("device_type").notNull().default(""),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
  },
  (table) => [index("idx_passkey_credentials_username").on(table.username)],
);

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    username: text("username").primaryKey(),
    role: text("role").notNull(),
    displayName: text("display_name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    phoneVerifiedAt: text("phone_verified_at"),
    emailVerifiedAt: text("email_verified_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().default("self-registration"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_user_profiles_phone")
      .on(table.phone)
      .where(sql`${table.phone} <> ''`),
    uniqueIndex("idx_user_profiles_email")
      .on(table.email)
      .where(sql`${table.email} <> ''`),
    index("idx_user_profiles_role_active").on(table.role, table.active),
  ],
);

export const otpChallenges = sqliteTable(
  "otp_challenges",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_otp_challenges_phone").on(table.phone),
    index("idx_otp_challenges_email").on(table.email),
  ],
);

export const governmentIds = sqliteTable(
  "government_ids",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    idType: text("id_type").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
    uploadedAt: text("uploaded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_government_ids_status").on(table.reviewStatus)],
);

export const patientAbhaProfiles = sqliteTable(
  "patient_abha_profiles",
  {
    username: text("username").primaryKey(),
    abhaNumber: text("abha_number").notNull().default(""),
    abhaAddress: text("abha_address").notNull().default(""),
    verificationStatus: text("verification_status")
      .notNull()
      .default("not-linked"),
    consentGranted: integer("consent_granted", { mode: "boolean" })
      .notNull()
      .default(false),
    consentedAt: text("consented_at"),
    linkedAt: text("linked_at"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_patient_abha_number")
      .on(table.abhaNumber)
      .where(sql`${table.abhaNumber} <> ''`),
    index("idx_patient_abha_status").on(table.verificationStatus),
  ],
);

export const doctorDirectoryOverrides = sqliteTable("doctor_directory_overrides", {
  doctorId: text("doctor_id").primaryKey(),
  name: text("name"),
  degree: text("degree"),
  department: text("department"),
  hours: text("hours"),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const doctorApplications = sqliteTable(
  "doctor_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    fullName: text("full_name").notNull(),
    medicalSystem: text("medical_system").notNull(),
    degree: text("degree").notNull(),
    councilRegistration: text("council_registration").notNull().unique(),
    phone: text("phone").notNull(),
    department: text("department").notNull(),
    university: text("university").notNull(),
    stateCouncil: text("state_council").notNull(),
    experienceYears: integer("experience_years").notNull(),
    councilFileName: text("council_file_name").notNull(),
    councilContentType: text("council_content_type").notNull(),
    councilSizeBytes: integer("council_size_bytes").notNull(),
    councilObjectKey: text("council_object_key").notNull(),
    degreeFileName: text("degree_file_name").notNull(),
    degreeContentType: text("degree_content_type").notNull(),
    degreeSizeBytes: integer("degree_size_bytes").notNull(),
    degreeObjectKey: text("degree_object_key").notNull(),
    identityFileName: text("identity_file_name").notNull(),
    identityContentType: text("identity_content_type").notNull(),
    identitySizeBytes: integer("identity_size_bytes").notNull(),
    identityObjectKey: text("identity_object_key").notNull(),
    status: text("status").notNull().default("pending"),
    adminNote: text("admin_note").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_doctor_applications_status_created").on(
      table.status,
      table.createdAt,
    ),
    index("idx_doctor_applications_department").on(table.department),
  ],
);

export const facilityInventory = sqliteTable(
  "facility_inventory",
  {
    itemKey: text("item_key").primaryKey(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    totalCount: integer("total_count").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_facility_inventory_category").on(table.category)],
);

export const patientIntakes = sqliteTable(
  "patient_intakes",
  {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientUsername: text("patient_username").notNull(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  sex: text("sex").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  department: text("department").notNull(),
  doctorId: text("doctor_id").notNull().default(""),
  doctorName: text("doctor_name").notNull().default(""),
  language: text("language").notNull(),
  complaint: text("complaint").notNull(),
  onset: text("onset").notNull(),
  symptoms: text("symptoms").notNull(),
  conditions: text("conditions").notNull(),
  allergies: text("allergies").notNull(),
  narrative: text("narrative").notNull().default(""),
  documentName: text("document_name").notNull().default(""),
  documentType: text("document_type").notNull().default(""),
  documentFeedback: text("document_feedback").notNull().default(""),
  documentNotes: text("document_notes").notNull().default(""),
  redFlag: integer("red_flag", { mode: "boolean" }).notNull().default(false),
  consentedAt: text("consented_at").notNull(),
  status: text("status").notNull().default("submitted"),
  doctorNote: text("doctor_note").notNull().default(""),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_patient_intakes_patient_created").on(
      table.patientUsername,
      table.createdAt,
    ),
    index("idx_patient_intakes_doctor_created").on(
      table.doctorId,
      table.createdAt,
    ),
  ],
);

export const emergencyRequests = sqliteTable("emergency_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientUsername: text("patient_username").notNull(),
  patientName: text("patient_name").notNull(),
  phone: text("phone").notNull(),
  bedType: text("bed_type").notNull(),
  symptoms: text("symptoms").notNull(),
  ambulance: integer("ambulance", { mode: "boolean" }).notNull().default(false),
  pickupAddress: text("pickup_address").notNull().default(""),
  status: text("status").notNull().default("alerted"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const bloodRequests = sqliteTable("blood_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientUsername: text("patient_username").notNull(),
  patientName: text("patient_name").notNull(),
  phone: text("phone").notNull(),
  bloodGroup: text("blood_group").notNull(),
  component: text("component").notNull(),
  units: integer("units").notNull(),
  urgency: text("urgency").notNull(),
  hospitalLocation: text("hospital_location").notNull(),
  status: text("status").notNull().default("requested"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const donors = sqliteTable("donors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientUsername: text("patient_username").notNull(),
  donorName: text("donor_name").notNull(),
  phone: text("phone").notNull(),
  bloodGroup: text("blood_group").notNull(),
  donationDate: text("donation_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  eligibleConfirmed: integer("eligible_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status").notNull().default("scheduled"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientUsername: text("patient_username").notNull(),
  patientName: text("patient_name").notNull(),
  phone: text("phone").notNull(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  department: text("department").notNull(),
  visitMode: text("visit_mode").notNull(),
  appointmentDate: text("appointment_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  reason: text("reason").notNull(),
  meetingCode: text("meeting_code").notNull().unique(),
  status: text("status").notNull().default("confirmed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const voiceMessages = sqliteTable("voice_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  intakeId: integer("intake_id").notNull().unique(),
  patientUsername: text("patient_username").notNull(),
  patientName: text("patient_name").notNull(),
  department: text("department").notNull(),
  transcript: text("transcript").notNull().default(""),
  objectKey: text("object_key").notNull(),
  mimeType: text("mime_type").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  status: text("status").notNull().default("unreviewed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const videoSignals = sqliteTable("video_signals", {
  meetingCode: text("meeting_code").primaryKey(),
  offerSdp: text("offer_sdp").notNull().default(""),
  answerSdp: text("answer_sdp").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const medicalDocuments = sqliteTable("medical_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  intakeId: integer("intake_id").notNull().unique(),
  patientUsername: text("patient_username").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  objectKey: text("object_key").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const directVoiceMessages = sqliteTable(
  "direct_voice_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientUsername: text("patient_username").notNull(),
    patientName: text("patient_name").notNull(),
    phone: text("phone").notNull(),
    department: text("department").notNull(),
    doctorId: text("doctor_id").notNull().default(""),
    doctorName: text("doctor_name").notNull().default(""),
    language: text("language").notNull(),
    urgency: text("urgency").notNull().default("Routine"),
    symptomCategory: text("symptom_category").notNull().default(""),
    symptomDuration: text("symptom_duration").notNull().default(""),
    severity: text("severity").notNull().default(""),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    transcript: text("transcript").notNull().default(""),
    summary: text("summary").notNull().default(""),
    status: text("status").notNull().default("new"),
    doctorNote: text("doctor_note").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_direct_voice_patient").on(table.patientUsername),
    index("idx_direct_voice_doctor_created").on(
      table.doctorId,
      table.createdAt,
    ),
    index("idx_direct_voice_status").on(table.status),
  ],
);

export const clinicalWorkflowRecords = sqliteTable(
  "clinical_workflow_records",
  {
    intakeId: integer("intake_id").primaryKey(),
    schemaVersion: text("schema_version").notNull().default("ayurdoc-clinical-v1"),
    structuredJson: text("structured_json").notNull(),
    physicianSummary: text("physician_summary").notNull(),
    fhirBundleJson: text("fhir_bundle_json").notNull(),
    completenessScore: integer("completeness_score").notNull().default(0),
    redFlagCodes: text("red_flag_codes").notNull().default("[]"),
    decision: text("decision").notNull().default("pending"),
    reviewNote: text("review_note").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_clinical_workflow_decision").on(table.decision)],
);

export const consentRecords = sqliteTable(
  "consent_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    intakeId: integer("intake_id").notNull(),
    patientUsername: text("patient_username").notNull(),
    purpose: text("purpose").notNull(),
    scopeJson: text("scope_json").notNull(),
    status: text("status").notNull().default("granted"),
    policyVersion: text("policy_version").notNull().default("ayurdoc-consent-v1"),
    grantedAt: text("granted_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("idx_consent_intake_created").on(table.intakeId, table.grantedAt),
    index("idx_consent_patient_status").on(table.patientUsername, table.status),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    intakeId: integer("intake_id"),
    actorUsername: text("actor_username").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    detailJson: text("detail_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_audit_intake_created").on(table.intakeId, table.createdAt),
    index("idx_audit_actor_created").on(table.actorUsername, table.createdAt),
  ],
);

export const clinicalClarifications = sqliteTable(
  "clinical_clarifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    intakeId: integer("intake_id").notNull(),
    patientUsername: text("patient_username").notNull(),
    doctorUsername: text("doctor_username").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull().default(""),
    language: text("language").notNull().default("English"),
    status: text("status").notNull().default("open"),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    answeredAt: text("answered_at"),
    closedAt: text("closed_at"),
  },
  (table) => [
    index("idx_clarifications_intake_status").on(table.intakeId, table.status),
    index("idx_clarifications_patient_requested").on(table.patientUsername, table.requestedAt),
  ],
);
