"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isValidPhoneNumber,
  normalizePhone,
  phoneValidationMessage,
} from "@/lib/validation";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  AudioLines,
  ArrowRight,
  BedDouble,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Droplets,
  HeartHandshake,
  History,
  Hospital,
  IdCard,
  LoaderCircle,
  MessageCircle,
  Mic,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Square,
  Syringe,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DOCTORS as SHARED_DOCTORS } from "@/lib/doctor-directory";
import { createVoiceSummary } from "@/lib/voice-summary";

export type AppRole = "patient" | "doctor";
export type PortalView =
  | "home"
  | "directory"
  | "abha"
  | "voice"
  | "intake"
  | "cases"
  | "emergency"
  | "blood"
  | "appointments"
  | "ehr";

export type DoctorProfile = {
  id: string;
  username?: string;
  name: string;
  degree: string;
  department: string;
  hours: string;
  initials: string;
  tone: string;
};

type HospitalRow = Record<string, string | number | boolean | null>;
type HospitalData = {
  bedAvailability: { type: string; available: number; total: number }[];
  bloodInventory: { group: string; units: number }[];
  componentInventory: { component: string; units: number }[];
  emergencies: HospitalRow[];
  bloodRequests: HospitalRow[];
  donations: HospitalRow[];
  appointments: HospitalRow[];
  updatedAt: string;
};

const emptyHospitalData: HospitalData = {
  bedAvailability: [],
  bloodInventory: [],
  componentInventory: [],
  emergencies: [],
  bloodRequests: [],
  donations: [],
  appointments: [],
  updatedAt: "",
};

const hospitalDataCache: Partial<
  Record<AppRole, { data: HospitalData; fetchedAt: number }>
> = {};
const HOSPITAL_CACHE_MS = 30_000;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

// Kept only as a source-history reference while the live directory is shared.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEGACY_DOCTORS: DoctorProfile[] = [
  {
    id: "card-01",
    name: "Dr. Arjun Mehta",
    degree: "MBBS, MD - General Medicine, DM - Cardiology",
    department: "Cardiology",
    hours: "Mon–Sat · 9:00 AM–1:00 PM",
    initials: "AM",
    tone: "coral",
  },
  {
    id: "neuro-01",
    name: "Dr. Nandini Bose",
    degree: "MBBS, MD - General Medicine, DM - Neurology",
    department: "Neurology",
    hours: "Mon–Fri · 10:00 AM–3:00 PM",
    initials: "NB",
    tone: "violet",
  },
  {
    id: "pedia-01",
    name: "Dr. Meera Iyer",
    degree: "MBBS, MD - Pediatrics",
    department: "Pediatrics",
    hours: "Mon–Sat · 8:30 AM–12:30 PM",
    initials: "MI",
    tone: "sun",
  },
  {
    id: "ortho-01",
    name: "Dr. Vikram Singh",
    degree: "MBBS, MS - Orthopedics",
    department: "Orthopedics",
    hours: "Tue–Sun · 11:00 AM–4:00 PM",
    initials: "VS",
    tone: "blue",
  },
  {
    id: "onco-01",
    name: "Dr. Priya Kulkarni",
    degree: "MBBS, MD - Radiation Oncology",
    department: "Oncology",
    hours: "Mon–Fri · 9:30 AM–2:30 PM",
    initials: "PK",
    tone: "rose",
  },
  {
    id: "gyn-01",
    name: "Dr. Farah Khan",
    degree: "MBBS, MS - Obstetrics & Gynecology",
    department: "Gynecology",
    hours: "Mon–Sat · 10:00 AM–2:00 PM",
    initials: "FK",
    tone: "pink",
  },
  {
    id: "emergency-01",
    name: "Dr. Kabir Sen",
    degree: "MBBS, MD - Emergency Medicine",
    department: "Emergency Medicine",
    hours: "Daily · 24-hour rotating duty",
    initials: "KS",
    tone: "red",
  },
  {
    id: "derma-01",
    name: "Dr. Rohan Das",
    degree: "MBBS, MD - Dermatology, Venereology & Leprosy",
    department: "Dermatology",
    hours: "Mon–Fri · 1:00 PM–5:00 PM",
    initials: "RD",
    tone: "mint",
  },
  {
    id: "radio-01",
    name: "Dr. Ishan Verma",
    degree: "MBBS, MD - Radiodiagnosis",
    department: "Radiology",
    hours: "Mon–Sat · 8:00 AM–4:00 PM",
    initials: "IV",
    tone: "cyan",
  },
  {
    id: "surgery-01",
    name: "Dr. Kavita Menon",
    degree: "MBBS, MS - General Surgery",
    department: "General Surgery",
    hours: "Mon–Fri · 9:00 AM–1:00 PM",
    initials: "KM",
    tone: "green",
  },
  {
    id: "medicine-01",
    name: "Dr. Ananya Rao",
    degree: "MBBS, MD - General Medicine",
    department: "General Medicine",
    hours: "Mon–Sat · 8:00 AM–3:00 PM",
    initials: "AR",
    tone: "mint",
  },
  {
    id: "ent-01",
    name: "Dr. Ayesha Joseph",
    degree: "MBBS, MS - Otorhinolaryngology (ENT)",
    department: "ENT",
    hours: "Mon–Fri · 10:00 AM–4:00 PM",
    initials: "AJ",
    tone: "cyan",
  },
  {
    id: "eye-01",
    name: "Dr. Sandeep Nair",
    degree: "MBBS, MS - Ophthalmology",
    department: "Ophthalmology",
    hours: "Mon–Sat · 9:00 AM–2:00 PM",
    initials: "SN",
    tone: "blue",
  },
  {
    id: "psych-01",
    name: "Dr. Neel Shah",
    degree: "MBBS, MD - Psychiatry",
    department: "Psychiatry",
    hours: "Mon–Fri · 11:00 AM–5:00 PM",
    initials: "NS",
    tone: "violet",
  },
  {
    id: "gastro-01",
    name: "Dr. Devika Pillai",
    degree: "MBBS, MD - General Medicine, DM - Gastroenterology",
    department: "Gastroenterology",
    hours: "Tue–Sat · 9:30 AM–2:30 PM",
    initials: "DP",
    tone: "sun",
  },
  {
    id: "pulmo-01",
    name: "Dr. Sameer Ali",
    degree: "MBBS, MD - Respiratory Medicine",
    department: "Pulmonology",
    hours: "Mon–Sat · 10:00 AM–3:00 PM",
    initials: "SA",
    tone: "teal",
  },
  {
    id: "nephro-01",
    name: "Dr. Lakshmi Krishnan",
    degree: "MBBS, MD - General Medicine, DM - Nephrology",
    department: "Nephrology",
    hours: "Mon–Fri · 8:30 AM–1:30 PM",
    initials: "LK",
    tone: "rose",
  },
  {
    id: "endo-01",
    name: "Dr. Aditi Joshi",
    degree: "MBBS, MD - General Medicine, DM - Endocrinology",
    department: "Endocrinology",
    hours: "Mon–Fri · 12:00 PM–5:00 PM",
    initials: "AJ",
    tone: "pink",
  },
  {
    id: "dental-01",
    name: "Dr. Rahul Jain",
    degree: "BDS, MDS - Oral Medicine & Radiology",
    department: "Dentistry",
    hours: "Mon–Sat · 9:00 AM–4:00 PM",
    initials: "RJ",
    tone: "slate",
  },
  {
    id: "uro-01",
    name: "Dr. Manish Kapoor",
    degree: "MBBS, MS - General Surgery, MCh - Urology",
    department: "Urology",
    hours: "Tue–Sat · 10:00 AM–2:00 PM",
    initials: "MK",
    tone: "coral",
  },
];

export const DOCTORS: DoctorProfile[] = SHARED_DOCTORS;

export type DoctorOverride = {
  doctor_id: string;
  name: string | null;
  degree: string | null;
  department: string | null;
  hours: string | null;
  visible: number | boolean;
};

let doctorDirectoryCache: DoctorProfile[] | null = null;

export function mergeDoctorDirectory(overrides: DoctorOverride[]) {
  const overrideMap = new Map(overrides.map((item) => [item.doctor_id, item]));
  const merged = DOCTORS.flatMap((doctor) => {
    const override = overrideMap.get(doctor.id);
    if (override && !Boolean(override.visible)) return [];
    return [
      {
        ...doctor,
        name: override?.name || doctor.name,
        degree: override?.degree || doctor.degree,
        department: override?.department || doctor.department,
        hours: override?.hours || doctor.hours,
      },
    ];
  });
  // The public referral directory is intentionally limited to the nine
  // verified department Vaidyas. Approved additional accounts retain portal
  // access and remain manageable by administrators without expanding routing.
  return merged;
}

export function useDoctorDirectory() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>(
    doctorDirectoryCache ?? DOCTORS,
  );
  useEffect(() => {
    let active = true;
    fetch("/api/doctors", { cache: "no-store" })
      .then(async (response) => {
        const result = (await readJsonResponse(response)) as {
          overrides?: DoctorOverride[];
        };
        if (!response.ok) throw new Error("Unable to load doctor directory.");
        const merged = mergeDoctorDirectory(result.overrides ?? []);
        doctorDirectoryCache = merged;
        if (active) setDoctors(merged);
      })
      .catch(() => {
        if (active) setDoctors(doctorDirectoryCache ?? DOCTORS);
      });
    return () => {
      active = false;
    };
  }, []);
  return doctors;
}

export const NAV_ITEMS: {
  id: PortalView;
  label: string;
  patient: boolean;
  doctor: boolean;
  icon: typeof Hospital;
}[] = [
  {
    id: "home",
    label: "Overview",
    patient: true,
    doctor: true,
    icon: Hospital,
  },
  {
    id: "directory",
    label: "Find a Vaidya",
    patient: true,
    doctor: false,
    icon: Users,
  },
  {
    id: "abha",
    label: "ABHA profile",
    patient: true,
    doctor: false,
    icon: IdCard,
  },
  {
    id: "voice",
    label: "Voice to Vaidya",
    patient: true,
    doctor: true,
    icon: AudioLines,
  },
  {
    id: "intake",
    label: "Ayurvedic intake",
    patient: true,
    doctor: false,
    icon: Activity,
  },
  {
    id: "cases",
    label: "My clinical cases",
    patient: true,
    doctor: false,
    icon: History,
  },
  {
    id: "emergency",
    label: "Emergency & beds",
    patient: true,
    doctor: true,
    icon: BedDouble,
  },
  {
    id: "blood",
    label: "Blood bank",
    patient: true,
    doctor: true,
    icon: Droplets,
  },
  {
    id: "appointments",
    label: "Appointments",
    patient: true,
    doctor: true,
    icon: CalendarDays,
  },
  {
    id: "ehr",
    label: "Patient EHR",
    patient: false,
    doctor: true,
    icon: History,
  },
];

function Pill({
  children,
  tone = "teal",
}: {
  children: React.ReactNode;
  tone?: "teal" | "red" | "amber" | "slate";
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function useHospitalData(role: AppRole) {
  const initialCache = hospitalDataCache[role];
  const [data, setData] = useState<HospitalData>(
    initialCache?.data ?? emptyHospitalData,
  );
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hospital", { cache: "no-store" });
      const result = (await readJsonResponse(response)) as HospitalData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Unable to load hospital data.");
      hospitalDataCache[role] = { data: result, fetchedAt: Date.now() };
      setData(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load hospital data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = hospitalDataCache[role];
    if (cached && Date.now() - cached.fetchedAt < HOSPITAL_CACHE_MS) return;
    let active = true;
    fetch("/api/hospital", { cache: "no-store" })
      .then(async (response) => {
        const result = (await readJsonResponse(response)) as HospitalData & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error || "Unable to load hospital data.");
        if (active) {
          hospitalDataCache[role] = { data: result, fetchedAt: Date.now() };
          setData(result);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load hospital data.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role]);
  return { data, loading, error, refresh };
}

async function postHospital(payload: Record<string, unknown>) {
  const response = await fetch("/api/hospital", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await readJsonResponse(response)) as {
    id?: number;
    error?: string;
    meetingCode?: string;
    status?: string;
  };
  if (!response.ok)
    throw new Error(result.error || "Request could not be submitted.");
  return result;
}

function videoMeetingUrl(meetingCode: string) {
  const roomName = `AyurDoc-${meetingCode.replace(/[^a-zA-Z0-9]/g, "")}`;
  return `https://meet.ffmuc.net/${roomName}#config.p2p.enabled=false&config.disableDeepLinking=true`;
}

export function PortalNavigation({
  role,
  active,
  onChange,
  language = "English",
}: {
  role: AppRole;
  active: PortalView;
  onChange: (view: PortalView) => void;
  language?: string;
}) {
  const navigationRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const navigationItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) =>
        role === "patient" ? item.patient : item.doctor,
      ),
    [role],
  );
  const translatedLabels: Record<
    string,
    Partial<Record<PortalView, string>>
  > = {
    हिन्दी: {
      home: "मुख्य पृष्ठ",
      directory: "वैद्य खोजें",
      abha: "ABHA प्रोफ़ाइल",
      voice: "वैद्य को आवाज़",
      intake: "आयुर्वेदिक जानकारी",
      cases: "मेरे क्लिनिकल केस",
      emergency: "आपातकाल और बेड",
      blood: "ब्लड बैंक",
      appointments: "अपॉइंटमेंट",
      ehr: "रोगी रिकॉर्ड",
    },
    தமிழ்: {
      home: "முகப்பு",
      directory: "வைத்தியரை தேடுங்கள்",
      abha: "ABHA சுயவிவரம்",
      voice: "வைத்தியருக்கு குரல்",
      intake: "ஆயுர்வேத விவரங்கள்",
      cases: "எனது மருத்துவ வழக்குகள்",
      emergency: "அவசரம் மற்றும் படுக்கைகள்",
      blood: "இரத்த வங்கி",
      appointments: "சந்திப்புகள்",
      ehr: "நோயாளர் பதிவு",
    },
  };
  useEffect(() => {
    const activeIndex = navigationItems.findIndex((item) => item.id === active);
    const activeButton = buttonRefs.current[activeIndex];
    const navigation = navigationRef.current;
    if (!activeButton || !navigation) return;
    const targetLeft =
      activeButton.offsetLeft -
      (navigation.clientWidth - activeButton.offsetWidth) / 2;
    navigation.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [active, navigationItems]);

  function activate(view: PortalView) {
    onChange(view);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  function moveFocus(currentIndex: number, direction: number) {
    const nextIndex =
      (currentIndex + direction + navigationItems.length) %
      navigationItems.length;
    buttonRefs.current[nextIndex]?.focus();
    activate(navigationItems[nextIndex].id);
  }

  return (
    <nav
      ref={navigationRef}
      className="portal-navigation"
      aria-label="Hospital modules"
    >
      <div className="portal-nav-inner" role="tablist" aria-label="Portal sections">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-controls="portal-content"
              aria-selected={active === item.id}
              tabIndex={active === item.id ? 0 : -1}
              className={active === item.id ? "active" : ""}
              onClick={() => activate(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(index, -1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  buttonRefs.current[0]?.focus();
                  activate(navigationItems[0].id);
                } else if (event.key === "End") {
                  event.preventDefault();
                  const last = navigationItems.length - 1;
                  buttonRefs.current[last]?.focus();
                  activate(navigationItems[last].id);
                }
              }}
            >
              <Icon size={15} />
              <span>{translatedLabels[language]?.[item.id] ?? item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PortalOverview({
  role,
  onNavigate,
}: {
  role: AppRole;
  onNavigate: (view: PortalView) => void;
  language?: VoiceLanguage;
}) {
  const doctors = useDoctorDirectory();
  const { data } = useHospitalData(role);
  const urgent = data.emergencies.filter(
    (item) => ["alerted", "dispatched", "admitted"].includes(String(item.status)),
  ).length;
  const nextAppointment = data.appointments[0];
  const modules =
    role === "patient"
      ? [
          {
            id: "voice" as PortalView,
            icon: AudioLines,
            title: "Voice to doctor",
            text: "Record your concern with live English, Hindi or Tamil captions.",
            accent: "green",
          },
          {
            id: "intake" as PortalView,
            icon: Activity,
            title: "Start clinical intake",
            text: "Share symptoms and history before meeting the doctor.",
            accent: "teal",
          },
          {
            id: "cases" as PortalView,
            icon: History,
            title: "My clinical cases",
            text: "Track physician review, answer questions and manage consent.",
            accent: "blue",
          },
          {
            id: "directory" as PortalView,
            icon: Stethoscope,
            title: "Find the right specialist",
            text: `Use symptom guidance and explore ${doctors.length} specialists.`,
            accent: "blue",
          },
          {
            id: "abha" as PortalView,
            icon: IdCard,
            title: "Link ABHA profile",
            text: "Connect your 14-digit ABDM health identity with informed consent.",
            accent: "green",
          },
          {
            id: "emergency" as PortalView,
            icon: Ambulance,
            title: "Emergency & bed request",
            text: "Check availability and alert triage before arrival.",
            accent: "red",
          },
          {
            id: "blood" as PortalView,
            icon: Droplets,
            title: "Blood bank services",
            text: "Request blood, check inventory or register as a donor.",
            accent: "rose",
          },
          {
            id: "appointments" as PortalView,
            icon: CalendarDays,
            title: "Book consultation",
            text: "Choose in-person or secure video consultation.",
            accent: "violet",
          },
        ]
      : [
          {
            id: "voice" as PortalView,
            icon: AudioLines,
            title: "Patient voice messages",
            text: "",
            accent: "green",
          },
          {
            id: "ehr" as PortalView,
            icon: History,
            title: "Patient EHR queue",
            text: "Review patient profiles, histories, documents and notes.",
            accent: "teal",
          },
          {
            id: "emergency" as PortalView,
            icon: Ambulance,
            title: "Emergency command",
            text: `${urgent} active request${urgent === 1 ? "" : "s"} need operational review.`,
            accent: "red",
          },
          {
            id: "appointments" as PortalView,
            icon: Video,
            title: "Consultation schedule",
            text: nextAppointment
              ? `Next: ${String(nextAppointment.patient_name)} · ${String(nextAppointment.time_slot)}`
              : "No appointments scheduled yet.",
            accent: "violet",
          },
          {
            id: "blood" as PortalView,
            icon: Droplets,
            title: "Blood bank requests",
            text: "Monitor current inventory and urgent unit requests.",
            accent: "rose",
          },
        ];
  return (
    <section className="module-page">
      <header className="module-hero overview-hero">
        <div>
          <Pill tone="teal">
            <ShieldCheck size={13} />{" "}
            {role === "patient"
              ? "Patient care workspace"
              : "Doctor operations workspace"}
          </Pill>
          <h1>{role === "patient" ? "AyurDoc care workspace" : "Clinical operations workspace"}</h1>
          <p>
            {role === "patient"
              ? "Choose a service below. Emergency help stays one tap away throughout the portal."
              : "Review clinical, emergency, appointment and blood-bank activity from one secure portal."}
          </p>
        </div>
        <div className="overview-care-path" aria-label="AyurDoc care pathway">
          <div><AudioLines size={19} /><span>Listen</span></div>
          <ArrowRight size={15} />
          <div><Activity size={19} /><span>Structure</span></div>
          <ArrowRight size={15} />
          <div><Stethoscope size={19} /><span>Verify</span></div>
        </div>
      </header>
      <div className="module-card-grid">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`module-entry accent-${item.accent}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              <div className="module-entry-icon">
                <Icon size={22} />
              </div>
              <div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </div>
              <ArrowRight size={18} />
            </button>
          );
        })}
      </div>
      <div className="safety-strip">
        <AlertTriangle size={17} />
        <span>
          <strong>Emergency symptoms?</strong> Severe chest pain, major
          bleeding, breathing difficulty, unconsciousness or stroke signs
          require immediate emergency services.
        </span>
        <Button size="sm" onClick={() => onNavigate("emergency")}>
          Open emergency form
        </Button>
      </div>
    </section>
  );
}

const TRIAGE: Record<
  string,
  { department: string; note: string; urgent?: boolean }
> = {
  "Fever, weakness or a general health concern": {
    department: "Kayachikitsa (General & Internal Medicine)",
    note: "A Kayachikitsa Vaidya can take the first detailed history. Breathing difficulty, fainting or rapid worsening needs emergency care.",
    urgent: true,
  },
  "Digestion, appetite or bowel concern": {
    department: "Kayachikitsa (General & Internal Medicine)",
    note: "Bring recent reports and list both prescribed and herbal products. Blood in vomit or stool needs urgent care.",
  },
  "Skin, hair, rash or itching concern": {
    department: "Twacha Roga & Dermatology (Skin Clinic)",
    note: "Face swelling or breathing difficulty can indicate a severe allergic emergency.",
  },
  "Joint, injury, wound or mobility concern": {
    department: "Shalya Tantra (Surgery, Ortho & Wound Care)",
    note: "Major trauma, deformity, uncontrolled bleeding or inability to move requires emergency assessment.",
  },
  "Menstrual, pregnancy or women's health concern": {
    department: "Prasuti Tantra & Stri Roga (Gynecology)",
    note: "Heavy bleeding, severe pain or reduced fetal movement requires urgent care.",
  },
  "Eye, ear, nose, throat or vision concern": {
    department: "Shalakya Tantra (ENT & Ophthalmology)",
    note: "Sudden vision loss, chemical exposure, severe swallowing difficulty or a foreign body needs emergency care.",
  },
  "Child health, growth or recurrent illness": {
    department: "Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics)",
    note: "A Bala Roga Vaidya can review growth, feeding, sleep and recurrent concerns. Breathing difficulty, severe dehydration, seizure or unusual drowsiness needs urgent pediatric care.",
    urgent: true,
  },
  "Recovery, stiffness or supervised Panchakarma": {
    department: "Panchakarma & Rehabilitation",
    note: "Panchakarma procedures require an in-person assessment and medical screening. Do not start detoxification or therapeutic procedures without a qualified Vaidya.",
  },
  "Lifestyle, diet, prevention or yoga guidance": {
    department: "Swasthavritta & Yoga (Preventive Lifestyle Care)",
    note: "Choose this service for preventive routines, sleep, movement and clinician-guided lifestyle planning. New or severe symptoms should be assessed clinically first.",
  },
  "Stress, sleep or emotional wellbeing concern": {
    department: "Manasa Roga (Mental Health, Sleep & Stress)",
    note: "A Manasa Roga Vaidya can provide a first assessment. Thoughts of self-harm, severe confusion or immediate danger require urgent local emergency support.",
    urgent: true,
  },
};

export function DoctorDirectory({
  onBook,
}: {
  onBook: (doctorId: string) => void;
}) {
  const doctors = useDoctorDirectory();
  const [symptom, setSymptom] = useState("");
  const [search, setSearch] = useState("");
  const guidance = TRIAGE[symptom];
  const filtered = doctors.filter((doctor) =>
    `${doctor.name} ${doctor.department} ${doctor.degree}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="module-page">
      <header className="module-hero">
        <div>
          <Pill tone="teal">
            <Stethoscope size={13} /> Initial consultation guide
          </Pill>
          <h1>Find the right Vaidya first.</h1>
          <p>
            Choose the closest symptom for department guidance, then book a
            suitable Ayurveda specialist.
          </p>
        </div>
        <div className="demo-badge">{doctors.length} Ayurveda specialists</div>
      </header>
      <div className="triage-guide">
        <div>
          <label>What best describes the concern?</label>
          <Select value={symptom} onValueChange={setSymptom}>
            <SelectTrigger>
              <SelectValue placeholder="Select an initial symptom" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TRIAGE).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {guidance ? (
          <div className={`triage-result ${guidance.urgent ? "urgent" : ""}`}>
            <div>
              <Activity size={21} />
            </div>
            <span>
              <small>Suggested first department</small>
              <strong>{guidance.department}</strong>
              <p>{guidance.note}</p>
            </span>
          </div>
        ) : (
          <div className="triage-placeholder">
            <MessageCircle size={21} />
            <span>Select a symptom to see safe first-contact guidance.</span>
          </div>
        )}
      </div>
      <div className="directory-toolbar">
        <div>
          <span className="mini-label">
            {doctors.length} available profiles
          </span>
          <h2>Specialist directory</h2>
        </div>
        <label className="search-box">
          <Search size={15} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search doctor or department"
          />
        </label>
      </div>
      <div className="doctor-directory-grid">
        {filtered.map((doctor) => (
          <article className="doctor-profile-card" key={doctor.id}>
            <div className={`doctor-avatar tone-${doctor.tone}`}>
              {doctor.initials}
            </div>
            <div className="doctor-profile-copy">
              <Pill tone="slate">{doctor.department}</Pill>
              <h3>{doctor.name}</h3>
              <span className="doctor-id-label" data-no-translate>
                Doctor ID · {doctor.id}
              </span>
              <p className="doctor-degree">{doctor.degree}</p>
              <div className="doctor-hours">
                <Clock3 size={14} /> {doctor.hours}
              </div>
            </div>
            <Button variant="outline" onClick={() => onBook(doctor.id)}>
              Book <ArrowRight size={14} />
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EmergencyBeds({ role }: { role: AppRole }) {
  const { data, loading, error, refresh } = useHospitalData(role);
  const [form, setForm] = useState({
    patientName: "",
    phone: "",
    bedType: "",
    symptoms: "",
    ambulance: false,
    pickupAddress: "",
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  async function submit() {
    setSending(true);
    setFormError("");
    try {
      const result = await postHospital({ action: "emergency", ...form });
      setSuccess(`Emergency request #${result.id} sent to the triage desk.`);
      setForm({
        patientName: "",
        phone: "",
        bedType: "",
        symptoms: "",
        ambulance: false,
        pickupAddress: "",
      });
      await refresh();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Request failed.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="module-page">
      <header className="module-hero emergency-hero">
        <div>
          <Pill tone="red">
            <Ambulance size={13} /> Emergency coordination
          </Pill>
          <h1>Bed availability & rapid request</h1>
          <p>
            Availability is updated from open requests. Final allocation is
            confirmed by hospital staff.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}{" "}
          Refresh live data
        </Button>
      </header>
      {(error || formError) && (
        <div className="module-alert error">
          <AlertTriangle size={16} /> {error || formError}
        </div>
      )}
      {success && (
        <div className="module-alert success">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      <div className="bed-grid">
        {data.bedAvailability.map((bed) => {
          const percent = Math.round((bed.available / bed.total) * 100);
          return (
            <article key={bed.type} className="bed-card">
              <div className="bed-card-head">
                <div>
                  <BedDouble size={18} />
                  <span>{bed.type}</span>
                </div>
                <Pill
                  tone={
                    bed.available < 4
                      ? "red"
                      : bed.available < 10
                        ? "amber"
                        : "teal"
                  }
                >
                  {bed.available} available
                </Pill>
              </div>
              <div className="availability-bar">
                <span style={{ width: `${percent}%` }} />
              </div>
              <small>
                {bed.total - bed.available} requested or occupied · capacity{" "}
                {bed.total}
              </small>
            </article>
          );
        })}
      </div>
      <div className="emergency-layout">
        {role === "patient" ? (
          <div className="service-form">
            <div className="service-form-head">
              <div className="service-icon red">
                <Ambulance size={22} />
              </div>
              <div>
                <span className="mini-label">Quick-fill emergency request</span>
                <h2>Alert triage before arrival</h2>
              </div>
            </div>
            <div className="service-form-grid">
              <label>
                <span>Patient name *</span>
                <Input
                  value={form.patientName}
                  onChange={(e) =>
                    setForm({ ...form, patientName: e.target.value })
                  }
                  placeholder="Full name"
                />
              </label>
              <label>
                <span>Mobile number *</span>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  placeholder="10-digit number"
                />
              </label>
              <label>
                <span>Bed/service requested *</span>
                <Select
                  value={form.bedType}
                  onValueChange={(value) =>
                    setForm({ ...form, bedType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose service" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "OPD Observation",
                      "ICU",
                      "CCU",
                      "General Ward",
                      "Private Ward",
                    ].map((item) => (
                      <SelectItem value={item} key={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="span-two">
                <span>Current symptoms or emergency details *</span>
                <Textarea
                  value={form.symptoms}
                  onChange={(e) =>
                    setForm({ ...form, symptoms: e.target.value })
                  }
                  placeholder="Describe the emergency clearly"
                />
              </label>
              <label className="ambulance-toggle span-two">
                <Checkbox
                  checked={form.ambulance}
                  onCheckedChange={(value) =>
                    setForm({ ...form, ambulance: value === true })
                  }
                />
                <span>
                  <strong>Request immediate ambulance pickup</strong>Send pickup
                  details to the emergency coordination desk.
                </span>
              </label>
              {form.ambulance && (
                <label className="span-two">
                  <span>Pickup address *</span>
                  <Textarea
                    value={form.pickupAddress}
                    onChange={(e) =>
                      setForm({ ...form, pickupAddress: e.target.value })
                    }
                    placeholder="Landmark, street, locality and city"
                  />
                </label>
              )}
            </div>
            <Button
              className="emergency-submit"
              onClick={submit}
              disabled={sending}
            >
              {sending ? (
                <>
                  <LoaderCircle className="spin" size={16} /> Sending alert…
                </>
              ) : (
                <>
                  <Ambulance size={16} /> Submit emergency request
                </>
              )}
            </Button>
          </div>
        ) : (
          <OperationsList
            title="Emergency submissions"
            rows={data.emergencies}
            type="emergency"
            refresh={refresh}
          />
        )}
        <aside className="emergency-contact">
          <div className="service-icon red">
            <Phone size={22} />
          </div>
          <h2>Immediate danger?</h2>
          <p>
            Call your local emergency number now for severe breathing
            difficulty, unconsciousness, major bleeding, stroke signs or severe
            chest pain.
          </p>
          <div className="emergency-line">
            <span>Hospital triage demo</span>
            <strong>24 × 7 response desk</strong>
          </div>
          <div className="integration-list">
            <div>
              <Check size={14} /> Bed desk alerted
            </div>
            <div>
              <Check size={14} /> Ambulance request routed
            </div>
            <div>
              <Check size={14} /> Doctor dashboard updated
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function OperationsList({
  title,
  rows,
  type,
  refresh,
}: {
  title: string;
  rows: HospitalRow[];
  type: "emergency" | "blood" | "appointment";
  refresh: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState<number | null>(null);
  async function update(id: number, status: string) {
    setUpdating(id);
    await fetch("/api/hospital", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: type, id, status }),
    });
    await refresh();
    setUpdating(null);
  }
  return (
    <div className="operations-list">
      <div className="operations-title">
        <div>
          <span className="mini-label">Live operational records</span>
          <h2>{title}</h2>
        </div>
        <Pill tone="slate">{rows.length} records</Pill>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <article key={Number(row.id)} className="operation-row">
            <div className="operation-main">
              <strong>
                {String(row.patient_name ?? row.donor_name ?? "Patient")}
              </strong>
              <span>
                {String(
                  row.bed_type ??
                    row.blood_group ??
                    row.doctor_name ??
                    "Request",
                )}{" "}
                · {String(row.created_at ?? "")}
              </span>
              <p>{String(row.symptoms ?? row.component ?? row.reason ?? "")}</p>
            </div>
            <div className="operation-actions">
              <Pill
                tone={
                  row.status === "closed" || row.status === "completed"
                    ? "teal"
                    : "amber"
                }
              >
                {String(row.status)}
              </Pill>
              {type === "emergency" && row.ambulance ? (
                <Pill tone="red">
                  <Ambulance size={11} /> Pickup
                </Pill>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={updating === Number(row.id)}
                onClick={() =>
                  update(
                    Number(row.id),
                    type === "appointment" ? "completed" : "closed",
                  )
                }
              >
                {updating === Number(row.id) ? (
                  <LoaderCircle className="spin" size={13} />
                ) : (
                  <Check size={13} />
                )}{" "}
                Close
              </Button>
            </div>
          </article>
        ))
      ) : (
        <div className="empty-module">
          <CheckCircle2 size={24} />
          <span>No records in this queue.</span>
        </div>
      )}
    </div>
  );
}

export function BloodBank({ role }: { role: AppRole }) {
  const { data, loading, error, refresh } = useHospitalData(role);
  const [request, setRequest] = useState({
    patientName: "",
    phone: "",
    bloodGroup: "",
    component: "Packed Red Blood Cells",
    units: "1",
    urgency: "",
    hospitalLocation: "",
  });
  const [donor, setDonor] = useState({
    donorName: "",
    phone: "",
    bloodGroup: "",
    donationDate: "",
    timeSlot: "",
    eligibleConfirmed: false,
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(payload: Record<string, unknown>, reset: () => void) {
    setSending(true);
    setFormError("");
    try {
      const result = await postHospital(payload);
      setMessage(`Request #${result.id} submitted successfully.`);
      reset();
      await refresh();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Request failed.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="module-page">
      <header className="module-hero blood-hero">
        <div>
          <Pill tone="red">
            <Droplets size={13} /> Live blood services
          </Pill>
          <h1>Blood bank & donor network</h1>
          <p>
            View estimated available units, request urgent components and
            schedule voluntary donation.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}{" "}
          Refresh inventory
        </Button>
      </header>
      {(error || formError) && (
        <div className="module-alert error">
          <AlertTriangle size={16} /> {error || formError}
        </div>
      )}
      {message && (
        <div className="module-alert success">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
      <div className="blood-type-grid">
        {data.bloodInventory.map((item) => (
          <article
            key={item.group}
            className={`blood-type-card ${item.units < 8 ? "low" : ""}`}
          >
            <div className="blood-drop">
              <Droplets size={17} />
            </div>
            <strong>{item.group}</strong>
            <span>{item.units} units</span>
            <small>{item.units < 8 ? "Low stock" : "Available"}</small>
          </article>
        ))}
      </div>
      <div className="component-row">
        {data.componentInventory.map((item) => (
          <div key={item.component}>
            <Syringe size={17} />
            <span>
              <strong>{item.units} units</strong>
              {item.component}
            </span>
          </div>
        ))}
        <small>
          Updated{" "}
          {data.updatedAt
            ? new Date(data.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "now"}
        </small>
      </div>
      {role === "doctor" ? (
        <OperationsList
          title="Emergency blood requests"
          rows={data.bloodRequests}
          type="blood"
          refresh={refresh}
        />
      ) : (
        <Tabs defaultValue="request" className="blood-tabs">
          <TabsList>
            <TabsTrigger value="request">
              <Droplets size={14} /> Request blood
            </TabsTrigger>
            <TabsTrigger value="donate">
              <HeartHandshake size={14} /> Become a donor
            </TabsTrigger>
            <TabsTrigger value="history">
              <History size={14} /> My records
            </TabsTrigger>
          </TabsList>
          <TabsContent value="request">
            <div className="service-form blood-form">
              <div className="service-form-head">
                <div className="service-icon red">
                  <Droplets size={22} />
                </div>
                <div>
                  <span className="mini-label">Critical unit request</span>
                  <h2>Emergency blood request</h2>
                </div>
              </div>
              <div className="service-form-grid">
                <label>
                  <span>Patient name *</span>
                  <Input
                    value={request.patientName}
                    onChange={(e) =>
                      setRequest({ ...request, patientName: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Mobile number *</span>
                  <Input
                    value={request.phone}
                    onChange={(e) =>
                      setRequest({
                        ...request,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                  />
                </label>
                <label>
                  <span>Blood group *</span>
                  <Select
                    value={request.bloodGroup}
                    onValueChange={(value) =>
                      setRequest({ ...request, bloodGroup: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose group" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                        (group) => (
                          <SelectItem value={group} key={group}>
                            {group}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  <span>Component *</span>
                  <Select
                    value={request.component}
                    onValueChange={(value) =>
                      setRequest({ ...request, component: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Packed Red Blood Cells", "Plasma", "Platelets"].map(
                        (item) => (
                          <SelectItem value={item} key={item}>
                            {item}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  <span>Units required *</span>
                  <Input
                    value={request.units}
                    onChange={(e) =>
                      setRequest({
                        ...request,
                        units: e.target.value.replace(/\D/g, "").slice(0, 2),
                      })
                    }
                  />
                </label>
                <label>
                  <span>Urgency *</span>
                  <Select
                    value={request.urgency}
                    onValueChange={(value) =>
                      setRequest({ ...request, urgency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Immediate - within 1 hour">
                        Immediate - within 1 hour
                      </SelectItem>
                      <SelectItem value="Urgent - today">
                        Urgent - today
                      </SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="span-two">
                  <span>Hospital and location *</span>
                  <Input
                    value={request.hospitalLocation}
                    onChange={(e) =>
                      setRequest({
                        ...request,
                        hospitalLocation: e.target.value,
                      })
                    }
                    placeholder="Hospital, ward and city"
                  />
                </label>
              </div>
              <Button
                onClick={() =>
                  submit(
                    {
                      action: "blood_request",
                      ...request,
                      units: Number(request.units),
                    },
                    () =>
                      setRequest({
                        patientName: "",
                        phone: "",
                        bloodGroup: "",
                        component: "Packed Red Blood Cells",
                        units: "1",
                        urgency: "",
                        hospitalLocation: "",
                      }),
                  )
                }
                disabled={sending}
              >
                {sending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Droplets size={16} />
                )}{" "}
                Submit blood request
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="donate">
            <div className="donor-layout">
              <div className="service-form">
                <div className="service-form-head">
                  <div className="service-icon green">
                    <UserPlus size={22} />
                  </div>
                  <div>
                    <span className="mini-label">
                      Voluntary donation portal
                    </span>
                    <h2>Schedule a donation slot</h2>
                  </div>
                </div>
                <div className="service-form-grid">
                  <label>
                    <span>Donor name *</span>
                    <Input
                      value={donor.donorName}
                      onChange={(e) =>
                        setDonor({ ...donor, donorName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Mobile number *</span>
                    <Input
                      value={donor.phone}
                      onChange={(e) =>
                        setDonor({
                          ...donor,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Blood group *</span>
                    <Select
                      value={donor.bloodGroup}
                      onValueChange={(value) =>
                        setDonor({ ...donor, bloodGroup: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose group" />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                          (group) => (
                            <SelectItem value={group} key={group}>
                              {group}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    <span>Preferred date *</span>
                    <Input
                      type="date"
                      value={donor.donationDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) =>
                        setDonor({ ...donor, donationDate: e.target.value })
                      }
                    />
                  </label>
                  <label className="span-two">
                    <span>Time slot *</span>
                    <Select
                      value={donor.timeSlot}
                      onValueChange={(value) =>
                        setDonor({ ...donor, timeSlot: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "9:00 AM – 10:00 AM",
                          "11:00 AM – 12:00 PM",
                          "2:00 PM – 3:00 PM",
                          "4:00 PM – 5:00 PM",
                        ].map((slot) => (
                          <SelectItem value={slot} key={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="ambulance-toggle span-two">
                    <Checkbox
                      checked={donor.eligibleConfirmed}
                      onCheckedChange={(value) =>
                        setDonor({
                          ...donor,
                          eligibleConfirmed: value === true,
                        })
                      }
                    />
                    <span>
                      <strong>I confirm the basic eligibility checklist</strong>
                      I am 18–65, feel well today, weigh at least 50 kg, and
                      will answer the clinical screening truthfully.
                    </span>
                  </label>
                </div>
                <Button
                  onClick={() =>
                    submit({ action: "donor", ...donor }, () =>
                      setDonor({
                        donorName: "",
                        phone: "",
                        bloodGroup: "",
                        donationDate: "",
                        timeSlot: "",
                        eligibleConfirmed: false,
                      }),
                    )
                  }
                  disabled={sending}
                >
                  {sending ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <HeartHandshake size={16} />
                  )}{" "}
                  Schedule donation
                </Button>
              </div>
              <aside className="eligibility-card">
                <ShieldCheck size={24} />
                <h3>Final eligibility is checked onsite</h3>
                <ul>
                  <li>Bring a valid photo ID.</li>
                  <li>Eat a light meal and stay hydrated.</li>
                  <li>
                    Do not donate when unwell or on restricted medication.
                  </li>
                  <li>Donation staff make the final safety decision.</li>
                </ul>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="history">
            <div className="history-list">
              <h2>Donation & blood request history</h2>
              {[...data.donations, ...data.bloodRequests].length ? (
                [...data.donations, ...data.bloodRequests].map((row) => (
                  <article key={`${row.donor_name ? "d" : "r"}-${row.id}`}>
                    <div>
                      {row.donor_name ? (
                        <HeartHandshake size={17} />
                      ) : (
                        <Droplets size={17} />
                      )}
                    </div>
                    <span>
                      <strong>
                        {String(row.donor_name ?? row.patient_name)}
                      </strong>
                      {String(row.donation_date ?? row.blood_group)} ·{" "}
                      {String(row.time_slot ?? row.component)}
                    </span>
                    <Pill tone="slate">{String(row.status)}</Pill>
                  </article>
                ))
              ) : (
                <div className="empty-module">
                  No donation or blood request records yet.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

export function Appointments({
  role,
  preferredDoctorId = "",
}: {
  role: AppRole;
  preferredDoctorId?: string;
}) {
  const doctors = useDoctorDirectory();
  const { data, loading, error, refresh } = useHospitalData(role);
  const [form, setForm] = useState({
    patientName: "",
    phone: "",
    doctorId: preferredDoctorId,
    visitMode: "In-person",
    appointmentDate: "",
    timeSlot: "",
    reason: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<
    number | null
  >(null);
  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId);
  async function book() {
    setSending(true);
    setFormError("");
    try {
      const result = await postHospital({ action: "appointment", ...form });
      setMessage(
        `Appointment #${result.id} confirmed. Join code: ${result.meetingCode}`,
      );
      setForm({
        patientName: "",
        phone: "",
        doctorId: "",
        visitMode: "In-person",
        appointmentDate: "",
        timeSlot: "",
        reason: "",
      });
      await refresh();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Booking failed.",
      );
    } finally {
      setSending(false);
    }
  }

  async function deleteVideoMeeting(appointment: HospitalRow) {
    const id = Number(appointment.id);
    if (!id) return;
    if (
      !window.confirm(
        `Delete video meeting ${String(appointment.meeting_code)}? This removes it from both patient and doctor portals.`,
      )
    )
      return;
    setDeletingAppointmentId(id);
    setFormError("");
    try {
      const response = await fetch(
        `/api/hospital?resource=appointment&id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const result = (await readJsonResponse(response)) as { error?: string };
      if (!response.ok)
        throw new Error(
          result.error || "The video meeting could not be deleted.",
        );
      setMessage("Video meeting deleted from both portals.");
      await refresh();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "The video meeting could not be deleted.",
      );
    } finally {
      setDeletingAppointmentId(null);
    }
  }
  return (
    <section className="module-page">
      <header className="module-hero appointment-hero">
        <div>
          <Pill tone="teal">
            <CalendarDays size={13} /> Connected consultations
          </Pill>
          <h1>
            {role === "patient"
              ? "Book your next consultation"
              : "Consultation schedule"}
          </h1>
          <p>
            In-person and video visits share one appointment record and join
            code.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}{" "}
          Refresh
        </Button>
      </header>
      {(error || formError) && (
        <div className="module-alert error">
          <AlertTriangle size={16} /> {error || formError}
        </div>
      )}
      {message && (
        <div className="module-alert success">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
      {role === "patient" && (
        <div className="appointment-layout">
          <div className="service-form">
            <div className="service-form-head">
              <div className="service-icon violet">
                <CalendarDays size={22} />
              </div>
              <div>
                <span className="mini-label">Patient booking system</span>
                <h2>Choose doctor, date and time</h2>
              </div>
            </div>
            <div className="service-form-grid">
              <label>
                <span>Patient name *</span>
                <Input
                  value={form.patientName}
                  onChange={(e) =>
                    setForm({ ...form, patientName: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Mobile number *</span>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                />
              </label>
              <label className="span-two">
                <span>Doctor *</span>
                <Select
                  value={form.doctorId}
                  onValueChange={(value) =>
                    setForm({ ...form, doctorId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose specialist" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem value={doctor.id} key={doctor.id}>
                        {doctor.name} · ID {doctor.id} · {doctor.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>Visit type *</span>
                <Select
                  value={form.visitMode}
                  onValueChange={(value) =>
                    setForm({ ...form, visitMode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In-person">In-person</SelectItem>
                    <SelectItem value="Video consultation">
                      Video consultation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>Date *</span>
                <Input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.appointmentDate}
                  onChange={(e) =>
                    setForm({ ...form, appointmentDate: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Time *</span>
                <Select
                  value={form.timeSlot}
                  onValueChange={(value) =>
                    setForm({ ...form, timeSlot: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose time" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "9:00 AM",
                      "10:30 AM",
                      "12:00 PM",
                      "2:00 PM",
                      "3:30 PM",
                      "5:00 PM",
                    ].map((time) => (
                      <SelectItem value={time} key={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="span-two">
                <span>Reason for consultation *</span>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Briefly describe the concern"
                />
              </label>
            </div>
            <Button onClick={book} disabled={sending}>
              {sending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <CalendarDays size={16} />
              )}{" "}
              Confirm appointment
            </Button>
          </div>
          <aside className="selected-doctor-card">
            {selectedDoctor ? (
              <>
                <div
                  className={`doctor-avatar large tone-${selectedDoctor.tone}`}
                >
                  {selectedDoctor.initials}
                </div>
                <Pill tone="slate">{selectedDoctor.department}</Pill>
                <h3>{selectedDoctor.name}</h3>
                <p>{selectedDoctor.degree}</p>
                <div>
                  <Clock3 size={14} /> {selectedDoctor.hours}
                </div>
              </>
            ) : (
              <>
                <div className="service-icon violet">
                  <Stethoscope size={24} />
                </div>
                <h3>Select a specialist</h3>
                <p>
                  The doctor’s qualifications and clinic hours will appear here.
                </p>
              </>
            )}
          </aside>
        </div>
      )}
      <div className="appointment-list">
        <div className="operations-title">
          <div>
            <span className="mini-label">Shared patient–doctor schedule</span>
            <h2>
              {role === "patient"
                ? "My appointments"
                : "All scheduled consultations"}
            </h2>
          </div>
          <Pill tone="slate">{data.appointments.length} booked</Pill>
        </div>
        <div className="video-join-guide">
          <Video size={17} />
          <span>
            <strong>Video opens in a dedicated meeting tab.</strong> Patient and
            doctor use the same appointment button from separate browser
            sessions or devices.
          </span>
        </div>
        {data.appointments.length ? (
          data.appointments.map((appointment) => (
            <article className="appointment-row" key={Number(appointment.id)}>
              <div className="appointment-date">
                <strong>
                  {String(appointment.appointment_date).slice(8, 10)}
                </strong>
                <span>
                  {new Date(
                    String(appointment.appointment_date) + "T00:00:00",
                  ).toLocaleString("en", { month: "short" })}
                </span>
              </div>
              <div className="appointment-copy">
                <Pill tone="slate">{String(appointment.visit_mode)}</Pill>
                <h3>
                  {role === "doctor"
                    ? String(appointment.patient_name)
                    : String(appointment.doctor_name)}
                </h3>
                <p>
                  {String(appointment.department)} ·{" "}
                  {String(appointment.time_slot)} · {String(appointment.reason)}
                </p>
                <small>Join code: {String(appointment.meeting_code)}</small>
              </div>
              <div className="appointment-actions">
                <Pill
                  tone={appointment.status === "completed" ? "teal" : "amber"}
                >
                  {String(appointment.status)}
                </Pill>
                {appointment.visit_mode === "Video consultation" && (
                  <>
                    <Button size="sm" asChild>
                      <a
                        href={videoMeetingUrl(String(appointment.meeting_code))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Video size={14} /> Join video
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="danger-action"
                      disabled={
                        deletingAppointmentId === Number(appointment.id)
                      }
                      onClick={() => void deleteVideoMeeting(appointment)}
                    >
                      {deletingAppointmentId === Number(appointment.id) ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}{" "}
                      Delete meeting
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-module">
            <CalendarDays size={23} />
            <span>No appointments scheduled.</span>
          </div>
        )}
      </div>
    </section>
  );
}

type DirectVoiceRow = {
  id: number;
  patient_username: string;
  patient_name: string;
  phone: string;
  department: string;
  doctor_id: string;
  doctor_name: string;
  language: string;
  urgency: string;
  symptom_category: string;
  symptom_duration: string;
  severity: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  transcript: string;
  summary: string;
  status: string;
  doctor_note: string;
  abha_number: string | null;
  abha_status: string | null;
  created_at: string;
};

type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        resultIndex?: number;
        results: ArrayLike<{
          0: { transcript: string };
          isFinal?: boolean;
        }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type VoiceLanguage = "English" | "हिन्दी" | "தமிழ்";
type CaptionNotice =
  | "unavailable"
  | "active"
  | "starting"
  | "blocked"
  | "noSpeech"
  | "network"
  | "paused"
  | "failed";

const LIVE_CAPTION_COPY: Record<
  VoiceLanguage,
  Record<CaptionNotice, string>
> = {
  English: {
    unavailable: "Live speech-to-text is not available in this browser. Audio recording still works, and you can type the caption below.",
    active: "Live captions are active. Speak naturally; the caption will continue automatically.",
    starting: "Starting English live captions… begin speaking now.",
    blocked: "Speech permission is blocked. Allow microphone and speech access, then press Restart live captions.",
    noSpeech: "Listening for speech… move closer to the microphone and continue speaking.",
    network: "The speech service paused. Your audio is safe and live captions will retry automatically.",
    paused: "Live captions paused briefly. Your audio is safe and automatic recovery is running.",
    failed: "Live captions could not start. Press Restart live captions or type the caption below.",
  },
  हिन्दी: {
    unavailable: "इस ब्राउज़र में लाइव वाणी-से-पाठ उपलब्ध नहीं है। ऑडियो रिकॉर्ड होगा और आप नीचे कैप्शन लिख सकते हैं।",
    active: "लाइव कैप्शन चालू हैं। स्वाभाविक रूप से बोलें; कैप्शन अपने-आप जारी रहेंगे।",
    starting: "हिंदी लाइव कैप्शन शुरू हो रहे हैं… अब बोलना शुरू करें।",
    blocked: "वाणी अनुमति बंद है। माइक्रोफोन और स्पीच अनुमति दें, फिर लाइव कैप्शन दोबारा शुरू करें।",
    noSpeech: "आपकी आवाज़ सुनी जा रही है… माइक्रोफोन के पास बोलते रहें।",
    network: "स्पीच सेवा कुछ देर रुकी है। ऑडियो सुरक्षित है और कैप्शन अपने-आप फिर शुरू होंगे।",
    paused: "लाइव कैप्शन थोड़ी देर रुके हैं। ऑडियो सुरक्षित है और पुनः प्रयास जारी है।",
    failed: "लाइव कैप्शन शुरू नहीं हुए। दोबारा शुरू करें या नीचे कैप्शन लिखें।",
  },
  தமிழ்: {
    unavailable: "இந்த உலாவியில் நேரலை பேச்சு-உரை வசதி இல்லை. ஒலி பதிவு தொடரும்; கீழே வசனவரியை எழுதலாம்.",
    active: "நேரலை வசனவரி இயங்குகிறது. இயல்பாகப் பேசுங்கள்; வசனவரி தானாகத் தொடரும்.",
    starting: "தமிழ் நேரலை வசனவரி தொடங்குகிறது… இப்போது பேசத் தொடங்குங்கள்.",
    blocked: "பேச்சு அனுமதி தடுக்கப்பட்டுள்ளது. மைக்ரோஃபோன் மற்றும் பேச்சு அனுமதியை வழங்கி மீண்டும் தொடங்கவும்.",
    noSpeech: "உங்கள் பேச்சைக் கேட்கிறது… மைக்ரோஃபோனுக்கு அருகில் தொடர்ந்து பேசுங்கள்.",
    network: "பேச்சுச் சேவை தற்காலிகமாக நின்றது. ஒலி பாதுகாப்பாக உள்ளது; வசனவரி தானாக மீண்டும் முயலும்.",
    paused: "நேரலை வசனவரி சிறிது நேரம் நின்றது. ஒலி பாதுகாப்பாக உள்ளது; மீட்பு நடைபெறுகிறது.",
    failed: "நேரலை வசனவரியை தொடங்க முடியவில்லை. மீண்டும் தொடங்கவும் அல்லது கீழே எழுதவும்.",
  },
};

export function VoiceCare({
  role,
  language: pageLanguage = "English",
  onContextAction,
}: {
  role: AppRole;
  language?: VoiceLanguage;
  onContextAction?: (action: string) => void;
}) {
  const doctors = useDoctorDirectory();
  const [messages, setMessages] = useState<DirectVoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState(
    "Kayachikitsa (General & Internal Medicine)",
  );
  const [doctorId, setDoctorId] = useState("kaya-01");
  const [language, setLanguage] = useState(pageLanguage);
  const recognitionLanguageRef = useRef(pageLanguage);
  const [urgency, setUrgency] = useState("Routine");
  const [symptomCategory, setSymptomCategory] = useState("");
  const [symptomDuration, setSymptomDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptNotice, setTranscriptNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [embeddedContext, setEmbeddedContext] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const recognitionRunningRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const recognitionEpochRef = useRef(0);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const recognitionWatchdogRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const recordingActiveRef = useRef(false);
  const recognitionAllowedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceDepartments = useMemo(
    () => Array.from(new Set(doctors.map((doctor) => doctor.department))).sort(),
    [doctors],
  );
  const availableDoctors = doctors.filter(
    (doctor) => doctor.department === department,
  );
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const summaryPreview = useMemo(
    () =>
      createVoiceSummary({
        patientName,
        language,
        urgency,
        symptomCategory,
        symptomDuration,
        severity,
        doctorId: selectedDoctor?.id ?? "",
        doctorName: selectedDoctor?.name ?? "",
        department,
        transcript,
      }),
    [patientName, language, urgency, symptomCategory, symptomDuration, severity, selectedDoctor, department, transcript],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setEmbeddedContext(window.self !== window.top);
      } catch {
        setEmbeddedContext(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const languageTimer = window.setTimeout(() => {
      setLanguage(pageLanguage);
      recognitionLanguageRef.current = pageLanguage;
    }, 0);
    return () => window.clearTimeout(languageTimer);
  }, [pageLanguage]);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/direct-voice", { cache: "no-store" });
      const result = (await readJsonResponse(response)) as {
        messages?: DirectVoiceRow[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Unable to load voice messages.");
      setMessages(result.messages ?? []);
      setNotes(
        Object.fromEntries(
          (result.messages ?? []).map((item) => [item.id, item.doctor_note]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load voice messages.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/direct-voice", { cache: "no-store" })
      .then(async (response) => {
        const result = (await readJsonResponse(response)) as {
          messages?: DirectVoiceRow[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error || "Unable to load voice messages.");
        if (active) {
          setMessages(result.messages ?? []);
          setNotes(
            Object.fromEntries(
              (result.messages ?? []).map((item) => [
                item.id,
                item.doctor_note,
              ]),
            ),
          );
        }
      })
      .catch((requestError: unknown) => {
        if (active)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load voice messages.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      recordingActiveRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recognitionRestartTimerRef.current)
        window.clearTimeout(recognitionRestartTimerRef.current);
      if (recognitionWatchdogRef.current)
        window.clearInterval(recognitionWatchdogRef.current);
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      recognitionEpochRef.current += 1;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Navigation can unmount an already-ended recognizer.
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function savePreview(file: File, duration = 0) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    secondsRef.current = duration;
    setSeconds(duration);
    setSentId(null);
  }

  function startLiveTranscription(
    manualRestart = true,
    selectedLanguage: string = recognitionLanguageRef.current,
  ) {
    const voiceLanguage = (
      selectedLanguage === "हिन्दी" || selectedLanguage === "தமிழ்"
        ? selectedLanguage
        : "English"
    ) as VoiceLanguage;
    const captionCopy = LIVE_CAPTION_COPY[voiceLanguage];
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => VoiceRecognition;
      webkitSpeechRecognition?: new () => VoiceRecognition;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      recognitionAllowedRef.current = false;
      recognitionStartingRef.current = false;
      setTranscriptNotice(captionCopy.unavailable);
      return;
    }
    if (manualRestart) recognitionAllowedRef.current = true;
    if (recognitionRestartTimerRef.current) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    recognitionEpochRef.current += 1;
    const epoch = recognitionEpochRef.current;
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
    } catch {
      // An already-ended recognizer is safe to replace.
    }
    const recognition = new Recognition();
    recognition.lang =
      { English: "en-IN", हिन्दी: "hi-IN", தமிழ்: "ta-IN" }[
        selectedLanguage
      ] ?? "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (epoch !== recognitionEpochRef.current) return;
      recognitionStartingRef.current = false;
      recognitionRunningRef.current = true;
      setTranscriptNotice(captionCopy.active);
    };
    recognition.onresult = (event) => {
      const finalParts: string[] = [];
      const interimParts: string[] = [];
      for (
        let index = event.resultIndex ?? 0;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const spoken = result?.[0]?.transcript?.trim();
        if (!spoken) continue;
        if (result.isFinal) finalParts.push(spoken);
        else interimParts.push(spoken);
      }
      if (finalParts.length)
        finalTranscriptRef.current = [
          finalTranscriptRef.current,
          finalParts.join(" "),
        ]
          .filter(Boolean)
          .join(" ");
      transcriptRef.current = [
        finalTranscriptRef.current,
        interimParts.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      setTranscript(transcriptRef.current);
      setTranscriptNotice(captionCopy.active);
    };
    recognition.onerror = (event) => {
      if (epoch !== recognitionEpochRef.current) return;
      recognitionStartingRef.current = false;
      recognitionRunningRef.current = false;
      const permissionBlocked =
        event.error === "not-allowed" || event.error === "service-not-allowed";
      if (permissionBlocked) recognitionAllowedRef.current = false;
      setTranscriptNotice(
        permissionBlocked
          ? captionCopy.blocked
          : event.error === "no-speech"
            ? captionCopy.noSpeech
            : event.error === "network"
              ? captionCopy.network
              : captionCopy.paused,
      );
    };
    recognition.onend = () => {
      if (epoch !== recognitionEpochRef.current) return;
      recognitionStartingRef.current = false;
      recognitionRunningRef.current = false;
      if (!recordingActiveRef.current || !recognitionAllowedRef.current) return;
      recognitionRestartTimerRef.current = window.setTimeout(() => {
        if (
          epoch !== recognitionEpochRef.current ||
          !recordingActiveRef.current ||
          !recognitionAllowedRef.current
        )
          return;
        startLiveTranscription(false, selectedLanguage);
      }, 350);
    };
    recognitionRef.current = recognition;
    try {
      recognitionStartingRef.current = true;
      recognition.start();
      setTranscriptNotice(captionCopy.starting);
    } catch {
      recognitionStartingRef.current = false;
      recognitionRef.current = null;
      setTranscriptNotice(captionCopy.failed);
    }
  }

  async function startRecording() {
    setError("");
    setSentId(null);
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      secondsRef.current = 0;
      setSeconds(0);
      const supportedType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(supportedType ? { mimeType: supportedType } : {}),
        audioBitsPerSecond: 64_000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (recognitionWatchdogRef.current)
          window.clearInterval(recognitionWatchdogRef.current);
        if (recognitionRestartTimerRef.current)
          window.clearTimeout(recognitionRestartTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        recordingActiveRef.current = false;
        recognitionStartingRef.current = false;
        recognitionRunningRef.current = false;
        try {
          recognitionRef.current?.stop();
        } catch {
          // The stop button may already have ended speech recognition.
        }
        recognitionRef.current = null;
        const mimeType = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecording(false);
        if (blob.size < 100) {
          setError("No audio recorded. Allow microphone access and try again.");
          return;
        }
        const extension = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
        savePreview(
          new File([blob], `voice-message.${extension}`, { type: mimeType }),
          secondsRef.current,
        );
      };
      recordingActiveRef.current = true;
      recorder.start(500);
      setRecording(true);
      startLiveTranscription(true, language);
      recognitionWatchdogRef.current = window.setInterval(() => {
        if (
          recordingActiveRef.current &&
          recognitionAllowedRef.current &&
          !recognitionRunningRef.current &&
          !recognitionStartingRef.current &&
          !recognitionRestartTimerRef.current
        )
          startLiveTranscription(false);
      }, 2500);
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= 120 && recorder.state === "recording")
          recorder.stop();
      }, 1000);
    } catch {
      recordingActiveRef.current = false;
      recognitionAllowedRef.current = false;
      recognitionEpochRef.current += 1;
      recognitionRunningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // The recognizer may already have stopped after permission was denied.
      }
      setError(
        "Microphone blocked. Allow microphone access in the address bar, then press Record again.",
      );
    }
  }

  function beginVoiceCapture() {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      fileRef.current?.click();
      return;
    }
    transcriptRef.current = "";
    finalTranscriptRef.current = "";
    setTranscript("");
    setTranscriptNotice("");
    setSeconds(0);
    setError("");
    recognitionAllowedRef.current = true;
    onContextAction?.("voice-recording-started");
    void startRecording();
  }

  function stopRecording() {
    recordingActiveRef.current = false;
    recognitionStartingRef.current = false;
    recognitionRunningRef.current = false;
    if (recognitionRestartTimerRef.current)
      window.clearTimeout(recognitionRestartTimerRef.current);
    if (recognitionWatchdogRef.current)
      window.clearInterval(recognitionWatchdogRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      // The browser may already have ended the speech session.
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function chooseAudio(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const inferredType =
      file.type ||
      (extension === "m4a"
        ? "audio/mp4"
        : extension === "aac"
          ? "audio/aac"
          : extension === "3gp" || extension === "3gpp"
            ? "audio/3gpp"
            : extension === "amr"
              ? "audio/amr"
              : extension === "mp3"
                ? "audio/mpeg"
                : extension === "wav"
                  ? "audio/wav"
                  : extension === "ogg"
                    ? "audio/ogg"
                    : "audio/webm");
    if (!inferredType.startsWith("audio/") || file.size > 1_500_000) {
      setError("Choose an audio recording under 1.5 MB.");
      return;
    }
    transcriptRef.current = "";
    finalTranscriptRef.current = "";
    setTranscript("");
    setTranscriptNotice(
      "Uploaded audio cannot be transcribed by the browser. Add a short transcript below so the doctor receives a useful summary.",
    );
    savePreview(new File([file], file.name, { type: inferredType }));
  }

  async function sendVoice() {
    if (
      (!audioFile && !editingId) ||
      !patientName.trim() ||
      !isValidPhoneNumber(phone) ||
      !selectedDoctor ||
      !symptomCategory ||
      !symptomDuration ||
      !severity ||
      (editingId && transcriptRef.current.trim().length < 2)
    ) {
      setError(
        "Complete the patient, referral and symptom details. For an edited message, retain or correct the transcript before saving.",
      );
      return;
    }
    setSending(true);
    setError("");
    setActionMessage("");
    try {
      const wasEditing = Boolean(editingId);
      const form = new FormData();
      form.set("patientName", patientName.trim());
      form.set("phone", phone);
      form.set("department", department);
      form.set("doctorId", selectedDoctor.id);
      form.set("doctorName", selectedDoctor.name);
      form.set("language", language);
      form.set("urgency", urgency);
      form.set("symptomCategory", symptomCategory);
      form.set("symptomDuration", symptomDuration);
      form.set("severity", severity);
      form.set("durationSeconds", String(secondsRef.current));
      form.set("transcript", transcriptRef.current);
      if (audioFile) form.set("voice", audioFile);
      if (editingId) form.set("id", String(editingId));
      const response = await fetch("/api/direct-voice", {
        method: editingId ? "PATCH" : "POST",
        body: form,
      });
      const result = (await readJsonResponse(response)) as {
        id?: number;
        error?: string;
        transcript?: string;
        transcriptionMode?: string;
        summaryMode?: string;
      };
      if (!response.ok || !result.id)
        throw new Error(result.error || "Unable to send voice message.");
      setSentId(wasEditing ? null : result.id);
      setActionMessage(
        wasEditing
          ? `Voice message #${result.id} updated successfully.`
          : `Voice message #${result.id} sent to ${selectedDoctor.name}. ${result.transcriptionMode === "openai-server" ? "Server transcription completed." : "Patient-reviewed caption saved."} ${result.summaryMode === "openai-reviewed" ? "AI physician summary prepared." : "Safety summary prepared."}`,
      );
      onContextAction?.(wasEditing ? "voice-message-updated" : "voice-message-sent-to-doctor");
      setEditingId(null);
      setAudioFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setSeconds(0);
      setTranscript("");
      setTranscriptNotice("");
      transcriptRef.current = "";
      finalTranscriptRef.current = "";
      secondsRef.current = 0;
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send voice message.",
      );
    } finally {
      setSending(false);
    }
  }

  function editMessage(message: DirectVoiceRow) {
    setEditingId(message.id);
    setPatientName(message.patient_name);
    setPhone(message.phone);
    setDepartment(message.department);
    setDoctorId(
      message.doctor_id ||
        doctors.find((doctor) => doctor.department === message.department)
          ?.id ||
        "kaya-01",
    );
    setLanguage(message.language);
    setUrgency(message.urgency);
    setSymptomCategory(message.symptom_category);
    setSymptomDuration(message.symptom_duration);
    setSeverity(message.severity);
    setTranscript(message.transcript);
    transcriptRef.current = message.transcript;
    finalTranscriptRef.current = message.transcript;
    setTranscriptNotice("Review or correct the transcript before updating this message.");
    secondsRef.current = message.duration_seconds;
    setSeconds(message.duration_seconds);
    setAudioFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setSentId(null);
    setError("");
    setActionMessage(`Editing voice message #${message.id}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteMessage(id: number) {
    if (!window.confirm("Delete this voice message permanently?")) return;
    setDeletingId(id);
    setError("");
    setActionMessage("");
    const response = await fetch(`/api/direct-voice?id=${id}`, {
      method: "DELETE",
    });
    if (!response.ok) setError("Unable to delete voice message.");
    else {
      if (editingId === id) setEditingId(null);
      await refresh();
      setActionMessage(`Voice message #${id} deleted successfully.`);
    }
    setDeletingId(null);
  }

  async function updateMessage(id: number, status: string) {
    const response = await fetch("/api/direct-voice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, doctorNote: notes[id] ?? "" }),
    });
    if (response.ok) await refresh();
    else setError("Unable to update voice message.");
  }

  function speakVoiceHelp() {
    if (!("speechSynthesis" in window)) return;
    const instructions: Record<string, { text: string; tag: string }> = {
      English: {
        text: "Enter your name and phone number. Press the large green microphone button, speak about your problem, press stop, listen once, then press send to doctor.",
        tag: "en-IN",
      },
      हिन्दी: {
        text: "अपना नाम और फोन नंबर भरें। बड़े हरे माइक्रोफोन बटन को दबाएं, अपनी समस्या बताएं, फिर स्टॉप दबाकर डॉक्टर को भेजें।",
        tag: "hi-IN",
      },
      தமிழ்: {
        text: "உங்கள் பெயர் மற்றும் தொலைபேசி எண்ணை உள்ளிடவும். பெரிய பச்சை மைக்ரோஃபோன் பொத்தானை அழுத்தி உங்கள் பிரச்சனையை சொல்லி, நிறுத்தி, மருத்துவருக்கு அனுப்பவும்.",
        tag: "ta-IN",
      },
    };
    const selected = instructions[language] ?? instructions.English;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selected.text);
    utterance.lang = selected.tag;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="module-page direct-voice-page">
      <header className="plain-page-title">
        <AudioLines size={28} />
        <h1>
          {role === "patient" ? "Voice to Doctor" : "Patient Voice Messages"}
        </h1>
        {role === "patient" && (
          <button
            type="button"
            onClick={speakVoiceHelp}
            aria-label="Hear instructions"
          >
            <Volume2 size={24} />
          </button>
        )}
      </header>

      {role === "patient" && (
        <div className="direct-voice-form">
          {embeddedContext && (
            <div className="module-alert voice-window-alert">
              <AlertTriangle size={18} />
              <span><strong>Open the portal in a full browser tab for live speech.</strong> Embedded previews can block microphone transcription.</span>
              <Button type="button" size="sm" onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}>
                Open full window <ArrowRight size={15} />
              </Button>
            </div>
          )}
          <div className="direct-voice-fields">
            <label>
              <span>Name</span>
              <Input
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              <span>Phone</span>
              <Input
                value={phone}
                onChange={(event) =>
                  setPhone(normalizePhone(event.target.value))
                }
                inputMode="tel"
                autoComplete="tel"
              />
              {phone.length > 0 && !isValidPhoneNumber(phone) && (
                <small className="field-error">
                  {phoneValidationMessage(phone)}
                </small>
              )}
            </label>
            <label>
              <span>Department</span>
              <Select
                value={department}
                onValueChange={(value) => {
                  setDepartment(value);
                  setDoctorId(
                    doctors.find((doctor) => doctor.department === value)?.id ??
                      "",
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voiceDepartments.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Refer to doctor</span>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose doctor" />
                </SelectTrigger>
                <SelectContent>
                  {availableDoctors.map((doctor, index) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} · ID {doctor.id}{" "}
                      {index === 0 ? "· Recommended" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Language</span>
              <Select
                value={language}
                onValueChange={(value) => {
                  setLanguage(value);
                  recognitionLanguageRef.current = value;
                  if (recordingActiveRef.current)
                    startLiveTranscription(true, value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="voice-language-en" value="English">English</SelectItem>
                  <SelectItem key="voice-language-hi" value="हिन्दी">हिन्दी</SelectItem>
                  <SelectItem key="voice-language-ta" value="தமிழ்">தமிழ்</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Priority</span>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Main problem</span>
              <Select
                value={symptomCategory}
                onValueChange={setSymptomCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose problem" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Fever, weakness or general illness",
                    "Digestion, appetite or bowel concern",
                    "Skin or hair concern",
                    "Joint, injury or wound concern",
                    "Women's health concern",
                    "Eye, ear, nose or throat concern",
                    "Child health, growth or feeding concern",
                    "Recovery, stiffness or rehabilitation concern",
                    "Lifestyle, prevention, diet or yoga guidance",
                    "Sleep, stress or emotional concern",
                    "Another concern",
                  ].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>How long</span>
              <Select
                value={symptomDuration}
                onValueChange={setSymptomDuration}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose duration" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Today",
                    "2–3 days",
                    "About a week",
                    "More than a month",
                  ].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Severity</span>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mild">Mild</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {editingId && (
            <div className="module-alert success">
              <Pencil size={16} /> Editing message #{editingId}. Record again
              only if you want to replace the audio.
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setActionMessage("");
                }}
              >
                Cancel
              </button>
            </div>
          )}

          <div className={`direct-recorder ${recording ? "is-recording" : ""}`}>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="audio/*"
              capture
              onChange={(event) => chooseAudio(event.target.files?.[0])}
            />
            {recording ? (
              <button
                type="button"
                className="direct-record-button stop"
                onClick={stopRecording}
              >
                <Square size={34} />
                <strong>STOP</strong>
                <span>
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </span>
              </button>
            ) : audioFile && previewUrl ? (
              <div className="direct-audio-ready">
                <CheckCircle2 size={30} />
                <audio controls src={previewUrl} />
                <button
                  type="button"
                  onClick={() => {
                    setAudioFile(null);
                    setTranscript("");
                    setTranscriptNotice("");
                    transcriptRef.current = "";
                    finalTranscriptRef.current = "";
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl("");
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="direct-record-button"
                onClick={beginVoiceCapture}
              >
                <Mic size={42} />
                <strong>RECORD</strong>
              </button>
            )}
            <button
              type="button"
              className="direct-upload-button"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={21} /> Choose audio
            </button>
          </div>

          {(recording || audioFile || editingId) && (
            <div className="direct-transcript-editor">
              <div
                className={`live-caption-display ${recording ? "is-listening" : ""}`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="live-caption-heading">
                  <span className="caption-live-dot" />
                  <strong>{recording ? "LIVE CAPTIONS" : "CAPTION REVIEW"}</strong>
                  <span>{language}</span>
                </div>
                <p data-no-translate>
                  {transcript ||
                    (language === "हिन्दी"
                      ? "बोलना शुरू करें — आपके शब्द यहाँ दिखाई देंगे…"
                      : language === "தமிழ்"
                        ? "பேசத் தொடங்குங்கள் — உங்கள் வார்த்தைகள் இங்கே தோன்றும்…"
                        : "Start speaking — your words will appear here…")}
                </p>
              </div>
              <label htmlFor="direct-voice-transcript"><AudioLines size={18} /><strong>Live transcript</strong> · review before sending</label>
              <Textarea
                id="direct-voice-transcript"
                value={transcript}
                onChange={(event) => {
                  setTranscript(event.target.value);
                  transcriptRef.current = event.target.value;
                  finalTranscriptRef.current = event.target.value;
                }}
                placeholder="Your spoken words appear here. If your browser cannot transcribe, type a short summary for the doctor."
              />
              {transcriptNotice && <small>{transcriptNotice}</small>}
              {recording && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="restart-live-speech"
                  onClick={startLiveTranscription}
                >
                  <RefreshCw size={14} /> Restart live captions
                </Button>
              )}
              <div className="voice-summary-preview" aria-live="polite">
                <div><Bot size={18} /><strong>Doctor summary preview</strong></div>
                <pre data-no-translate>{summaryPreview}</pre>
                <small>This exact structured summary is saved with the audio and delivered only to the selected doctor.</small>
              </div>
            </div>
          )}

          {error && (
            <div className="module-alert error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          {sentId && (
            <div className="module-alert success">
              <CheckCircle2 size={16} /> Sent #{sentId}
            </div>
          )}
          <Button
            size="lg"
            className="direct-send-button"
            onClick={sendVoice}
            disabled={
              (!audioFile && !editingId) ||
              sending ||
              !patientName.trim() ||
              !isValidPhoneNumber(phone) ||
              !selectedDoctor ||
              !symptomCategory ||
              !symptomDuration ||
              !severity ||
              transcript.trim().length < 2
            }
          >
            {sending ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Send size={18} />
            )}{" "}
            {editingId ? "UPDATE MESSAGE" : "SEND TO DOCTOR"}
          </Button>
        </div>
      )}

      <div className="direct-voice-list">
        <div className="direct-list-head">
          <div>
            <h2>{role === "patient" ? "Sent voice messages" : "Inbox"}</h2>
            {role === "patient" && (
              <p>Use Update or Delete below to manage a sent record.</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
          </Button>
        </div>
        {actionMessage && (
          <div className="module-alert success voice-action-feedback">
            <CheckCircle2 size={16} /> {actionMessage}
          </div>
        )}
        {!loading && !messages.length && (
          <div className="empty-module">No voice messages</div>
        )}
        {messages.map((message) => (
          <article
            className={`direct-voice-row ${message.urgency === "Urgent" ? "urgent" : ""}`}
            key={message.id}
          >
            <div className="direct-voice-person">
              <div>{message.patient_name.slice(0, 1).toUpperCase()}</div>
              <span>
                <strong>{message.patient_name}</strong>
                <small>
                  To {message.doctor_name || "Available doctor"} · ID{" "}
                  <span data-no-translate>{message.doctor_id}</span> ·{" "}
                  {message.department} · {message.language} ·{" "}
                  {new Date(message.created_at).toLocaleString()}
                </small>
              </span>
            </div>
            {message.mime_type !== "text/plain" ? (
              <audio
                controls
                preload="none"
                src={`/api/direct-voice?audio=${message.id}`}
              />
            ) : (
              <div className="direct-message-text-source">
                <AudioLines size={17} /> Voice-guided intake · confirmed transcript
              </div>
            )}
            <div className="direct-message-caption">
              <div>
                <AudioLines size={17} />
                <strong>Patient voice captions</strong>
                <span>{message.language}</span>
              </div>
              <p data-no-translate>
                {message.transcript ||
                  (message.language === "हिन्दी"
                    ? "इस रिकॉर्डिंग के लिए कैप्शन उपलब्ध नहीं है। मूल ऑडियो सुनें।"
                    : message.language === "தமிழ்"
                      ? "இந்த பதிவுக்கான வசனவரி கிடைக்கவில்லை. அசல் ஒலியை கேளுங்கள்."
                      : "Caption unavailable for this recording. Listen to the original audio.")}
              </p>
            </div>
            <Pill
              tone={
                message.status === "completed"
                  ? "teal"
                  : message.urgency === "Urgent"
                    ? "red"
                    : "amber"
              }
            >
              {message.status}
            </Pill>
            {role === "doctor" && (
              <div className="direct-voice-summary">
                <div>
                  <Bot size={17} /> <strong>Quick summary</strong>
                </div>
                <p>
                  {message.summary ||
                    "Summary unavailable for this earlier message. Listen to the original audio."}
                </p>
                <small>Verify this summary against the original audio.</small>
                <small data-no-translate>
                  ABHA: {message.abha_number || "Not linked"} · {message.abha_status || "not-linked"}
                </small>
              </div>
            )}
            <div className="direct-message-facts">
              <span>
                <strong>Problem</strong>{" "}
                {message.symptom_category || "Not entered"}
              </span>
              <span>
                <strong>Duration</strong>{" "}
                {message.symptom_duration || "Not entered"}
              </span>
              <span>
                <strong>Severity</strong> {message.severity || "Not entered"}
              </span>
            </div>
            {role === "patient" && (
              <div className="direct-patient-actions">
                <strong>Manage this voice message</strong>
                <Button variant="outline" onClick={() => editMessage(message)}>
                  <Pencil size={16} /> Update message
                </Button>
                <Button
                  variant="outline"
                  className="danger-action"
                  disabled={deletingId === message.id}
                  onClick={() => void deleteMessage(message.id)}
                >
                  {deletingId === message.id ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}{" "}
                  Delete
                </Button>
              </div>
            )}
            {role === "doctor" && (
              <div className="direct-doctor-actions">
                <Textarea
                  value={notes[message.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [message.id]: event.target.value,
                    }))
                  }
                  placeholder="Doctor note"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMessage(message.id, "heard")}
                >
                  <Check size={14} /> Heard
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMessage(message.id, "completed")}
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="danger-action"
                  disabled={deletingId === message.id}
                  onClick={() => void deleteMessage(message.id)}
                >
                  {deletingId === message.id ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Trash2 size={14} />
                  )}{" "}
                  Delete
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  sourceText?: string;
};
type TriageStage = "symptoms" | "duration" | "severity" | "age" | "action";
type AssistantLanguage = "English" | "हिन्दी" | "தமிழ்";
type TriageAnswers = { duration: string; severity: string; age: string };

const AYUR_AI_COPY: Record<AssistantLanguage, {
  greeting: string; header: string; preparing: string; symptomsQuestion: string;
  nudge: string; available: string;
  selectAll: string; continue: string; actionQuestion: string; actionHint: string;
  restart: string; placeholder: string; emergency: string; directory: string;
  intake: string; appointment: string; symptomLabels: string[];
  stages: Record<"duration" | "severity" | "age", { question: string; hint: string; options: string[] }>;
}> = {
  English: {
    greeting: "Namaste. How can I help you today?",
    header: "Patient support assistant", preparing: "Preparing a clear answer…",
    nudge: "Namaste. How can I help you today?", available: "Ready to help",
    symptomsQuestion: "What are you experiencing?", selectAll: "Select all that apply",
    continue: "Continue triage", actionQuestion: "What would you like to do next?",
    actionHint: "Choose an action based on the guidance above", restart: "Start again",
    placeholder: "Type your question…", emergency: "Emergency & beds", directory: "Find a doctor",
    intake: "Ayurvedic Intake", appointment: "Book appointment",
    symptomLabels: ["General health", "Digestion", "Skin & hair", "Joint or wound", "Women’s health", "Eye, ear, nose or throat", "Child health", "Recovery & rehabilitation", "Lifestyle & prevention", "Sleep or stress", "Urgent warning sign"],
    stages: {
      duration: { question: "When did the problem begin?", hint: "Choose the closest answer", options: ["Today", "2–3 days ago", "About a week ago", "More than a month"] },
      severity: { question: "How severe is it right now?", hint: "Choose severe if normal activity is difficult", options: ["Mild", "Moderate", "Severe"] },
      age: { question: "Which age group is the patient in?", hint: "This helps choose the safest first department", options: ["Child under 12", "Teenager", "Adult 18–59", "Older adult 60+"] },
    },
  },
  हिन्दी: {
    greeting: "नमस्ते। मैं आज आपकी कैसे मदद करूँ?",
    header: "मरीज सहायता सहायक", preparing: "स्पष्ट उत्तर तैयार हो रहा है…",
    nudge: "नमस्ते। मैं आज आपकी कैसे मदद करूँ?", available: "मदद के लिए तैयार",
    symptomsQuestion: "आपको क्या परेशानी है?", selectAll: "लागू सभी विकल्प चुनें",
    continue: "ट्रायेज जारी रखें", actionQuestion: "अब आप क्या करना चाहते हैं?",
    actionHint: "ऊपर दिए मार्गदर्शन के अनुसार विकल्प चुनें", restart: "फिर से शुरू करें",
    placeholder: "अपना प्रश्न लिखें…", emergency: "आपातकाल और बेड", directory: "डॉक्टर खोजें",
    intake: "आयुर्वेदिक जानकारी", appointment: "अपॉइंटमेंट बुक करें",
    symptomLabels: ["सामान्य स्वास्थ्य", "पाचन", "त्वचा और बाल", "जोड़ या घाव", "महिला स्वास्थ्य", "आँख, कान, नाक या गला", "बाल स्वास्थ्य", "स्वास्थ्य-लाभ एवं पुनर्वास", "जीवनशैली एवं रोकथाम", "नींद या तनाव", "आपात चेतावनी संकेत"],
    stages: {
      duration: { question: "समस्या कब शुरू हुई?", hint: "सबसे नज़दीकी उत्तर चुनें", options: ["आज", "2–3 दिन पहले", "लगभग एक सप्ताह पहले", "एक महीने से अधिक"] },
      severity: { question: "अभी समस्या कितनी गंभीर है?", hint: "सामान्य काम कठिन हो तो गंभीर चुनें", options: ["हल्की", "मध्यम", "गंभीर"] },
      age: { question: "मरीज किस आयु वर्ग में है?", hint: "इससे सही पहला विभाग चुनने में मदद मिलती है", options: ["12 वर्ष से कम बच्चा", "किशोर", "वयस्क 18–59", "वरिष्ठ 60+"] },
    },
  },
  தமிழ்: {
    greeting: "வணக்கம். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?",
    header: "நோயாளர் உதவி உதவியாளர்", preparing: "தெளிவான பதில் தயாராகிறது…",
    nudge: "வணக்கம். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?", available: "உதவத் தயார்",
    symptomsQuestion: "உங்களுக்கு என்ன பிரச்சனை?", selectAll: "பொருந்தும் அனைத்தையும் தேர்வு செய்யவும்",
    continue: "முதல் நிலை மதிப்பீட்டைத் தொடரவும்", actionQuestion: "அடுத்து என்ன செய்ய விரும்புகிறீர்கள்?",
    actionHint: "மேலுள்ள வழிகாட்டலின் அடிப்படையில் தேர்வு செய்யவும்", restart: "மீண்டும் தொடங்கவும்",
    placeholder: "உங்கள் கேள்வியை எழுதவும்…", emergency: "அவசரம் மற்றும் படுக்கைகள்", directory: "மருத்துவரை தேடுங்கள்",
    intake: "ஆயுர்வேத விவரங்கள்", appointment: "சந்திப்பைப் பதிவு செய்யவும்",
    symptomLabels: ["பொது உடல்நலம்", "செரிமானம்", "தோல் மற்றும் முடி", "மூட்டு அல்லது புண்", "பெண்கள் நலம்", "கண், காது, மூக்கு அல்லது தொண்டை", "குழந்தை நலம்", "மீட்பு மற்றும் மறுவாழ்வு", "வாழ்க்கைமுறை மற்றும் தடுப்பு", "தூக்கம் அல்லது மனஅழுத்தம்", "அவசர எச்சரிக்கை"],
    stages: {
      duration: { question: "பிரச்சனை எப்போது தொடங்கியது?", hint: "பொருத்தமான பதிலைத் தேர்வு செய்யவும்", options: ["இன்று", "2–3 நாட்களுக்கு முன்பு", "சுமார் ஒரு வாரத்திற்கு முன்பு", "ஒரு மாதத்திற்கும் மேலாக"] },
      severity: { question: "இப்போது எவ்வளவு தீவிரமாக உள்ளது?", hint: "சாதாரண செயல் கடினமாக இருந்தால் தீவிரம் என்பதைத் தேர்வு செய்யவும்", options: ["லேசானது", "மிதமானது", "தீவிரமானது"] },
      age: { question: "நோயாளியின் வயது பிரிவு என்ன?", hint: "சரியான முதல் துறையைத் தேர்வு செய்ய உதவும்", options: ["12 வயதுக்குட்பட்ட குழந்தை", "இளம்பருவம்", "வயது 18–59", "மூத்தவர் 60+"] },
    },
  },
};

function triageDepartment(symptoms: string[]) {
  if (symptoms.includes("Urgent warning sign")) return "Emergency & Beds";
  if (symptoms.includes("Skin and hair")) return "Twacha Roga & Dermatology (Skin Clinic)";
  if (symptoms.includes("Joint or wound")) return "Shalya Tantra (Surgery, Ortho & Wound Care)";
  if (symptoms.includes("Women health")) return "Prasuti Tantra & Stri Roga (Gynecology)";
  if (symptoms.includes("Eye ear nose throat")) return "Shalakya Tantra (ENT & Ophthalmology)";
  if (symptoms.includes("Child health")) return "Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics)";
  if (symptoms.includes("Recovery and rehabilitation")) return "Panchakarma & Rehabilitation";
  if (symptoms.includes("Lifestyle and prevention")) return "Swasthavritta & Yoga (Preventive Lifestyle Care)";
  if (symptoms.includes("Sleep or stress")) return "Manasa Roga (Mental Health, Sleep & Stress)";
  return "Kayachikitsa (General & Internal Medicine)";
}

function localizedTriageToken(reply: string, language: AssistantLanguage) {
  const [kind, stage, encoded = ""] = reply.split("|");
  if (kind === "TRIAGE_ACK") {
    const value = decodeURIComponent(encoded);
    const labels = {
      English: {
        symptoms: `I recorded: ${value}. Next, tell me when the problem began.`,
        duration: `Duration recorded: ${value}. How severe is the problem right now?`,
        severity: `Severity recorded: ${value}. One final question: which age group is the patient in?`,
      },
      हिन्दी: {
        symptoms: `मैंने दर्ज किया: ${value}। अब बताएं समस्या कब शुरू हुई।`,
        duration: `अवधि दर्ज की गई: ${value}। अभी समस्या कितनी गंभीर है?`,
        severity: `गंभीरता दर्ज की गई: ${value}। अंतिम प्रश्न—मरीज किस आयु वर्ग में है?`,
      },
      தமிழ்: {
        symptoms: `பதிவு செய்தேன்: ${value}. பிரச்சனை எப்போது தொடங்கியது?`,
        duration: `கால அளவு பதிவு செய்யப்பட்டது: ${value}. இப்போது பிரச்சனை எவ்வளவு தீவிரம்?`,
        severity: `தீவிரம் பதிவு செய்யப்பட்டது: ${value}. கடைசி கேள்வி—நோயாளியின் வயது பிரிவு என்ன?`,
      },
    }[language];
    return labels[stage as keyof typeof labels] ?? value;
  }
  if (kind !== "TRIAGE_RESULT") return null;
  const values = new URLSearchParams(reply.slice("TRIAGE_RESULT|".length));
  const symptoms = (values.get("symptoms") ?? "General health").split(",").filter(Boolean);
  const duration = values.get("duration") ?? "Not provided";
  const severity = values.get("severity") ?? "Not provided";
  const age = values.get("age") ?? "Not provided";
  const department = triageDepartment(symptoms);
  const urgent = department === "Emergency & Beds" || severity === "Severe";
  if (language === "हिन्दी")
    return `प्रारंभिक मार्गदर्शन\n\nआपने बताया: ${symptoms.join(", ")}\nअवधि: ${duration} · गंभीरता: ${severity} · आयु वर्ग: ${age}\n\nसुझाया गया अगला कदम: ${department}। ${urgent ? "लक्षण गंभीर हैं—तुरंत अस्पताल की आपात टीम से संपर्क करें।" : "उपलब्ध वैद्य के साथ अपॉइंटमेंट लें और क्लिनिकल इंटेक पूरा करें।"}\n\nपरामर्श के लिए तैयार रखें: लक्षणों की समयरेखा, वर्तमान दवाएँ/आयुर्वेदिक उत्पाद, एलर्जी, पुरानी बीमारियाँ और हाल की रिपोर्ट।\n\nसंदर्भ आधार: WHO स्व-देखभाल मार्गदर्शन और भारत सरकार का AYUSH Research Portal। यह निदान या प्रिस्क्रिप्शन नहीं है; वैद्य अंतिम निर्णय करेंगे।`;
  if (language === "தமிழ்")
    return `ஆரம்ப வழிகாட்டல்\n\nநீங்கள் தெரிவித்தது: ${symptoms.join(", ")}\nகால அளவு: ${duration} · தீவிரம்: ${severity} · வயது பிரிவு: ${age}\n\nபரிந்துரைக்கப்படும் அடுத்த படி: ${department}. ${urgent ? "அறிகுறிகள் தீவிரமாக உள்ளன—உடனே மருத்துவமனை அவசர அணியை தொடர்பு கொள்ளவும்." : "கிடைக்கும் வைத்தியரிடம் சந்திப்பை பதிவு செய்து மருத்துவ விவரங்களை நிரப்பவும்."}\n\nஆலோசனைக்கு தயாராக வைத்திருக்கவும்: அறிகுறி காலவரிசை, தற்போதைய மருந்துகள்/ஆயுர்வேதப் பொருட்கள், ஒவ்வாமை, பழைய நோய்கள் மற்றும் சமீப அறிக்கைகள்.\n\nஆதார அடிப்படை: WHO சுய பராமரிப்பு வழிகாட்டல் மற்றும் இந்திய அரசின் AYUSH Research Portal. இது நோயறிதல் அல்லது மருந்துச் சீட்டு அல்ல; வைத்தியர் இறுதி முடிவெடுப்பார்.`;
  return `Initial guidance\n\nYou reported: ${symptoms.join(", ")}\nDuration: ${duration} · Severity: ${severity} · Age group: ${age}\n\nRecommended next step: ${department}. ${urgent ? "The reported severity needs prompt hospital assessment; open Emergency & Beds now." : "Book the matching Vaidya and complete Ayurvedic Intake before the consultation."}\n\nPrepare for consultation: symptom timeline, current medicines and Ayurveda products, allergies, known conditions, and recent reports.\n\nReference basis: WHO self-care guidance and the Government of India AYUSH Research Portal. This is routing guidance, not a diagnosis or prescription; the Vaidya makes the final decision.`;
}

function localizedAssistantReply(reply: string, language: AssistantLanguage) {
  const triageReply = localizedTriageToken(reply, language);
  if (triageReply) return triageReply;
  if (language === "English") return reply;
  if (reply.startsWith("Namaste."))
    return language === "हिन्दी"
      ? "नमस्ते। मैं सही आयुर्वेद विभाग चुनने, वैद्य परामर्श की तैयारी, दवा-सुरक्षा की सामान्य जानकारी, अस्पताल सेवाएँ और आपात चेतावनी संकेत समझने में मदद कर सकता हूँ। आपकी मुख्य समस्या क्या है और यह कब शुरू हुई?"
      : "வணக்கம். சரியான ஆயுர்வேதத் துறையைத் தேர்வு செய்யவும், வைத்தியர் ஆலோசனைக்குத் தயாராகவும், பொதுவான மருந்துப் பாதுகாப்பு மற்றும் அவசர எச்சரிக்கைகளை அறியவும் உதவுகிறேன். உங்கள் முக்கிய பிரச்சனை என்ன, அது எப்போது தொடங்கியது?";
  const emergency = /emergency|urgent professional|poison/.test(
    reply.toLowerCase(),
  );
  if (emergency)
    return language === "हिन्दी"
      ? "यह आपातकालीन चेतावनी हो सकती है। आयुर्वेदिक ऑनलाइन मार्गदर्शन की प्रतीक्षा न करें—तुरंत स्थानीय आपातकालीन सेवा या नज़दीकी अस्पताल से संपर्क करें। अकेले वाहन न चलाएँ और किसी भरोसेमंद व्यक्ति को साथ रखें।"
      : "இது அவசர எச்சரிக்கை அறிகுறியாக இருக்கலாம். ஆயுர்வேத இணைய வழிகாட்டலுக்காக காத்திருக்க வேண்டாம்—உடனே உள்ளூர் அவசர சேவை அல்லது அருகிலுள்ள மருத்துவமனையை அணுகவும். தனியாக வாகனம் ஓட்ட வேண்டாம்.";

  const department = [
    "Kayachikitsa (General & Internal Medicine)",
    "Twacha Roga & Dermatology (Skin Clinic)",
    "Shalya Tantra (Surgery, Ortho & Wound Care)",
    "Prasuti Tantra & Stri Roga (Gynecology)",
    "Shalakya Tantra (ENT & Ophthalmology)",
    "Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics)",
    "Panchakarma & Rehabilitation",
    "Swasthavritta & Yoga (Preventive Lifestyle Care)",
    "Manasa Roga (Mental Health, Sleep & Stress)",
  ].find((item) => reply.includes(item));
  if (department) {
    const translatedDepartment = {
      "Kayachikitsa (General & Internal Medicine)": language === "हिन्दी" ? "कायचिकित्सा (सामान्य एवं आंतरिक चिकित्सा)" : "காயசிகிச்சை (பொது மற்றும் உள்மருத்துவம்)",
      "Twacha Roga & Dermatology (Skin Clinic)": language === "हिन्दी" ? "त्वचा रोग एवं डर्मेटोलॉजी" : "த்வசா ரோகா மற்றும் தோல் மருத்துவம்",
      "Shalya Tantra (Surgery, Ortho & Wound Care)": language === "हिन्दी" ? "शल्य तंत्र (शल्य, अस्थि एवं घाव सेवा)" : "சல்ய தந்திரம் (அறுவை, எலும்பு மற்றும் புண் பராமரிப்பு)",
      "Prasuti Tantra & Stri Roga (Gynecology)": language === "हिन्दी" ? "प्रसूति तंत्र एवं स्त्री रोग" : "பிரசூதி தந்திரம் மற்றும் ஸ்திரீ ரோகம்",
      "Shalakya Tantra (ENT & Ophthalmology)": language === "हिन्दी" ? "शालाक्य तंत्र (कान-नाक-गला एवं नेत्र)" : "சாலாக்கிய தந்திரம் (காது-மூக்கு-தொண்டை மற்றும் கண்)",
      "Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics)": language === "हिन्दी" ? "कौमारभृत्य / बाल रोग" : "கௌமாரபிருத்யம் / பால ரோகம்",
      "Panchakarma & Rehabilitation": language === "हिन्दी" ? "पंचकर्म एवं पुनर्वास" : "பஞ்சகர்மா மற்றும் மறுவாழ்வு",
      "Swasthavritta & Yoga (Preventive Lifestyle Care)": language === "हिन्दी" ? "स्वस्थवृत्त एवं योग" : "ஸ்வஸ்தவிருத்தம் மற்றும் யோகா",
      "Manasa Roga (Mental Health, Sleep & Stress)": language === "हिन्दी" ? "मानस रोग" : "மானச ரோகம்",
    }[department];
    return language === "हिन्दी"
      ? `सुझाया गया पहला विभाग: ${translatedDepartment}। समस्या कब शुरू हुई, भूख-पाचन, मल-मूत्र, नींद, दवाएँ, आयुर्वेदिक उत्पाद, एलर्जी और रिपोर्ट वैद्य को बताएं। नाड़ी तथा शारीरिक परीक्षण वैद्य स्वयं करेंगे। स्थिति बिगड़े तो तुरंत आपात सहायता लें।`
      : `பரிந்துரைக்கப்படும் முதல் துறை: ${translatedDepartment}. பிரச்சனை தொடங்கிய நேரம், பசி-செரிமானம், மலம்-சிறுநீர், தூக்கம், மருந்துகள், ஆயுர்வேதப் பொருட்கள், ஒவ்வாமை மற்றும் அறிக்கைகளை வைத்தியரிடம் கூறுங்கள். நாடி மற்றும் உடல் பரிசோதனையை வைத்தியர் செய்வார். நிலை மோசமானால் அவசர உதவி பெறுங்கள்.`;
  }
  if (reply.includes("Appointments"))
    return language === "हिन्दी"
      ? "अपॉइंटमेंट खोलें, विभाग और वैद्य चुनें, फिर तारीख, समय और वीडियो या प्रत्यक्ष परामर्श चुनें। उसी अपॉइंटमेंट का Join room दोनों पोर्टल में खुलता है।"
      : "சந்திப்புகளைத் திறந்து துறை மற்றும் வைத்தியரைத் தேர்ந்தெடுத்து தேதி, நேரம், காணொளி அல்லது நேரடி ஆலோசனையைத் தேர்வு செய்யவும். அதே சந்திப்பின் Join room இரு போர்டல்களிலும் திறக்கும்.";
  if (reply.includes("Blood Bank"))
    return language === "हिन्दी"
      ? "ब्लड बैंक में उपलब्धता देखें, रक्त अनुरोध करें या दान पंजीकृत करें। ऑनलाइन अनुरोध की प्रतीक्षा में आपात इलाज में देरी न करें।"
      : "இரத்த வங்கியில் கிடைப்பை பார்க்கவும், இரத்தம் கோரவும் அல்லது தானம் பதிவு செய்யவும். இணைய கோரிக்கைக்காக அவசர சிகிச்சையை தாமதிக்க வேண்டாம்.";
  if (reply.includes("Clinical Intake") || reply.includes("Ayurvedic Intake"))
    return language === "हिन्दी"
      ? "आयुर्वेदिक इंटेक में अपना इतिहास और मेडिकल रिकॉर्ड जोड़ें। AyurDoc पठनीयता और समीक्षा बिंदु तैयार करता है; अंतिम निर्णय वैद्य करते हैं।"
      : "ஆயுர்வேத விவரங்களில் உங்கள் வரலாறு மற்றும் மருத்துவப் பதிவைச் சேர்க்கவும். AyurDoc வாசிப்புத்தன்மை மற்றும் பரிசீலனை குறிப்புகளைத் தயாரிக்கும்; இறுதி முடிவை வைத்தியர் எடுப்பார்.";
  return language === "हिन्दी"
    ? "कृपया मुख्य समस्या, शुरुआत, गंभीरता, आयु, भूख-पाचन, दवाएँ और कोई आपात संकेत बताएं। AyurAI सुरक्षित पहला विभाग सुझाएगा, निदान या दवा नहीं देगा।"
    : "முக்கிய பிரச்சனை, தொடங்கிய நேரம், தீவிரம், வயது, பசி-செரிமானம், மருந்துகள் மற்றும் அவசர எச்சரிக்கையை கூறுங்கள். AyurAI பாதுகாப்பான முதல் துறையை மட்டும் பரிந்துரைக்கும்; நோயறிதல் அல்லது மருந்து வழங்காது.";
}

function assistantReply(input: string, history: ChatMessage[]) {
  const recentContext = history
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.text)
    .join(" ");
  const text = input.toLowerCase();
  const safetyContext = `${recentContext} ${input}`.toLowerCase();
  if (/^(hi|hello|hey|namaste|vanakkam|namaskar)[.! ]*$/.test(input.toLowerCase()))
    return "Namaste. I can help you choose an Ayurveda department, prepare for a Vaidya consultation, understand medicine safety, use hospital services, or recognise emergency warning signs. What is your main concern?";
  if (
    /chest pain|severe breath|cannot breathe|unconscious|face droop|heavy bleeding|blue lips|seizure|sudden weakness|suicid|self harm/.test(
      safetyContext,
    )
  )
    return "This may be an emergency warning sign. Please contact local emergency services now and open Emergency & Beds for hospital triage. Do not drive yourself if you feel faint or severely unwell.\n\nWhile help is arranged: stay with another person, keep prescribed emergency medicines nearby, and do not eat or drink if you may need an urgent procedure.";
  if (/poison|overdose|chemical|snake bite|animal bite/.test(safetyContext))
    return "This needs urgent professional assessment. Contact local emergency services or a poison/emergency centre now; do not wait for chatbot guidance. Keep the product container or a photo of it, note the amount and time, and do not induce vomiting unless a qualified professional specifically tells you to.";
  if (
    /delete|cancel|remove/.test(text) &&
    /video|meeting|appointment/.test(text)
  )
    return "Open Appointments, find the video consultation, and press Delete meeting. Confirm once; it will disappear from both the patient and doctor portals. A new consultation can be booked afterward if needed.";
  if (/book|appointment|slot|consultation/.test(text))
    return "Open Appointments, choose the doctor, visit type, date, time and reason, then confirm. For a video visit, both users press Join room on the same appointment. Tell me the symptom if you want help choosing the correct specialist first.";
  if (/blood bank|blood request|donor|donation|platelet|plasma/.test(text))
    return "Open Blood Bank to check the live prototype inventory, request blood or register a donation. For a request, prepare the patient name, blood group, component, required units, urgency and hospital location. Do not delay emergency clinical care while waiting for an online request.";
  if (/bed|icu|ccu|ambulance|emergency form/.test(text))
    return "Open Emergency & Beds to view the latest prototype availability and alert the triage team. Enter the required bed type, symptoms and phone number; add a pickup address if ambulance support is requested. Availability must be confirmed by hospital staff.";
  if (/allerg|reaction to medicine/.test(text))
    return "Breathing difficulty, face or tongue swelling, fainting or blistering needs emergency care. Otherwise note the exact prescribed or Ayurveda product, time taken and reaction, then contact the prescriber before another dose.";
  if (/child|baby|infant|feeding|growth|बाल|बच्च|குழந்தை|சிசு/.test(text))
    return "Best first department: Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics). Share the child’s age, weight, feeding, growth, temperature, hydration, medicines and immunisation record. Breathing difficulty, seizure, severe dehydration or unusual drowsiness needs urgent pediatric care.";
  if (/panchakarma|rehab|recovery|stiffness|detox|पंचकर्म|पुनर्वास|பஞ்சகர்ம|மறுவாழ்வு/.test(text))
    return "Best first department: Panchakarma & Rehabilitation. Bring the diagnosis, current medicines, recent procedure or injury details and rehabilitation goals. Panchakarma procedures must begin only after an in-person Vaidya assessment and safety screening.";
  if (/lifestyle|prevention|diet plan|yoga|wellness|दिनचर्या|योग|வாழ்க்கைமுறை|யோகா/.test(text))
    return "Best first department: Swasthavritta & Yoga (Preventive Lifestyle Care). Share daily routine, diet, sleep, activity, work pattern and health goals. New, persistent or severe symptoms should first receive a clinical assessment.";
  if (/stress|anxiety|sleep|insomnia|emotional|मानस|तनाव|नींद|மனஅழுத்த|தூக்கம்/.test(text))
    return "Best first department: Manasa Roga (Mental Health, Sleep & Stress). Share sleep pattern, stressors, mood changes, daily functioning, current medicines and support available. Thoughts of self-harm or immediate danger require urgent local emergency help.";
  if (/rash|skin|itch|acne|hair|त्वचा|खुजली|தோல்|அரிப்பு/.test(text))
    return "Best first department: Twacha Roga & Dermatology (Skin Clinic). Note onset, spread, itching or pain, fever, foods, medicines, oils and skin products. Take a clear photo; facial swelling or breathing difficulty needs emergency care.";
  if (/pregnan|period|menstrual|gynec|pelvic|महिला|गर्भ|பெண்|கர்ப்ப/.test(text))
    return "Best first department: Prasuti Tantra & Stri Roga (Gynecology). Keep the last menstrual period, pregnancy status, bleeding, pain, medicines and reports ready. Heavy bleeding, fainting or pregnancy warning signs need urgent care.";
  if (/bone|joint|fracture|injury|knee|back pain|surgery|wound|abscess|जोड़|घाव|மூட்டு|புண்/.test(text))
    return "Best first department: Shalya Tantra (Surgery, Ortho & Wound Care). Note location, cause, swelling, movement, numbness, fever and previous treatment. Major trauma, deformity or uncontrolled bleeding needs emergency care.";
  if (/eye|vision|ear|hearing|throat|sinus|nose|आँख|कान|गला|கண்|காது|தொண்டை/.test(text))
    return "Best first department: Shalakya Tantra (ENT & Ophthalmology). Note side, duration, discharge, pain, hearing or vision change. Sudden vision loss, chemical exposure, breathing or severe swallowing difficulty needs emergency care.";
  if (/stomach|abdominal|vomit|diarr|acidity|constipation|appetite|digestion|पाचन|पेट|செரிமான|வயிறு/.test(text))
    return "Best first department: Kayachikitsa (General & Internal Medicine). Record appetite, relation to meals, bowel pattern, vomiting, urine, fever and duration. Blood in vomit or stool, fainting or rapidly worsening pain needs emergency care.";
  if (/paracetamol|acetaminophen/.test(text))
    return "Paracetamol is commonly used for pain and fever. Check the label because many cold medicines also contain it, and combining products can cause overdose. Ask a doctor or pharmacist before use for a child, pregnancy, liver disease, heavy alcohol use or persistent symptoms. I cannot select a personal dose.";
  if (/amoxicillin|antibiotic/.test(text))
    return "Antibiotics treat selected bacterial infections; they do not treat most viral colds. Do not start, share, stop early or reuse an old antibiotic without a qualified prescriber. Confirm the exact name, instruction and allergy history with the prescribing doctor or pharmacist.";
  if (/metformin/.test(text))
    return "Metformin is commonly prescribed for diabetes and related conditions. Use it only as prescribed. Discuss persistent stomach symptoms, dehydration, kidney problems, severe illness, planned contrast scans or missed doses with the treating clinician. I cannot change the prescription.";
  if (/video|online|teleconsult/.test(text))
    return "For a video visit: test camera and microphone, sit in a quiet well-lit place, keep medicines and reports nearby, write the main symptom and timeline, and have a trusted helper present if needed. Open Appointments at the scheduled time and use the shared join code.";
  if (/report|document|prescription|lab result/.test(text))
    return "Upload the record in Ayurvedic Intake → Medical Records. AyurDoc checks the document type and readability and prepares review points. The Vaidya must verify the patient name, date, medicines, units, reference ranges and issuing facility before a clinical decision.";
  if (/medicine|tablet|prescription|otc/.test(text))
    return "Tell me the exact medicine name and what you want explained. I can provide general purpose and safety information, but not diagnose, prescribe, choose a dose, or replace the doctor or pharmacist.";
  if (/fever/.test(text))
    return "Best first department: Kayachikitsa (General & Internal Medicine). Share measured temperature, duration, appetite, digestion, bowel/urine pattern, associated symptoms and medicines. Breathing difficulty, confusion, seizure or severe dehydration needs urgent care.";
  const recentAssistant = history
    .filter((message) => message.role === "assistant")
    .slice(-4)
    .map((message) => message.text.toLowerCase())
    .join(" ");
  if (!/when (?:did|it)|began|start|duration/.test(recentAssistant))
    return `Thank you—I noted “${input.slice(0, 90)}”. When did this problem begin?`;
  if (!/mild|moderate|severe|severity/.test(recentAssistant))
    return "Thank you. Is the problem mild, moderate, or severe right now?";
  if (!/medicine|tablet|ayurveda product|allerg/.test(recentAssistant))
    return "I’ve recorded that. Are you taking any medicines or Ayurveda products, and do you have any known allergies?";
  return "Thank you. Is there anything new I should record—such as fever, breathing difficulty, severe pain, bleeding, fainting, or rapid worsening?";
}

function normalizedReply(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function repetitionRecovery(input: string, history: ChatMessage[], language: AssistantLanguage) {
  const patientTurns = history.filter((message) => message.role === "user").length;
  const prompts = {
    English: [
      `I’ve noted “${input.slice(0, 80)}”. When did it begin?`,
      "Thank you. Is it mild, moderate, or severe right now?",
      "Understood. Are you taking any medicines or Ayurveda products?",
      "Thank you. Do you have any allergies or urgent warning signs?",
    ],
    हिन्दी: [
      `मैंने “${input.slice(0, 80)}” दर्ज किया। यह कब शुरू हुआ?`,
      "धन्यवाद। अभी यह हल्का, मध्यम या गंभीर है?",
      "समझ गया। क्या आप कोई दवा या आयुर्वेदिक उत्पाद ले रहे हैं?",
      "धन्यवाद। क्या कोई एलर्जी या आपात चेतावनी संकेत है?",
    ],
    தமிழ்: [
      `“${input.slice(0, 80)}” என்பதை பதிவு செய்தேன். இது எப்போது தொடங்கியது?`,
      "நன்றி. இப்போது இது லேசானதா, மிதமானதா அல்லது தீவிரமானதா?",
      "புரிந்தது. ஏதேனும் மருந்து அல்லது ஆயுர்வேதப் பொருள் எடுத்துக்கொள்கிறீர்களா?",
      "நன்றி. ஒவ்வாமை அல்லது அவசர எச்சரிக்கை அறிகுறி ஏதேனும் உள்ளதா?",
    ],
  }[language];
  return prompts[patientTurns % prompts.length];
}

function AyurAIAgentAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`ayurai-agent-avatar ${compact ? "compact" : ""}`} aria-hidden="true">
      <span className="ayurai-agent-face"><UserRound size={compact ? 25 : 28} strokeWidth={1.9} /></span>
      <i><Sparkles size={compact ? 10 : 11} /></i>
      <b />
    </span>
  );
}

function speakAssistantText(text: string, language: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.86;
  utterance.pitch = 0.96;
  utterance.volume = 0.92;
  const baseLanguage = language.split("-")[0].toLowerCase();
  const voice = window.speechSynthesis.getVoices().find((item) =>
    item.lang.toLowerCase() === language.toLowerCase(),
  ) ?? window.speechSynthesis.getVoices().find((item) =>
    item.lang.toLowerCase().startsWith(baseLanguage),
  );
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function FloatingMedicalAssistant({
  onNavigate,
  language,
  onLanguageChange,
  role,
}: {
  onNavigate?: (view: PortalView) => void;
  language?: AssistantLanguage;
  onLanguageChange?: (language: AssistantLanguage) => void;
  role?: AppRole;
}) {
  const chatLanguage = language ?? "English";
  const copy = AYUR_AI_COPY[chatLanguage];
  const [open, setOpen] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: copy.greeting,
      sourceText: "__greeting__",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const assistantRecognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceReplyRef = useRef(false);
  const assistantLanguage =
    {
      English: "en-IN",
      हिन्दी: "hi-IN",
      தமிழ்: "ta-IN",
    }[chatLanguage];
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [triageAnswers, setTriageAnswers] = useState<TriageAnswers>({ duration: "", severity: "", age: "" });
  const [triageStage, setTriageStage] = useState<TriageStage>("symptoms");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const symptomKeys = [
    "General health",
    "Digestion",
    "Skin and hair",
    "Joint or wound",
    "Women health",
    "Eye ear nose throat",
    "Child health",
    "Recovery and rehabilitation",
    "Lifestyle and prevention",
    "Sleep or stress",
    "Urgent warning sign",
  ];
  const stepContent: Record<
    Exclude<TriageStage, "symptoms" | "action">,
    { question: string; hint: string; options: string[] }
  > = copy.stages;

  useEffect(() => {
    if (open)
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [messages, typing, open]);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setNudgeVisible(true), 650);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const translationTimer = window.setTimeout(() => {
      setMessages((current) =>
        current.map((message) => {
          if (message.role !== "assistant") return message;
          if (message.sourceText === "__greeting__")
            return { ...message, text: copy.greeting };
          const sourceText = message.sourceText ?? message.text;
          return {
            ...message,
            sourceText,
            text: localizedAssistantReply(sourceText, chatLanguage),
          };
        }),
      );
    }, 0);
    return () => window.clearTimeout(translationTimer);
  }, [chatLanguage, copy.greeting]);

  async function send(value = input, nextStage?: TriageStage, forcedSourceText?: string) {
    const clean = value.trim();
    if (!clean || typing) return;
    const history = messages;
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setInput("");
    setTyping(true);
    const speakResponse = voiceReplyRef.current;
    voiceReplyRef.current = false;
    let sourceText = forcedSourceText ?? "";
    let localizedText = "";
    if (!forcedSourceText) {
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: clean,
            language: chatLanguage,
            consent: true,
            history: history.slice(-8),
          }),
        });
        const data = (await readJsonResponse(response)) as {
          reply?: string;
          urgency?: string;
          suggestedDepartment?: string;
          followUpQuestion?: string;
        };
        if (!response.ok || !data.reply) throw new Error("External assistant unavailable");
        const followUp = data.followUpQuestion?.trim() ?? "";
        localizedText = [
          data.reply,
          data.suggestedDepartment ? `\n\n${chatLanguage === "हिन्दी" ? "सुझाया गया विभाग" : chatLanguage === "தமிழ்" ? "பரிந்துரைக்கப்பட்ட துறை" : "Suggested department"}: ${data.suggestedDepartment}` : "",
          followUp && !normalizedReply(data.reply).includes(normalizedReply(followUp)) ? `\n\n${followUp}` : "",
        ].join("");
        sourceText = localizedText;
      } catch {
        sourceText = assistantReply(clean, history);
        localizedText = localizedAssistantReply(sourceText, chatLanguage);
      }
    } else {
      localizedText = localizedAssistantReply(sourceText, chatLanguage);
    }
    const previousAssistant = [...history].reverse().find((message) => message.role === "assistant");
    if (previousAssistant && normalizedReply(previousAssistant.text) === normalizedReply(localizedText)) {
      localizedText = repetitionRecovery(clean, history, chatLanguage);
      sourceText = localizedText;
    }
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          sourceText,
          text: localizedText,
        },
      ]);
      setTyping(false);
      if (speakResponse) speakText(localizedText);
      if (nextStage) setTriageStage(nextStage);
    }, 80);
  }

  function speakText(text: string) {
    speakAssistantText(text, assistantLanguage);
  }

  function startVoiceChat() {
    setVoiceError("");
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => VoiceRecognition;
      webkitSpeechRecognition?: new () => VoiceRecognition;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError(chatLanguage === "हिन्दी" ? "इस ब्राउज़र में वॉइस चैट उपलब्ध नहीं है। Chrome या Edge का उपयोग करें।" : chatLanguage === "தமிழ்" ? "இந்த உலாவியில் குரல் அரட்டை இல்லை. Chrome அல்லது Edge பயன்படுத்தவும்." : "Voice chat is unavailable in this browser. Use Chrome or Edge.");
      return;
    }
    try { assistantRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    const recognition = new Recognition();
    recognition.lang = assistantLanguage;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let spoken = "";
      let isFinal = false;
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += `${event.results[index]?.[0]?.transcript ?? ""} `;
        if (event.results[index]?.isFinal) isFinal = true;
      }
      const clean = spoken.trim();
      setInput(clean);
      if (isFinal && clean && assistantRecognitionRef.current === recognition) {
        assistantRecognitionRef.current = null;
        voiceReplyRef.current = true;
        setListening(false);
        try { recognition.stop(); } catch { /* final result already ended */ }
        send(clean);
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceError(chatLanguage === "हिन्दी" ? "आवाज़ नहीं मिली। माइक्रोफोन अनुमति दें और फिर प्रयास करें।" : chatLanguage === "தமிழ்" ? "குரல் கிடைக்கவில்லை. மைக்ரோஃபோன் அனுமதியை வழங்கி மீண்டும் முயலவும்." : "Speech was not captured. Allow microphone access and try again.");
    };
    recognition.onend = () => setListening(false);
    assistantRecognitionRef.current = recognition;
    recognition.start();
  }

  function chooseTriageOption(option: string) {
    const optionIndex = stepContent[triageStage as keyof typeof stepContent]?.options.indexOf(option) ?? -1;
    const canonicalOption = optionIndex >= 0
      ? AYUR_AI_COPY.English.stages[triageStage as keyof typeof stepContent].options[optionIndex]
      : option;
    if (triageStage === "duration") {
      setTriageAnswers((current) => ({ ...current, duration: canonicalOption }));
      send(option, "severity", `TRIAGE_ACK|duration|${encodeURIComponent(option)}`);
    }
    else if (triageStage === "severity") {
      setTriageAnswers((current) => ({ ...current, severity: canonicalOption }));
      const emergencySelection =
        canonicalOption === "Severe" ||
        selectedSymptoms.some((symptom) =>
          ["Urgent warning sign"].includes(symptom),
        );
      if (emergencySelection) {
        const query = new URLSearchParams({
          symptoms: selectedSymptoms.join(","),
          duration: triageAnswers.duration,
          severity: canonicalOption,
          age: "Not provided",
        });
        send(option, "action", `TRIAGE_RESULT|${query.toString()}`);
      } else {
        send(option, "age", `TRIAGE_ACK|severity|${encodeURIComponent(option)}`);
      }
    } else if (triageStage === "age") {
      setTriageAnswers((current) => ({ ...current, age: canonicalOption }));
      const query = new URLSearchParams({
        symptoms: selectedSymptoms.join(","),
        duration: triageAnswers.duration,
        severity: triageAnswers.severity,
        age: canonicalOption,
      });
      send(option, "action", `TRIAGE_RESULT|${query.toString()}`);
    }
  }

  function openTriageDestination(view: PortalView, label: string) {
    send(label);
    if (onNavigate) {
      onNavigate(view);
      setOpen(false);
    }
  }

  function resetTriage() {
    setSelectedSymptoms([]);
    setTriageAnswers({ duration: "", severity: "", age: "" });
    setTriageStage("symptoms");
    setMessages([
      {
        role: "assistant",
        text: copy.greeting,
        sourceText: "__greeting__",
      },
    ]);
  }

  function speakLatest() {
    const latest = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!latest || !("speechSynthesis" in window)) return;
    speakText(latest.text);
  }

  const emergencyShown = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "assistant" &&
          message.text.includes("Emergency & Beds"),
      ),
    [messages],
  );

  return (
    <div className={`floating-assistant ${role === "patient" ? "patient-assistant" : ""} ${open ? "is-open" : ""}`}>
      {open && (
        <section
          className="floating-chat-panel"
          role="dialog"
          aria-label="AyurAI medical assistant"
        >
          <header className="floating-chat-head">
            <div className="floating-bot-avatar">
              <AyurAIAgentAvatar compact />
            </div>
            <div>
              <strong>AyurAI <small>{copy.available}</small></strong>
              <span>{copy.header}</span>
            </div>
            <select
              value={chatLanguage}
              onChange={(event) => onLanguageChange?.(event.target.value as AssistantLanguage)}
              aria-label="AyurAI language"
              title="AyurAI language"
            >
              <option value="English">EN</option>
              <option value="हिन्दी">HI</option>
              <option value="தமிழ்">TA</option>
            </select>
            <button
              type="button"
              onClick={speakLatest}
              aria-label="Read answer aloud"
            >
              <Volume2 size={17} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </header>

          <div className="floating-chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`floating-message ${message.role}`}>
                <div>
                  {message.role === "assistant" ? (
                    <Bot size={15} />
                  ) : (
                    <Users size={15} />
                  )}
                </div>
                <p>{message.text}</p>
              </div>
            ))}
            {typing && (
              <div className="floating-message assistant typing-message">
                <div>
                  <Bot size={15} />
                </div>
                <p>
                  <LoaderCircle className="spin" size={16} /> {copy.preparing}
                </p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {emergencyShown && onNavigate && (
            <Button
              className="floating-chat-emergency"
              variant="destructive"
              onClick={() => {
                onNavigate("emergency");
                setOpen(false);
              }}
            >
              <Ambulance size={15} /> Open Emergency & Beds
            </Button>
          )}

          <div className="med-ai-triage">
            {triageStage === "symptoms" ? (
              <>
                <strong>{copy.symptomsQuestion}</strong>
                <span>{copy.selectAll}</span>
                <div>
                  {symptomKeys.map((symptom, symptomIndex) => {
                    const selected = selectedSymptoms.includes(symptom);
                    return (
                      <button
                        key={symptom}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        className={selected ? "selected" : ""}
                        onClick={() =>
                          setSelectedSymptoms((current) =>
                            current.includes(symptom)
                              ? current.filter((item) => item !== symptom)
                              : [...current, symptom],
                          )
                        }
                      >
                        <span>{selected && <Check size={12} />}</span>
                        {copy.symptomLabels[symptomIndex]}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedSymptoms.length || typing}
                  onClick={() =>
                    send(
                      selectedSymptoms.map((symptom) => copy.symptomLabels[symptomKeys.indexOf(symptom)]).join(", "),
                      "duration",
                      `TRIAGE_ACK|symptoms|${encodeURIComponent(selectedSymptoms.map((symptom) => copy.symptomLabels[symptomKeys.indexOf(symptom)]).join(", "))}`,
                    )
                  }
                >
                  {copy.continue} <ArrowRight size={14} />
                </Button>
              </>
            ) : triageStage === "action" ? (
              <>
                <strong>{copy.actionQuestion}</strong>
                <span>{copy.actionHint}</span>
                <div>
                  {selectedSymptoms.some((symptom) =>
                    ["Urgent warning sign"].includes(symptom),
                  ) && (
                    <button
                      type="button"
                      className="urgent-option"
                      onClick={() =>
                        openTriageDestination(
                          "emergency",
                          copy.emergency,
                        )
                      }
                    >
                      <span><Ambulance size={12} /></span> {copy.emergency}
                    </button>
                  )}
                  {role !== "doctor" && (
                    <button
                      type="button"
                      onClick={() => openTriageDestination("directory", copy.directory)}
                    >
                      <span><Stethoscope size={12} /></span> {copy.directory}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                        openTriageDestination(
                          "intake",
                          copy.intake,
                      )
                    }
                  >
                    <span><Activity size={12} /></span> {copy.intake}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                        openTriageDestination(
                          "appointments",
                          copy.appointment,
                      )
                    }
                  >
                    <span><CalendarDays size={12} /></span> {copy.appointment}
                  </button>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={resetTriage}>
                  {copy.restart}
                </Button>
                <div className="ayurai-reference-links">
                  <span>Reference sources</span>
                  <a href="https://www.who.int/health-topics/self-care" target="_blank" rel="noreferrer">WHO self-care</a>
                  <a href="https://arp.ayush.gov.in/" target="_blank" rel="noreferrer">AYUSH Research Portal</a>
                </div>
              </>
            ) : (
              <>
                <strong>{stepContent[triageStage].question}</strong>
                <span>{stepContent[triageStage].hint}</span>
                <div>
                  {stepContent[triageStage].options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={typing}
                      onClick={() => chooseTriageOption(option)}
                    >
                      <span><ArrowRight size={12} /></span>
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <form
            className="floating-chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.placeholder}
              aria-label="Message AyurAI"
            />
            <Button
              type="button"
              size="icon"
              variant={listening ? "default" : "outline"}
              className={listening ? "ayurai-listening" : ""}
              onClick={startVoiceChat}
              disabled={typing || listening}
              aria-label={listening ? "Listening" : "Speak to AyurAI"}
              title="Speak in the selected language"
            >
              {listening ? <AudioLines size={17} /> : <Mic size={17} />}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={typing || !input.trim()}
              aria-label="Send message"
            >
              <Send size={17} />
            </Button>
          </form>
          {listening && <div className="floating-voice-status" aria-live="polite">{chatLanguage === "हिन्दी" ? "सुन रहा हूँ…" : chatLanguage === "தமிழ்" ? "கேட்கிறது…" : "Listening…"}</div>}
          {voiceError && <div className="floating-chat-error" role="alert">{voiceError}</div>}
          <div className="floating-chat-limit">
            General guidance only. A Vaidya or doctor must confirm medical decisions.
          </div>
        </section>
      )}

      {!open && nudgeVisible && (
        <aside className="ayurai-welcome-nudge" aria-live="polite">
          <button type="button" className="ayurai-nudge-main" onClick={() => { setOpen(true); setNudgeVisible(false); }} aria-label={`Open AyurAI assistant. ${copy.nudge}`}>
            <AyurAIAgentAvatar compact />
            <span><strong>AyurAI</strong><small>{copy.nudge}</small></span>
          </button>
        </aside>
      )}
    </div>
  );
}
