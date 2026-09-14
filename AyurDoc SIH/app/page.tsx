"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AudioLines,
  BadgeCheck,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  FileSearch,
  IdCard,
  Languages,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Mic,
  MonitorCheck,
  Phone,
  Play,
  Pencil,
  RefreshCw,
  RotateCcw,
  ScanFace,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Appointments,
  BloodBank,
  DoctorDirectory,
  EmergencyBeds,
  FloatingMedicalAssistant,
  PortalNavigation,
  PortalOverview,
  useDoctorDirectory,
  VoiceCare,
  type PortalView,
} from "./hospital-modules";
import { PatientRegistration } from "./patient-registration";
import { DoctorRegistration } from "./doctor-registration";
import { AbhaProfile } from "./abha-profile";
import { useInterfaceTranslation } from "./use-interface-translation";
import { AyurDocLogo } from "@/components/ayurdoc-logo";
import { BiometricEnrollment } from "./biometric-enrollment";
import { MedicationSafetyPanel } from "./medication-safety-panel";
import {
  isValidPhoneNumber,
  normalizePhone,
  phoneValidationMessage,
} from "@/lib/validation";
import { doctorForUsername } from "@/lib/doctor-directory";
import {
  analyzeClinicalText,
  type ClinicalFinding,
} from "@/lib/document-intelligence";
import {
  createDocumentEvidence,
  parseDocumentEvidence,
  serializeDocumentFeedback,
  type DocumentEvidence,
} from "@/lib/document-evidence";
import { ContextAwareVoiceGuide } from "./context-aware-voice-guide";
import { useSessionContextManager } from "./session-context-manager";
import { DoctorCaseContext, MedicalTimeline, RelevantPreviousHistory } from "./medical-history-panels";

type AppRole = "patient" | "doctor";
type Phase = "identify" | "history" | "documents" | "summary" | "submitted";
type Language = "English" | "हिन्दी" | "தமிழ்";
type DocumentState = "empty" | "preview" | "scanning" | "ready";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

type DocumentAnalysis = {
  type: string;
  summary: string;
  feedback: string[];
  findings: ClinicalFinding[];
  confidence: "low" | "moderate" | "high";
  evidence: DocumentEvidence;
};

type DocumentUpload = {
  dataUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type IdentityRecord = {
  id?: number;
  id_type: string;
  file_name: string;
  review_status: string;
  uploaded_at?: string;
};

type AuthUser = { username: string; role: AppRole };
type PortalProfile = {
  username: string;
  role: AppRole;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  age?: string;
  sex?: string;
  abhaNumber?: string;
  abhaAddress?: string;
  abhaStatus?: string;
  governmentIdStatus?: string;
  doctorId?: string;
  department?: string;
  qualification?: string;
  councilRegistration?: string;
  credentialStatus?: string;
};
type Profile = {
  fullName: string;
  age: string;
  sex: string;
  address: string;
  phone: string;
  abhaNumber: string;
  abhaAddress: string;
  department: string;
  doctorId: string;
  doctorName: string;
};

type IntakeRecord = {
  id: number;
  patient_username: string;
  full_name: string;
  age: number;
  sex: string;
  address: string;
  phone: string;
  department: string;
  doctor_id: string;
  doctor_name: string;
  language: string;
  complaint: string;
  onset: string;
  symptoms: string;
  conditions: string;
  allergies: string;
  narrative: string;
  document_name: string;
  document_type: string;
  document_feedback: string;
  document_notes: string;
  document_file_id: number | null;
  document_content_type: string | null;
  document_size_bytes: number | null;
  voice_message_id: number | null;
  voice_transcript: string | null;
  voice_duration_seconds: number | null;
  voice_status: string | null;
  identity_type: string | null;
  identity_status: string | null;
  abha_number: string | null;
  abha_address: string | null;
  abha_status: string | null;
  abha_consented_at: string | null;
  red_flag: number | boolean;
  status: string;
  doctor_note: string;
  created_at: string;
  verified_at: string | null;
};

type ClinicalWorkflow = {
  intakeId: number;
  schemaVersion: string;
  structuredRecord: Record<string, unknown>;
  physicianSummary: string;
  fhirBundle: Record<string, unknown>;
  completenessScore: number;
  redFlags: Array<{ code: string; label: string; source: string }>;
  decision: string;
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string | null;
};

type WorkflowEvidence = {
  workflow: ClinicalWorkflow;
  audit: Array<{ id: number; actor_username: string; actor_role: string; action: string; created_at: string }>;
  consents: Array<{ id: number; purpose: string; status: string; policy_version: string; granted_at: string; scope: string[] }>;
  clarifications: Array<{
    id: number;
    question: string;
    answer: string;
    language: string;
    status: string;
    doctor_username: string;
    requested_at: string;
    answered_at: string | null;
  }>;
};

type Choice = { value: string; tamil: string; hindi?: string };
type Question = {
  id: string;
  eyebrow: string;
  prompt: Record<Language, string>;
  hint: string;
  choices: Choice[];
  multiple?: boolean;
  showWhenComplaintIncludes?: string[];
};

const questions: Question[] = [
  {
    id: "complaint",
    eyebrow: "Pradhana Vedana · Main concern",
    prompt: {
      English: "What brings you to the Vaidya today?",
      हिन्दी: "आज आप वैद्य से किस मुख्य समस्या के लिए मिलना चाहते हैं?",
      தமிழ்: "இன்று எந்த முக்கிய பிரச்சனைக்காக வைத்தியரை சந்திக்கிறீர்கள்?",
    },
    hint: "Choose the closest concern. You can add your own details below.",
    choices: [
      { value: "Fever, weakness or general illness", tamil: "காய்ச்சல், பலவீனம் அல்லது பொதுவான உடல்நலக் குறைவு" },
      { value: "Digestion or abdominal concern", tamil: "செரிமானம் அல்லது வயிற்றுப் பிரச்சனை" },
      { value: "Chest pain, palpitation or breathing concern", tamil: "மார்பு வலி, இதயத் துடிப்பு அல்லது மூச்சுப் பிரச்சனை", hindi: "सीने में दर्द, धड़कन या सांस की समस्या" },
      { value: "Skin or hair concern", tamil: "தோல் அல்லது முடி பிரச்சனை" },
      { value: "Joint, injury or wound concern", tamil: "மூட்டு, காயம் அல்லது புண் பிரச்சனை" },
      { value: "Women's health concern", tamil: "பெண்கள் நலப் பிரச்சனை" },
      { value: "Eye, ear, nose or throat concern", tamil: "கண், காது, மூக்கு அல்லது தொண்டை பிரச்சனை" },
      { value: "Child health, growth or feeding concern", tamil: "குழந்தை நலம், வளர்ச்சி அல்லது உணவூட்டல் பிரச்சனை" },
      { value: "Recovery, stiffness or rehabilitation concern", tamil: "மீட்பு, விறைப்பு அல்லது மறுவாழ்வு பிரச்சனை" },
      { value: "Lifestyle, prevention, diet or yoga guidance", tamil: "வாழ்க்கைமுறை, தடுப்பு, உணவு அல்லது யோகா வழிகாட்டல்" },
      { value: "Sleep, stress or emotional concern", tamil: "தூக்கம், மனஅழுத்தம் அல்லது உணர்ச்சி சார்ந்த பிரச்சனை" },
      { value: "Another concern", tamil: "வேறு பிரச்சனை" },
    ],
  },
  {
    id: "onset",
    eyebrow: "Kala · Course of illness",
    prompt: {
      English: "When did it begin, and how has it changed?",
      हिन्दी: "यह कब शुरू हुआ और तब से इसमें क्या बदलाव आया?",
      தமிழ்: "இது எப்போது தொடங்கியது, அதன் பிறகு எவ்வாறு மாறியுள்ளது?",
    },
    hint: "An approximate duration is fine; add triggers or earlier episodes below.",
    choices: [
      { value: "Today", tamil: "இன்று" },
      { value: "2–3 days ago", tamil: "2–3 நாட்களுக்கு முன்பு" },
      { value: "Within the last week", tamil: "கடந்த ஒரு வாரத்திற்குள்" },
      { value: "1–4 weeks ago", tamil: "1–4 வாரங்களுக்கு முன்பு" },
      { value: "More than one month", tamil: "ஒரு மாதத்திற்கும் மேலாக" },
    ],
  },
  {
    id: "agni",
    eyebrow: "Agni · Appetite & digestion",
    prompt: {
      English: "How are your appetite and digestion most days?",
      हिन्दी: "अधिकांश दिनों में आपकी भूख और पाचन कैसा रहता है?",
      தமிழ்: "பெரும்பாலான நாட்களில் உங்கள் பசியும் செரிமானமும் எப்படி உள்ளது?",
    },
    hint: "This helps the Vaidya understand Agni. It does not determine a diagnosis by itself.",
    choices: [
      { value: "Steady appetite and comfortable digestion", tamil: "சீரான பசி மற்றும் சுகமான செரிமானம்" },
      { value: "Low appetite or heaviness after food", tamil: "குறைந்த பசி அல்லது உணவுக்குப் பிறகு கனத்த உணர்வு" },
      { value: "Appetite changes from day to day", tamil: "நாளுக்கு நாள் மாறும் பசி" },
      { value: "Very strong or frequent hunger", tamil: "மிகவும் அதிகமான அல்லது அடிக்கடி பசி" },
      { value: "Burning, acidity or sour belching", tamil: "எரிச்சல், அமிலத்தன்மை அல்லது புளிப்பு ஏப்பம்" },
    ],
  },
  {
    id: "chest_pathway",
    eyebrow: "Hrid–Pranavaha · Focused safety pathway",
    prompt: {
      English: "Which description best matches the chest or breathing problem?",
      हिन्दी: "सीने या सांस की समस्या का कौन सा विवरण सबसे सही है?",
      தமிழ்: "மார்பு அல்லது மூச்சுப் பிரச்சனையை எந்த விளக்கம் சரியாகக் கூறுகிறது?",
    },
    hint: "This answer changes the triage priority and the next clinical review.",
    showWhenComplaintIncludes: ["Chest pain"],
    choices: [
      { value: "Pressure or heaviness in the chest", hindi: "सीने में दबाव या भारीपन", tamil: "மார்பில் அழுத்தம் அல்லது கனத்த உணர்வு" },
      { value: "Sharp pain related to breathing or movement", hindi: "सांस या हरकत से जुड़ा तेज दर्द", tamil: "மூச்சு அல்லது அசைவுடன் தொடர்புடைய கூர்மையான வலி" },
      { value: "Fast or irregular heartbeat", hindi: "तेज़ या अनियमित धड़कन", tamil: "வேகமான அல்லது ஒழுங்கற்ற இதயத் துடிப்பு" },
      { value: "Breathlessness at rest", hindi: "आराम में भी सांस फूलना", tamil: "ஓய்விலும் மூச்சுத்திணறல்" },
      { value: "Mild discomfort without breathlessness", hindi: "सांस की तकलीफ के बिना हल्की असुविधा", tamil: "மூச்சுத்திணறல் இல்லாத லேசான அசௌகரியம்" },
    ],
  },
  {
    id: "digestive_pathway",
    eyebrow: "Udara–Annavaha · Focused digestive pathway",
    prompt: {
      English: "Where is the digestive problem and what is it like?",
      हिन्दी: "पाचन की समस्या कहाँ है और कैसी महसूस होती है?",
      தமிழ்: "செரிமானப் பிரச்சனை எங்கு உள்ளது, அது எப்படி உணரப்படுகிறது?",
    },
    hint: "Choose every matching feature; the Vaidya can verify the pattern.",
    multiple: true,
    showWhenComplaintIncludes: ["Digestion or abdominal"],
    choices: [
      { value: "Upper abdominal burning or acidity", hindi: "ऊपरी पेट में जलन या अम्लता", tamil: "மேல் வயிற்றில் எரிச்சல் அல்லது அமிலத்தன்மை" },
      { value: "Lower abdominal pain or cramps", hindi: "निचले पेट में दर्द या ऐंठन", tamil: "கீழ் வயிற்று வலி அல்லது பிடிப்பு" },
      { value: "Vomiting or inability to keep fluids down", hindi: "उल्टी या तरल न रुकना", tamil: "வாந்தி அல்லது திரவம் தங்காமை" },
      { value: "Bloating, gas or heaviness", hindi: "पेट फूलना, गैस या भारीपन", tamil: "வயிறு உப்புசம், வாயு அல்லது கனத்த உணர்வு" },
      { value: "Change in stool or blood in stool", hindi: "मल में बदलाव या रक्त", tamil: "மலத்தில் மாற்றம் அல்லது இரத்தம்" },
    ],
  },
  {
    id: "skin_pathway",
    eyebrow: "Twacha · Focused skin pathway",
    prompt: {
      English: "What changes have you noticed on the skin or hair?",
      हिन्दी: "त्वचा या बालों में आपने कौन से बदलाव देखे हैं?",
      தமிழ்: "தோல் அல்லது முடியில் என்ன மாற்றங்களை கவனித்துள்ளீர்கள்?",
    },
    hint: "Select all that apply and describe the body location in the note box.",
    multiple: true,
    showWhenComplaintIncludes: ["Skin or hair"],
    choices: [
      { value: "Itching, dryness or scaling", hindi: "खुजली, सूखापन या पपड़ी", tamil: "அரிப்பு, வறட்சி அல்லது செதில்" },
      { value: "Redness, warmth or swelling", hindi: "लालिमा, गर्मी या सूजन", tamil: "சிவப்பு, சூடு அல்லது வீக்கம்" },
      { value: "Discharge, open wound or spreading lesion", hindi: "स्राव, खुला घाव या फैलता घाव", tamil: "சீழ், திறந்த புண் அல்லது பரவும் பாதிப்பு" },
      { value: "Pigmentation or colour change", hindi: "रंगत या रंग में बदलाव", tamil: "நிறமாற்றம்" },
      { value: "Hair fall or scalp concern", hindi: "बाल झड़ना या सिर की त्वचा की समस्या", tamil: "முடி உதிர்வு அல்லது தலைமுடித் தோல் பிரச்சனை" },
    ],
  },
  {
    id: "womens_pathway",
    eyebrow: "Stri Roga · Focused history",
    prompt: {
      English: "Which women’s-health detail is most relevant today?",
      हिन्दी: "आज महिला स्वास्थ्य से जुड़ी कौन सी बात सबसे अधिक संबंधित है?",
      தமிழ்: "இன்றைய பெண்கள் நலப் பிரச்சனைக்கு எந்த விவரம் மிகவும் தொடர்புடையது?",
    },
    hint: "You may choose rather not to disclose in the note and speak privately with the clinician.",
    showWhenComplaintIncludes: ["Women's health"],
    choices: [
      { value: "Painful or irregular periods", hindi: "दर्दनाक या अनियमित मासिक धर्म", tamil: "வலியுள்ள அல்லது ஒழுங்கற்ற மாதவிடாய்" },
      { value: "Heavy bleeding or unusual discharge", hindi: "अधिक रक्तस्राव या असामान्य स्राव", tamil: "அதிக இரத்தப்போக்கு அல்லது அசாதாரண சுரப்பு" },
      { value: "Pregnancy-related concern", hindi: "गर्भावस्था संबंधी चिंता", tamil: "கர்ப்பம் தொடர்பான பிரச்சனை" },
      { value: "Menopause or hormonal concern", hindi: "रजोनिवृत्ति या हार्मोन संबंधी चिंता", tamil: "மெனோபாஸ் அல்லது ஹார்மோன் பிரச்சனை" },
      { value: "Prefer to discuss privately", hindi: "निजी रूप से चर्चा करना चाहती/चाहता हूँ", tamil: "தனிப்பட்ட முறையில் பேச விரும்புகிறேன்" },
    ],
  },
  {
    id: "koshtha",
    eyebrow: "Koshtha · Bowel pattern",
    prompt: {
      English: "Which bowel pattern is closest to your usual experience?",
      हिन्दी: "आपकी सामान्य मल त्याग की आदत किस विकल्प से सबसे अधिक मिलती है?",
      தமிழ்: "உங்கள் வழக்கமான மலச்சிக்கல் நடைமுறைக்கு மிக அருகிலுள்ள தேர்வு எது?",
    },
    hint: "Tell the Vaidya if this has changed recently.",
    choices: [
      { value: "Regular and comfortable", tamil: "சீராகவும் சுகமாகவும் உள்ளது" },
      { value: "Constipation or hard stool", tamil: "மலச்சிக்கல் அல்லது கடினமான மலம்" },
      { value: "Loose or frequent stool", tamil: "தளர்ந்த அல்லது அடிக்கடி மலம்" },
      { value: "Alternates between constipation and loose stool", tamil: "மலச்சிக்கலும் தளர்ந்த மலமும் மாறிமாறி வருகிறது" },
      { value: "Gas, bloating or incomplete evacuation", tamil: "வாயு, வயிறு உப்புசம் அல்லது முழுமையற்ற வெளியேற்றம்" },
    ],
  },
  {
    id: "ahara",
    eyebrow: "Ahara · Food pattern",
    prompt: {
      English: "Which statements describe your usual food routine?",
      हिन्दी: "कौन से विकल्प आपकी सामान्य भोजन दिनचर्या बताते हैं?",
      தமிழ்: "உங்கள் வழக்கமான உணவுப் பழக்கத்தை எந்த தேர்வுகள் விவரிக்கின்றன?",
    },
    hint: "Select all that apply. This is a pattern review, not a judgement.",
    choices: [
      { value: "Mostly fresh home-cooked meals", tamil: "பெரும்பாலும் வீட்டில் புதிதாக சமைத்த உணவு" },
      { value: "Irregular meal times or skipped meals", tamil: "ஒழுங்கற்ற உணவு நேரம் அல்லது உணவைத் தவிர்த்தல்" },
      { value: "Frequent spicy, oily or fried food", tamil: "அடிக்கடி காரமான, எண்ணெய் அல்லது பொரித்த உணவு" },
      { value: "Frequent packaged or sugary food", tamil: "அடிக்கடி பொட்டல அல்லது இனிப்பு உணவு" },
      { value: "Special or medically restricted diet", tamil: "சிறப்பு அல்லது மருத்துவக் கட்டுப்பாட்டுள்ள உணவு" },
    ],
    multiple: true,
  },
  {
    id: "nidra",
    eyebrow: "Nidra · Sleep & daily energy",
    prompt: {
      English: "How are your sleep and energy recently?",
      हिन्दी: "हाल में आपकी नींद और ऊर्जा कैसी रही है?",
      தமிழ்: "சமீபத்தில் உங்கள் தூக்கமும் ஆற்றலும் எப்படி உள்ளது?",
    },
    hint: "Choose the closest pattern and add your sleep timing below if useful.",
    choices: [
      { value: "Restful sleep and steady energy", tamil: "நிம்மதியான தூக்கம் மற்றும் சீரான ஆற்றல்" },
      { value: "Difficulty falling asleep", tamil: "தூங்கத் தொடங்குவதில் சிரமம்" },
      { value: "Waking repeatedly or too early", tamil: "மீண்டும் மீண்டும் அல்லது மிக விரைவாக விழித்தல்" },
      { value: "Excess sleep or persistent fatigue", tamil: "அதிக தூக்கம் அல்லது தொடர்ந்து சோர்வு" },
      { value: "Low energy during the day", tamil: "பகலில் குறைந்த ஆற்றல்" },
    ],
  },
  {
    id: "mala_mutra",
    eyebrow: "Mala–Mutra · Elimination",
    prompt: {
      English: "Have you noticed any recent change in bowel movement or urination?",
      हिन्दी: "क्या हाल में मल त्याग या पेशाब में कोई बदलाव आया है?",
      தமிழ்: "சமீபத்தில் மலம் அல்லது சிறுநீர் கழிப்பதில் மாற்றம் உள்ளதா?",
    },
    hint: "Select all that apply. Pain, blood, or very low urine needs prompt review.",
    choices: [
      { value: "No recent change", tamil: "சமீபத்திய மாற்றம் இல்லை" },
      { value: "Recent bowel change", tamil: "சமீபத்திய மல மாற்றம்" },
      { value: "Burning or frequent urination", tamil: "எரிச்சல் அல்லது அடிக்கடி சிறுநீர் கழித்தல்" },
      { value: "Reduced urination", tamil: "குறைந்த சிறுநீர்" },
      { value: "Blood or unusual colour", tamil: "இரத்தம் அல்லது அசாதாரண நிறம்" },
    ],
    multiple: true,
  },
  {
    id: "deha",
    eyebrow: "Deha tendency · Felt pattern",
    prompt: {
      English: "Which body tendency have you noticed most recently?",
      हिन्दी: "हाल में आपने शरीर की कौन सी प्रवृत्ति सबसे अधिक महसूस की है?",
      தமிழ்: "சமீபத்தில் எந்த உடல் தன்மையை அதிகமாக உணர்ந்துள்ளீர்கள்?",
    },
    hint: "This is only your observation. The Vaidya will assess Prakriti and Vikriti clinically.",
    choices: [
      { value: "Coldness, dryness or stiffness", tamil: "குளிர்ச்சி, வறட்சி அல்லது இறுக்கம்" },
      { value: "Heat, sweating, thirst or burning", tamil: "சூடு, வியர்வை, தாகம் அல்லது எரிச்சல்" },
      { value: "Heaviness, sluggishness or congestion", tamil: "கனத்த தன்மை, மந்தம் அல்லது அடைப்பு" },
      { value: "Variable, restless or sensitive", tamil: "மாறுபடும், அமைதியற்ற அல்லது உணர்திறன்" },
      { value: "No clear pattern", tamil: "தெளிவான தன்மை இல்லை" },
    ],
  },
  {
    id: "satmya",
    eyebrow: "Satmya · Adaptation & tolerance",
    prompt: {
      English: "Which foods or environments usually suit or disturb you?",
      हिन्दी: "कौन से भोजन या वातावरण आपको सामान्यतः अनुकूल या प्रतिकूल लगते हैं?",
      தமிழ்: "எந்த உணவு அல்லது சூழல் பொதுவாக உங்களுக்கு ஏற்றதாக அல்லது தொந்தரவாக உள்ளது?",
    },
    hint: "Choose all that apply. The Vaidya will clinically interpret Satmya.",
    multiple: true,
    choices: [
      { value: "Tolerates most foods well", hindi: "अधिकांश भोजन आसानी से सहन होते हैं", tamil: "பெரும்பாலான உணவுகள் நன்றாக ஏற்றுக்கொள்ளப்படுகின்றன" },
      { value: "Sensitive to spicy or oily food", hindi: "मसालेदार या तैलीय भोजन से परेशानी", tamil: "காரம் அல்லது எண்ணெய் உணவுக்கு உணர்திறன்" },
      { value: "Sensitive to milk or particular foods", hindi: "दूध या कुछ विशेष भोजन से परेशानी", tamil: "பால் அல்லது குறிப்பிட்ட உணவுகளுக்கு உணர்திறன்" },
      { value: "Symptoms change with heat or cold", hindi: "गर्मी या ठंड से लक्षण बदलते हैं", tamil: "வெப்பம் அல்லது குளிரில் அறிகுறிகள் மாறுகின்றன" },
      { value: "Not sure", hindi: "निश्चित नहीं", tamil: "தெரியவில்லை" },
    ],
  },
  {
    id: "sattva",
    eyebrow: "Sattva · Mental resilience",
    prompt: {
      English: "How have stress, mood and concentration been during this illness?",
      हिन्दी: "इस बीमारी के दौरान तनाव, मनोदशा और एकाग्रता कैसी रही है?",
      தமிழ்: "இந்த உடல்நலக் குறைபாட்டின்போது மனஅழுத்தம், மனநிலை மற்றும் கவனம் எப்படி இருந்தது?",
    },
    hint: "This supports whole-person assessment and is not a mental-health diagnosis.",
    choices: [
      { value: "Coping well with stable mood", hindi: "स्थिर मनोदशा के साथ अच्छी तरह संभाल रहे हैं", tamil: "நிலையான மனநிலையுடன் நன்றாக சமாளிக்கிறேன்" },
      { value: "Mild worry or irritability", hindi: "हल्की चिंता या चिड़चिड़ापन", tamil: "லேசான கவலை அல்லது எரிச்சல்" },
      { value: "Stress affects sleep or appetite", hindi: "तनाव से नींद या भूख प्रभावित", tamil: "மனஅழுத்தம் தூக்கம் அல்லது பசியை பாதிக்கிறது" },
      { value: "Difficulty concentrating or managing daily work", hindi: "ध्यान या दैनिक काम में कठिनाई", tamil: "கவனம் செலுத்த அல்லது தினசரி வேலை செய்ய சிரமம்" },
      { value: "Prefer to discuss privately", hindi: "निजी रूप से चर्चा करना चाहता/चाहती हूँ", tamil: "தனிப்பட்ட முறையில் பேச விரும்புகிறேன்" },
    ],
  },
  {
    id: "ahara_shakti",
    eyebrow: "Ahara Shakti · Food capacity",
    prompt: {
      English: "How much can you comfortably eat and digest at a usual meal?",
      हिन्दी: "सामान्य भोजन में आप कितना आराम से खा और पचा पाते हैं?",
      தமிழ்: "வழக்கமான உணவில் எவ்வளவு சௌகரியமாக உண்டு செரிக்க முடிகிறது?",
    },
    hint: "Consider both the amount eaten and comfort after eating.",
    choices: [
      { value: "Usual full meal without discomfort", hindi: "बिना परेशानी सामान्य पूरा भोजन", tamil: "அசௌகரியம் இல்லாமல் வழக்கமான முழு உணவு" },
      { value: "Only a small meal feels comfortable", hindi: "थोड़ा भोजन ही आरामदायक", tamil: "சிறிய அளவு உணவே சௌகரியம்" },
      { value: "Can eat well but digestion feels slow", hindi: "खा सकते हैं पर पाचन धीमा", tamil: "நன்றாக உண்ண முடியும் ஆனால் செரிமானம் மெதுவாக உள்ளது" },
      { value: "Meal size varies greatly", hindi: "भोजन की मात्रा बहुत बदलती है", tamil: "உணவின் அளவு மிகவும் மாறுபடுகிறது" },
      { value: "Unable to keep food or fluids down", hindi: "भोजन या तरल नहीं रुकता", tamil: "உணவு அல்லது திரவம் தங்கவில்லை" },
    ],
  },
  {
    id: "vyayama_shakti",
    eyebrow: "Vyayama Shakti · Functional capacity",
    prompt: {
      English: "What level of activity can you manage without unusual fatigue or breathlessness?",
      हिन्दी: "असामान्य थकान या सांस फूलने के बिना आप कितना काम कर पाते हैं?",
      தமிழ்: "அசாதாரண சோர்வு அல்லது மூச்சுத்திணறல் இல்லாமல் எவ்வளவு செயல்பட முடிகிறது?",
    },
    hint: "A sudden fall in capacity may need priority review.",
    choices: [
      { value: "Normal daily activity and exercise", hindi: "सामान्य दैनिक कार्य और व्यायाम", tamil: "வழக்கமான தினசரி செயல் மற்றும் உடற்பயிற்சி" },
      { value: "Daily activity but no strenuous exercise", hindi: "दैनिक काम, पर कठिन व्यायाम नहीं", tamil: "தினசரி செயல் முடியும்; கடின உடற்பயிற்சி முடியாது" },
      { value: "Tired after light activity", hindi: "हल्के काम के बाद थकान", tamil: "லேசான செயலுக்குப் பிறகு சோர்வு" },
      { value: "Breathless or weak with minimal activity", hindi: "बहुत कम काम में सांस फूलना या कमजोरी", tamil: "மிகக் குறைந்த செயலிலும் மூச்சுத்திணறல் அல்லது பலவீனம்" },
      { value: "Currently resting because of illness", hindi: "बीमारी के कारण अभी आराम पर", tamil: "உடல்நலக் குறைபாடு காரணமாக தற்போது ஓய்வில்" },
    ],
  },
  {
    id: "past_procedures",
    eyebrow: "Purva Karma · Surgery & admission history",
    prompt: {
      English: "Have you had any important surgery, hospital admission or previous treatment?",
      हिन्दी: "क्या कोई महत्वपूर्ण ऑपरेशन, अस्पताल में भर्ती या पुराना उपचार हुआ है?",
      தமிழ்: "முக்கிய அறுவை சிகிச்சை, மருத்துவமனை சேர்க்கை அல்லது முந்தைய சிகிச்சை இருந்ததா?",
    },
    hint: "Add the procedure, year and hospital in the note when known.",
    multiple: true,
    choices: [
      { value: "Previous surgery", hindi: "पहले ऑपरेशन हुआ है", tamil: "முந்தைய அறுவை சிகிச்சை" },
      { value: "Previous hospital admission", hindi: "पहले अस्पताल में भर्ती", tamil: "முந்தைய மருத்துவமனை சேர்க்கை" },
      { value: "Long-term treatment", hindi: "लंबे समय का उपचार", tamil: "நீண்டகால சிகிச்சை" },
      { value: "Blood transfusion or major procedure", hindi: "रक्त चढ़ाना या बड़ी प्रक्रिया", tamil: "இரத்த மாற்று அல்லது பெரிய சிகிச்சை" },
      { value: "No important previous procedure", hindi: "कोई महत्वपूर्ण पुरानी प्रक्रिया नहीं", tamil: "முக்கிய முந்தைய சிகிச்சை இல்லை" },
    ],
  },
  {
    id: "family_personal",
    eyebrow: "Kula–Vihara · Family & personal history",
    prompt: {
      English: "Which family or personal factors may be relevant?",
      हिन्दी: "कौन से पारिवारिक या व्यक्तिगत कारक संबंधित हो सकते हैं?",
      தமிழ்: "எந்த குடும்ப அல்லது தனிப்பட்ட காரணிகள் தொடர்புடையதாக இருக்கலாம்?",
    },
    hint: "Select all that apply; details remain available to the assigned clinician.",
    multiple: true,
    choices: [
      { value: "Similar illness in close family", hindi: "करीबी परिवार में समान बीमारी", tamil: "நெருங்கிய குடும்பத்தில் இதே போன்ற நோய்" },
      { value: "Family history of diabetes, blood pressure or heart disease", hindi: "परिवार में मधुमेह, रक्तचाप या हृदय रोग", tamil: "குடும்பத்தில் நீரிழிவு, இரத்த அழுத்தம் அல்லது இதய நோய்" },
      { value: "Tobacco, alcohol or other substance use", hindi: "तंबाकू, शराब या अन्य पदार्थ", tamil: "புகையிலை, மது அல்லது பிற பொருள் பயன்பாடு" },
      { value: "Recent travel, infection exposure or major life change", hindi: "हाल की यात्रा, संक्रमण संपर्क या बड़ा जीवन बदलाव", tamil: "சமீபப் பயணம், தொற்று தொடர்பு அல்லது பெரிய வாழ்க்கை மாற்றம்" },
      { value: "Nothing relevant known", hindi: "कोई संबंधित बात ज्ञात नहीं", tamil: "தொடர்புடையதாக எதுவும் தெரியவில்லை" },
    ],
  },
  {
    id: "conditions",
    eyebrow: "Purva Vyadhi · Medical history",
    prompt: {
      English: "Which health conditions or life stages should the Vaidya know about?",
      हिन्दी: "वैद्य को किन रोगों या जीवन अवस्थाओं के बारे में जानना चाहिए?",
      தமிழ்: "எந்த உடல்நிலை அல்லது வாழ்க்கை நிலைகளை வைத்தியர் அறிந்திருக்க வேண்டும்?",
    },
    hint: "Select every relevant option.",
    choices: [
      { value: "Diabetes", tamil: "நீரிழிவு" },
      { value: "High blood pressure or heart condition", tamil: "உயர் இரத்த அழுத்தம் அல்லது இதய நிலை" },
      { value: "Asthma or breathing condition", tamil: "ஆஸ்துமா அல்லது சுவாச நிலை" },
      { value: "Thyroid condition", tamil: "தைராய்டு நிலை" },
      { value: "Pregnant or breastfeeding", tamil: "கர்ப்பம் அல்லது தாய்ப்பால் கொடுத்தல்" },
      { value: "No known ongoing condition", tamil: "தொடர்ந்து உள்ள நோய் தெரியவில்லை" },
    ],
    multiple: true,
  },
  {
    id: "allergies",
    eyebrow: "Aushadha history · Medicines & allergies",
    prompt: {
      English: "What medicines, Ayurveda products or allergies must the Vaidya review?",
      हिन्दी: "वैद्य को किन दवाओं, आयुर्वेद उत्पादों या एलर्जी की समीक्षा करनी चाहिए?",
      தமிழ்: "எந்த மருந்துகள், ஆயுர்வேதப் பொருட்கள் அல்லது ஒவ்வாமைகளை வைத்தியர் பரிசீலிக்க வேண்டும்?",
    },
    hint: "Add names and doses below when known. Do not stop prescribed medicine without your clinician.",
    choices: [
      { value: "Taking prescribed medicines", tamil: "மருத்துவர் பரிந்துரைத்த மருந்துகள் எடுத்துக்கொள்கிறேன்" },
      { value: "Taking Ayurveda or herbal products", tamil: "ஆயுர்வேத அல்லது மூலிகைப் பொருட்கள் எடுத்துக்கொள்கிறேன்" },
      { value: "Medicine allergy", tamil: "மருந்து ஒவ்வாமை" },
      { value: "Food or other allergy", tamil: "உணவு அல்லது வேறு ஒவ்வாமை" },
      { value: "No known medicine or allergy concern", tamil: "அறியப்பட்ட மருந்து அல்லது ஒவ்வாமை பிரச்சனை இல்லை" },
    ],
    multiple: true,
  },
  {
    id: "breathing",
    eyebrow: "Atyayika Lakshana · Urgent warning signs",
    prompt: {
      English: "Do you have any urgent warning sign right now?",
      हिन्दी: "क्या अभी कोई आपातकालीन चेतावनी संकेत है?",
      தமிழ்: "இப்போது அவசர எச்சரிக்கை அறிகுறி ஏதேனும் உள்ளதா?",
    },
    hint: "Ayurvedic consultation does not replace emergency care. Select every sign that applies.",
    choices: [
      { value: "Breathing difficulty", tamil: "மூச்சு விடுவதில் சிரமம்" },
      { value: "Fainting, confusion or seizure", tamil: "மயக்கம், குழப்பம் அல்லது வலிப்பு" },
      { value: "Heavy bleeding or blood in vomit/stool", tamil: "அதிக இரத்தப்போக்கு அல்லது வாந்தி/மலத்தில் இரத்தம்" },
      { value: "Sudden weakness, speech or face change", tamil: "திடீர் பலவீனம், பேச்சு அல்லது முக மாற்றம்" },
      { value: "Severe dehydration or rapidly worsening pain", tamil: "கடுமையான நீரிழப்பு அல்லது வேகமாக மோசமாகும் வலி" },
      { value: "No urgent warning signs", tamil: "அவசர எச்சரிக்கை அறிகுறிகள் இல்லை" },
    ],
    multiple: true,
  },
];

const blankProfile: Profile = {
  fullName: "",
  age: "",
  sex: "",
  address: "",
  phone: "",
  abhaNumber: "",
  abhaAddress: "",
  department: "",
  doctorId: "",
  doctorName: "",
};

const languageTag: Record<Language, string> = {
  English: "en-IN",
  हिन्दी: "hi-IN",
  தமிழ்: "ta-IN",
};

const choiceTranslations: Record<
  Exclude<Language, "English">,
  Record<string, string>
> = {
  हिन्दी: {
    "Fever, weakness or general illness": "बुखार, कमजोरी या सामान्य बीमारी",
    "Digestion or abdominal concern": "पाचन या पेट की समस्या",
    "Skin or hair concern": "त्वचा या बालों की समस्या",
    "Joint, injury or wound concern": "जोड़, चोट या घाव की समस्या",
    "Women's health concern": "महिला स्वास्थ्य समस्या",
    "Eye, ear, nose or throat concern": "आँख, कान, नाक या गले की समस्या",
    "Child health, growth or feeding concern": "बाल स्वास्थ्य, विकास या आहार संबंधी समस्या",
    "Recovery, stiffness or rehabilitation concern": "स्वास्थ्य-लाभ, अकड़न या पुनर्वास की समस्या",
    "Lifestyle, prevention, diet or yoga guidance": "जीवनशैली, रोकथाम, आहार या योग मार्गदर्शन",
    "Sleep, stress or emotional concern": "नींद, तनाव या भावनात्मक समस्या",
    "Another concern": "अन्य समस्या",
    Today: "आज",
    "2–3 days ago": "2–3 दिन पहले",
    "Within the last week": "पिछले एक सप्ताह में",
    "1–4 weeks ago": "1–4 सप्ताह पहले",
    "More than one month": "एक महीने से अधिक",
    "Steady appetite and comfortable digestion": "स्थिर भूख और आरामदायक पाचन",
    "Low appetite or heaviness after food": "कम भूख या खाने के बाद भारीपन",
    "Appetite changes from day to day": "भूख का रोज़ बदलना",
    "Very strong or frequent hunger": "बहुत तेज़ या बार-बार भूख",
    "Burning, acidity or sour belching": "जलन, अम्लता या खट्टी डकार",
    "Regular and comfortable": "नियमित और आरामदायक",
    "Constipation or hard stool": "कब्ज़ या कठोर मल",
    "Loose or frequent stool": "पतला या बार-बार मल",
    "Alternates between constipation and loose stool": "कब्ज़ और पतले मल का बदलना",
    "Gas, bloating or incomplete evacuation": "गैस, पेट फूलना या अधूरा मल त्याग",
    "Mostly fresh home-cooked meals": "अधिकतर ताज़ा घर का भोजन",
    "Irregular meal times or skipped meals": "अनियमित भोजन समय या भोजन छोड़ना",
    "Frequent spicy, oily or fried food": "बार-बार मसालेदार, तैलीय या तला भोजन",
    "Frequent packaged or sugary food": "बार-बार पैकेट या मीठा भोजन",
    "Special or medically restricted diet": "विशेष या चिकित्सकीय नियंत्रित आहार",
    "Restful sleep and steady energy": "आरामदायक नींद और स्थिर ऊर्जा",
    "Difficulty falling asleep": "नींद आने में कठिनाई",
    "Waking repeatedly or too early": "बार-बार या बहुत जल्दी जागना",
    "Excess sleep or persistent fatigue": "अधिक नींद या लगातार थकान",
    "Low energy during the day": "दिन में कम ऊर्जा",
    "No recent change": "हाल में कोई बदलाव नहीं",
    "Recent bowel change": "हाल में मल में बदलाव",
    "Burning or frequent urination": "पेशाब में जलन या बार-बार पेशाब",
    "Reduced urination": "कम पेशाब",
    "Blood or unusual colour": "खून या असामान्य रंग",
    "Coldness, dryness or stiffness": "ठंडापन, रूखापन या अकड़न",
    "Heat, sweating, thirst or burning": "गर्मी, पसीना, प्यास या जलन",
    "Heaviness, sluggishness or congestion": "भारीपन, सुस्ती या जमाव",
    "Variable, restless or sensitive": "बदलता, बेचैन या संवेदनशील",
    "No clear pattern": "कोई स्पष्ट प्रवृत्ति नहीं",
    Diabetes: "मधुमेह",
    "High blood pressure or heart condition": "उच्च रक्तचाप या हृदय रोग",
    "Asthma or breathing condition": "दमा या सांस की बीमारी",
    "Thyroid condition": "थायरॉइड रोग",
    "Pregnant or breastfeeding": "गर्भवती या स्तनपान",
    "No known ongoing condition": "कोई ज्ञात चल रही बीमारी नहीं",
    "Taking prescribed medicines": "डॉक्टर की दवाएं ले रहे हैं",
    "Taking Ayurveda or herbal products": "आयुर्वेद या हर्बल उत्पाद ले रहे हैं",
    "Medicine allergy": "दवा से एलर्जी",
    "Food or other allergy": "भोजन या अन्य एलर्जी",
    "No known medicine or allergy concern": "कोई ज्ञात दवा या एलर्जी समस्या नहीं",
    "Breathing difficulty": "सांस लेने में कठिनाई",
    "Fainting, confusion or seizure": "बेहोशी, भ्रम या दौरा",
    "Heavy bleeding or blood in vomit/stool": "भारी रक्तस्राव या उल्टी/मल में खून",
    "Sudden weakness, speech or face change": "अचानक कमजोरी, बोली या चेहरे में बदलाव",
    "Severe dehydration or rapidly worsening pain": "गंभीर निर्जलीकरण या तेजी से बढ़ता दर्द",
    "No urgent warning signs": "कोई आपात चेतावनी संकेत नहीं",
  },
  தமிழ்: {},
};

const patientSteps = [
  { id: "identify", label: "Personal details", icon: UserRound },
  { id: "history", label: "Ayurvedic history", icon: ClipboardCheck },
  { id: "documents", label: "Medical records", icon: ScanLine },
  { id: "summary", label: "Review & submit", icon: ClipboardCheck },
] as const;

function StatusPill({
  children,
  tone = "teal",
}: {
  children: React.ReactNode;
  tone?: "teal" | "amber" | "red" | "slate";
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function maskedAbhaNumber(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return "Not linked";
  return `XX-XXXX-XXXX-${digits.slice(-4)}`;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(new Error("Unable to prepare the recording."));
    reader.readAsDataURL(blob);
  });
}

async function analyzeMedicalDocument(file: File): Promise<DocumentAnalysis> {
  const lowerName = file.name.toLowerCase();
  let extractedText = "";
  if (file.type.startsWith("text/") || /\.(txt|csv)$/i.test(file.name)) {
    extractedText = (await file.text()).slice(0, 60_000);
  } else if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const bytes = await file.slice(0, 750_000).arrayBuffer();
    extractedText = new TextDecoder("latin1")
      .decode(bytes)
      .replace(/[^\x20-\x7E\n]+/g, " ");
  }
  const intelligence = analyzeClinicalText(`${file.name}\n${extractedText}`);
  const searchableText = `${lowerName} ${extractedText.toLowerCase()}`;

  let type = intelligence.documentType;
  let summary =
    "The file is ready for physician review. Confirm the patient name, record date and issuing facility before relying on it.";
  if (type === "Prescription / medication record") {
    type = "Prescription / medication record";
    summary =
      "Medication-related content was detected. The doctor should verify every medicine name, strength, frequency, duration and allergy risk.";
  } else if (type === "Laboratory report") {
    summary =
      "This appears to be a laboratory report. Results must be read with the printed units, reference ranges, collection date and clinical symptoms.";
  } else if (type === "Discharge summary") {
    summary =
      "This appears to be a discharge record. The doctor should review diagnoses, procedures, discharge medicines and follow-up instructions.";
  } else if (type === "Imaging / radiology record") {
    summary =
      "This appears to be an imaging record. The written radiologist impression and the original images should be reviewed together.";
  }

  const feedback = [
    `${file.name} · ${(file.size / 1024).toFixed(0)} KB · ${type}`,
  ];
  if (file.type.startsWith("image/")) {
    try {
      const image = await createImageBitmap(file);
      feedback.push(
        image.width >= 1000 && image.height >= 700
          ? `Image resolution ${image.width}×${image.height} is suitable for on-screen review.`
          : `Image resolution ${image.width}×${image.height} may be difficult to read; retake it in bright, even light.`,
      );
      image.close();
    } catch {
      feedback.push(
        "Image attached; the doctor should confirm that all text is readable.",
      );
    }
  } else if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    feedback.push(
      searchableText.length > lowerName.length + 150
        ? "The PDF contains machine-readable text that can support assisted review."
        : "The PDF may be scanned; visual verification is required because text extraction was limited.",
    );
  } else {
    feedback.push(
      "Searchable text was detected and screened for common clinical document sections.",
    );
  }
  feedback.push(
    "No diagnosis or medicine change is made automatically from an uploaded record.",
  );
  if (intelligence.findings.length) {
    feedback.push(
      `${intelligence.findings.length} source-linked item${intelligence.findings.length === 1 ? "" : "s"} detected with ${intelligence.confidence} extraction confidence; every item requires doctor confirmation.`,
    );
  }
  return {
    type,
    summary,
    feedback,
    findings: intelligence.findings,
    confidence: intelligence.confidence,
    evidence: createDocumentEvidence({
      documentType: type,
      summary,
      confidence: intelligence.confidence,
      findings: intelligence.findings,
    }),
  };
}

function LoginScreen({
  onLogin,
  initialRole,
  language,
  onLanguageChange,
}: {
  onLogin: (user: AuthUser) => void;
  initialRole: AppRole;
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const [role, setRole] = useState<AppRole>(initialRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [doctorRegistrationOpen, setDoctorRegistrationOpen] = useState(false);
  const [biometricOpen, setBiometricOpen] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");
  const [biometricMode, setBiometricMode] = useState<"choose" | "setup" | "login">("choose");
  const [setupUsername, setSetupUsername] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [guideStep, setGuideStep] = useState(0);
  const biometricCopy = {
    English: {
      title: "Look at your device",
      instruction: "Keep your face visible and follow the Face ID or biometric prompt from your device.",
      action: "Start secure login",
      listening: "Your device will now verify you securely.",
      returning: "I already set it up",
      firstTime: "Set up this device first",
      setupTitle: "First-time setup",
      setupHelp: "A trusted helper enters the username and password once. Future logins need only your device biometric.",
      username: "Username",
      password: "Password",
      setupAction: "Verify and enable biometric login",
      portalTitle: "Face / Biometric Login",
      portalHint: "Tap the picture · no typing",
      divider: "OR USE USERNAME",
      savedMethod: "Face ID / biometric",
      assistedMethod: "One-time assisted setup",
      privacy: "Your face stays on this device. AyurDoc stores no face photo.",
      back: "Back",
    },
    हिन्दी: {
      title: "अपने डिवाइस की ओर देखें",
      instruction: "अपना चेहरा सामने रखें और डिवाइस पर Face ID या बायोमेट्रिक निर्देश का पालन करें।",
      action: "सुरक्षित लॉगिन शुरू करें",
      listening: "आपका डिवाइस अब सुरक्षित रूप से आपकी पहचान जाँचेगा।",
      returning: "मैंने पहले सेट किया है",
      firstTime: "पहले इस डिवाइस को सेट करें",
      setupTitle: "पहली बार सेटअप",
      setupHelp: "विश्वसनीय सहायक एक बार उपयोगकर्ता नाम और पासवर्ड दर्ज करे। अगली बार केवल बायोमेट्रिक की आवश्यकता होगी।",
      username: "उपयोगकर्ता नाम",
      password: "पासवर्ड",
      setupAction: "जाँचें और बायोमेट्रिक चालू करें",
      portalTitle: "चेहरा / बायोमेट्रिक लॉगिन",
      portalHint: "चित्र छुएँ · टाइप न करें",
      divider: "या उपयोगकर्ता नाम से जाएँ",
      savedMethod: "Face ID / बायोमेट्रिक",
      assistedMethod: "केवल पहली बार सहायता",
      privacy: "आपका चेहरा इसी डिवाइस में रहता है। AyurDoc चेहरे की फोटो नहीं रखता।",
      back: "वापस",
    },
    தமிழ்: {
      title: "உங்கள் சாதனத்தைப் பாருங்கள்",
      instruction: "முகத்தை நேராக வைத்து, சாதனத்தின் Face ID அல்லது பயோமெட்ரிக் வழிமுறையைப் பின்பற்றுங்கள்.",
      action: "பாதுகாப்பான உள்நுழைவை தொடங்கு",
      listening: "உங்கள் சாதனம் இப்போது உங்களை பாதுகாப்பாகச் சரிபார்க்கும்.",
      returning: "முன்பே அமைத்துள்ளேன்",
      firstTime: "முதலில் இந்த சாதனத்தை அமைக்கவும்",
      setupTitle: "முதல் முறை அமைப்பு",
      setupHelp: "நம்பகமான உதவியாளர் ஒருமுறை பயனர்பெயர் மற்றும் கடவுச்சொல்லை உள்ளிட வேண்டும். அடுத்த முறை பயோமெட்ரிக் மட்டும் போதும்.",
      username: "பயனர்பெயர்",
      password: "கடவுச்சொல்",
      setupAction: "சரிபார்த்து பயோமெட்ரிக் உள்நுழைவை இயக்கு",
      portalTitle: "முகம் / பயோமெட்ரிக் உள்நுழைவு",
      portalHint: "படத்தைத் தொடவும் · தட்டச்சு வேண்டாம்",
      divider: "அல்லது பயனர்பெயரைப் பயன்படுத்தவும்",
      savedMethod: "Face ID / பயோமெட்ரிக்",
      assistedMethod: "முதல் முறை மட்டும் உதவி",
      privacy: "உங்கள் முகம் இந்தச் சாதனத்திலேயே இருக்கும். AyurDoc முகப் படத்தைச் சேமிக்காது.",
      back: "பின்செல்",
    },
  }[language];

  function speakBiometric(text = biometricCopy.instruction, spokenLanguage: Language = language) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    const languageCode = spokenLanguage === "हिन्दी" ? "hi-IN" : spokenLanguage === "தமிழ்" ? "ta-IN" : "en-IN";
    const voicePrefix = languageCode.slice(0, 2).toLowerCase();
    const matchingVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith(voicePrefix));
    speech.lang = languageCode;
    if (matchingVoice) speech.voice = matchingVoice;
    speech.rate = 0.76;
    speech.volume = 1;
    window.speechSynthesis.speak(speech);
  }

  async function biometricLogin() {
    if (!("PublicKeyCredential" in window)) {
      setBiometricError("This browser does not support secure biometric login. Use Safari, Chrome or Edge on a supported device.");
      return;
    }
    setBiometricLoading(true);
    setBiometricError("");
    speakBiometric(biometricCopy.listening);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/authentication-options", { method: "POST" });
      const optionsData = await readJsonResponse<{
        challengeId?: string;
        options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
        error?: string;
      }>(optionsResponse);
      if (!optionsResponse.ok || !optionsData.challengeId || !optionsData.options)
        throw new Error(optionsData.error || "Unable to start biometric login.");
      const credential = await startAuthentication({ optionsJSON: optionsData.options });
      const verifyResponse = await fetch("/api/auth/passkey/authentication-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: optionsData.challengeId, response: credential }),
      });
      const verifyData = await readJsonResponse<{ user?: AuthUser; error?: string }>(verifyResponse);
      if (!verifyResponse.ok || !verifyData.user)
        throw new Error(verifyData.error || "Biometric login could not be verified.");
      window.speechSynthesis?.cancel();
      setBiometricOpen(false);
      onLogin(verifyData.user);
    } catch (biometricFailure) {
      const name = biometricFailure instanceof Error ? biometricFailure.name : "";
      setBiometricError(
        name === "NotAllowedError"
          ? "No AyurDoc biometric login is enrolled on this device, the prompt was cancelled, or this in-app browser blocked it. Choose ‘Set up this device first’ below."
          : biometricFailure instanceof Error
            ? biometricFailure.message
            : "Biometric login was cancelled or could not be verified.",
      );
    } finally {
      setBiometricLoading(false);
    }
  }

  async function setupBiometricFromLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!setupUsername.trim() || !setupPassword) return;
    setBiometricLoading(true);
    setBiometricError("");
    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: setupUsername, password: setupPassword }),
      });
      const loginData = await readJsonResponse<{ user?: AuthUser; error?: string }>(loginResponse);
      if (!loginResponse.ok || !loginData.user)
        throw new Error(loginData.error || "The username or password is incorrect.");

      speakBiometric();
      const optionsResponse = await fetch("/api/auth/passkey/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginData.user.username }),
      });
      const optionsData = await readJsonResponse<{
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
          username: loginData.user.username,
          challengeId: optionsData.challengeId,
          response: credential,
        }),
      });
      const verifyData = await readJsonResponse<{ verified?: boolean; error?: string }>(verifyResponse);
      if (!verifyResponse.ok || !verifyData.verified)
        throw new Error(verifyData.error || "Biometric setup could not be completed.");
      setBiometricOpen(false);
      onLogin(loginData.user);
    } catch (setupFailure) {
      const name = setupFailure instanceof Error ? setupFailure.name : "";
      setBiometricError(
        name === "NotAllowedError"
          ? "The biometric prompt was cancelled or blocked. Open this website directly in Safari or Chrome, allow the prompt, and try again."
          : setupFailure instanceof Error ? setupFailure.message : "Biometric setup failed.",
      );
    } finally {
      setBiometricLoading(false);
    }
  }
  const guideSteps = [
    {
      icon: LockKeyhole,
      title: "Choose a secure portal",
      description:
        "Select Patient or Doctor, enter your username and password, then press Continue.",
    },
    {
      icon: UserRound,
      title: "Patient enters personal details",
      description:
        "The patient adds their own name, age, sex, address, phone number and preferred department before completing clinical questions.",
    },
    {
      icon: Mic,
      title: "Speak directly to the doctor",
      description:
        "Open Voice to Vaidya, choose the Ayurvedic department and Vaidya, record the concern, review the live transcript, then send. Only that Vaidya receives the audio and structured summary.",
    },
    {
      icon: MonitorCheck,
      title: "Book and join consultation",
      description:
        "Choose a doctor and appointment slot. At the scheduled time, both patient and doctor can join the video consultation from Appointments.",
    },
    {
      icon: Building2,
      title: "Use hospital services",
      description:
        "Check beds, request emergency support, view blood availability, request blood or register a donation from the service modules.",
    },
    {
      icon: Stethoscope,
      title: "Doctor reviews and responds",
      description:
        "The doctor opens patient records and voice messages, verifies summaries, adds notes, updates status and uses the floating assistant when guidance is needed.",
    },
  ];

  useEffect(() => {
    if (!guideOpen) return;
    const timer = window.setInterval(
      () => setGuideStep((current) => (current + 1) % guideSteps.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [guideOpen, guideSteps.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await readJsonResponse(response)) as {
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !data.user)
        throw new Error(data.error || "Unable to sign in.");
      if (data.user.role !== role)
        throw new Error(
          `Use the ${data.user.role} login option for this account.`,
        );
      onLogin(data.user);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  }

  const ActiveGuideIcon = guideSteps[guideStep].icon;

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-mark">
            <AyurDocLogo size={34} />
          </div>
          <div>
            <strong>AyurDoc</strong>
            <span>Connected patient and Vaidya care</span>
          </div>
        </div>
        <div className="story-copy">
          <StatusPill tone="teal">
            <ShieldCheck size={13} /> Consent-first Ayurvedic care
          </StatusPill>
          <h1>
            Healthcare that listens.
            <br />
            <em>Rooted in Ayurveda.</em>
          </h1>
          <p>
            A simple, voice-friendly Ayurvedic care portal designed for guided
            conversations, local languages and human-led wellness support.
          </p>
          <span className="story-copyright">© 2026 MedZone</span>
        </div>
        <div className="story-flow">
          <div>
            <Mic />
            <span>
              <strong>Speak or tap</strong>Accessible case history
            </span>
          </div>
          <ChevronRight />
          <div>
            <Database />
            <span>
              <strong>Structure securely</strong>Ayurvedic case record
            </span>
          </div>
          <ChevronRight />
          <div>
            <Stethoscope />
            <span>
              <strong>Vaidya verifies</strong>Human stays in control
            </span>
          </div>
        </div>
        <div className="story-trust">
          <LockKeyhole size={15} /> Clinical support only. AyurDoc does not
          diagnose or prescribe.
        </div>
      </section>

      <section className="login-panel">
        <div className="login-mobile-message">
          <AyurDocLogo size={38} />
          <div>
            <h1>Healthcare that listens. <em>Rooted in Ayurveda.</em></h1>
            <span>© 2026 MedZone</span>
          </div>
        </div>
        <div className="login-utility-actions">
          <Select
            value={language}
            onValueChange={(value) => onLanguageChange(value as Language)}
          >
            <SelectTrigger className="login-language-select" aria-label="Choose language">
              <Languages size={16} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="login-language-en" value="English">English</SelectItem>
              <SelectItem key="login-language-hi" value="हिन्दी">हिन्दी</SelectItem>
              <SelectItem key="login-language-ta" value="தமிழ்">தமிழ்</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            className="login-guide-trigger"
            onClick={() => {
              setGuideStep(0);
              setGuideOpen(true);
            }}
          >
            <Play size={18} /> How to use
          </button>
          <a className="login-admin-shortcut" href="/admin" target="_blank" rel="noreferrer" aria-label="Open administrator portal in a new tab" title="Administrator portal">
            <ShieldCheck size={18} />
          </a>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <span className="mini-label">Patient & doctor access</span>
            <h2>Welcome to AyurDoc</h2>
            <p>First choose the portal you want to open.</p>
          </div>
          <button
            type="button"
            className="face-access-portal"
            onClick={() => {
              setBiometricError("");
              setBiometricMode("choose");
              setBiometricOpen(true);
              speakBiometric();
            }}
            aria-label="Open face or biometric login"
          >
            <span className="face-access-symbol" aria-hidden="true">
              <ScanFace size={48} strokeWidth={1.7} />
              <span className="face-access-pulse" />
            </span>
            <span className="face-access-copy">
              <strong>{biometricCopy.portalTitle}</strong>
              <small>{biometricCopy.portalHint}</small>
            </span>
            <Volume2 className="face-access-audio" size={24} aria-hidden="true" />
          </button>
          <div className="login-method-divider"><span>{biometricCopy.divider}</span></div>
          <Tabs
            value={role}
            onValueChange={(value) => {
              setRole(value as AppRole);
              setError("");
            }}
          >
            <TabsList className="login-role-tabs">
              <TabsTrigger value="patient">
                <UserRound size={20} />
                <span><strong>Patient Portal</strong><small>Enter symptoms and records</small></span>
              </TabsTrigger>
              <TabsTrigger value="doctor">
                <Stethoscope size={20} />
                <span><strong>Doctor Portal</strong><small>Review assigned patients</small></span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="login-field">
            <span>Username</span>
            <Input
              id="login-username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={`Enter ${role} username`}
              autoComplete="username"
              required
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <div className="password-field">
              <Input
                id="login-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && (
            <div className="login-error" role="alert">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <Button
            id="portal-login-submit"
            type="submit"
            size="lg"
            className="login-submit"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <>
                <LoaderCircle className="spin" size={17} /> Signing in…
              </>
            ) : (
              <>
                Continue as {role} <ArrowRight size={17} />
              </>
            )}
          </Button>
          {role === "patient" ? (
            <Button
              type="button"
              variant="outline"
              className="login-register"
              onClick={() => setRegistrationOpen(true)}
            >
              <UserCheck size={17} /> New patient registration
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="login-register"
              onClick={() => setDoctorRegistrationOpen(true)}
            >
              <BadgeCheck size={17} /> New Vaidya? Apply for verification
            </Button>
          )}
          <p className="login-security">
            <LockKeyhole size={13} /> Credentials are checked on the server.
            Sessions expire automatically.
          </p>
        </form>
      </section>

      <PatientRegistration
        open={registrationOpen}
        onOpenChange={setRegistrationOpen}
        language={language}
      />
      <DoctorRegistration
        open={doctorRegistrationOpen}
        onOpenChange={setDoctorRegistrationOpen}
      />

      {guideOpen && (
        <div className="login-guide-backdrop" role="presentation">
          <section
            className="login-guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="How AyurDoc works"
          >
            <header>
              <div>
                <span>AYURDOC WALKTHROUGH</span>
                <strong>How the complete software works</strong>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Close walkthrough"
              >
                <X size={21} />
              </button>
            </header>

            <div className="guide-progress" aria-label="Walkthrough progress">
              {guideSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={index === guideStep ? "active" : ""}
                  onClick={() => setGuideStep(index)}
                  aria-label={`Open step ${index + 1}`}
                >
                  <span />
                </button>
              ))}
            </div>

            <div className="guide-scene" key={guideStep}>
              <div className="guide-scene-icon">
                <ActiveGuideIcon size={42} />
                <span className="guide-orbit one" />
                <span className="guide-orbit two" />
              </div>
              <span className="guide-step-number">
                Step {guideStep + 1} of {guideSteps.length}
              </span>
              <h2>{guideSteps[guideStep].title}</h2>
              <p>{guideSteps[guideStep].description}</p>
            </div>

            <footer>
              <Button
                type="button"
                variant="outline"
                disabled={guideStep === 0}
                onClick={() => setGuideStep((current) => current - 1)}
              >
                <ArrowLeft size={16} /> Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (guideStep === guideSteps.length - 1) setGuideOpen(false);
                  else setGuideStep((current) => current + 1);
                }}
              >
                {guideStep === guideSteps.length - 1 ? "Finish" : "Next"}
                <ArrowRight size={16} />
              </Button>
            </footer>
          </section>
        </div>
      )}

      {biometricOpen && (
        <div className="biometric-backdrop" role="presentation">
          <section className="biometric-dialog" role="dialog" aria-modal="true" aria-labelledby="biometric-title">
            <button
              type="button"
              className="biometric-close"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setBiometricOpen(false);
              }}
              aria-label="Close biometric login"
            >
              <X size={24} />
            </button>
            <div className="biometric-scan" aria-hidden="true">
              <ScanFace size={92} strokeWidth={1.25} />
              <span />
            </div>
            <h2 id="biometric-title">{biometricMode === "setup" ? biometricCopy.setupTitle : biometricCopy.title}</h2>
            <p>{biometricMode === "setup" ? biometricCopy.setupHelp : biometricCopy.instruction}</p>
            <div className="biometric-language-buttons" aria-label="Spoken instruction language">
              {(["English", "हिन्दी", "தமிழ்"] as Language[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={item === language ? "active" : ""}
                  onClick={() => {
                    onLanguageChange(item);
                    const prompt = item === "हिन्दी"
                      ? "अपना चेहरा सामने रखें और डिवाइस के बायोमेट्रिक निर्देश का पालन करें।"
                      : item === "தமிழ்"
                        ? "முகத்தை நேராக வைத்து, சாதனத்தின் பயோமெட்ரிக் வழிமுறையைப் பின்பற்றுங்கள்."
                        : "Keep your face visible and follow the biometric prompt from your device.";
                    speakBiometric(prompt, item);
                  }}
                >
                  <Volume2 size={18} /> {item}
                </button>
              ))}
            </div>
            {biometricError && <div className="biometric-error" role="alert"><AlertTriangle size={19} /> {biometricError}</div>}
            {biometricMode === "choose" && (
              <div className="biometric-choice-grid">
                <button type="button" onClick={() => { setBiometricMode("login"); setBiometricError(""); void biometricLogin(); }}>
                  <ScanFace size={33} /><strong>{biometricCopy.returning}</strong><small>{biometricCopy.savedMethod}</small>
                </button>
                <button type="button" onClick={() => { setBiometricMode("setup"); setBiometricError(""); }}>
                  <UserCheck size={33} /><strong>{biometricCopy.firstTime}</strong><small>{biometricCopy.assistedMethod}</small>
                </button>
              </div>
            )}
            {biometricMode === "login" && (
              <>
                <button type="button" className="biometric-start" onClick={biometricLogin} disabled={biometricLoading}>
                  {biometricLoading ? <LoaderCircle className="spin" size={30} /> : <ScanFace size={32} />}
                  <strong>{biometricLoading ? biometricCopy.listening : biometricCopy.action}</strong>
                </button>
                <button type="button" className="biometric-back-link" onClick={() => { setBiometricMode("setup"); setBiometricError(""); }}>
                  <UserCheck size={19} /> {biometricCopy.firstTime}
                </button>
              </>
            )}
            {biometricMode === "setup" && (
              <form className="biometric-setup-form" onSubmit={setupBiometricFromLogin}>
                <label><span>{biometricCopy.username}</span><Input value={setupUsername} onChange={(event) => setSetupUsername(event.target.value.toLowerCase())} autoComplete="username" required /></label>
                <label><span>{biometricCopy.password}</span><Input value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
                <button type="submit" className="biometric-start" disabled={biometricLoading || !setupUsername || !setupPassword}>
                  {biometricLoading ? <LoaderCircle className="spin" size={28} /> : <ScanFace size={29} />}
                  <strong>{biometricLoading ? biometricCopy.listening : biometricCopy.setupAction}</strong>
                </button>
                <button type="button" className="biometric-back-link" onClick={() => { setBiometricMode("choose"); setBiometricError(""); }}><ArrowLeft size={18} /> {biometricCopy.back}</button>
              </form>
            )}
            <small className="biometric-privacy"><ShieldCheck size={15} /> {biometricCopy.privacy}</small>
          </section>
        </div>
      )}
      <FloatingMedicalAssistant language={language} onLanguageChange={onLanguageChange} />
    </main>
  );
}

function ProfileDetail({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div className={wide ? "wide" : ""}>
      <span>{label}</span>
      <strong>{value?.trim() || "Not added yet"}</strong>
    </div>
  );
}

export default function Home() {
  const doctors = useDoctorDirectory();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [preferredLoginRole, setPreferredLoginRole] =
    useState<AppRole>("patient");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [portalProfile, setPortalProfile] = useState<PortalProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [portalView, setPortalView] = useState<PortalView>("home");
  const [preferredDoctorId, setPreferredDoctorId] = useState("");
  const [phase, setPhase] = useState<Phase>("identify");
  const [language, setLanguage] = useState<Language>("English");
  useInterfaceTranslation(language);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [consented, setConsented] = useState(false);
  const [abhaConsented, setAbhaConsented] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [documentState, setDocumentState] = useState<DocumentState>("empty");
  const [documentName, setDocumentName] = useState("");
  const [documentAnalysis, setDocumentAnalysis] =
    useState<DocumentAnalysis | null>(null);
  const [documentUpload, setDocumentUpload] = useState<DocumentUpload | null>(
    null,
  );
  const [documentNotes, setDocumentNotes] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [capturedDocument, setCapturedDocument] = useState<File | null>(null);
  const [capturePreviewUrl, setCapturePreviewUrl] = useState("");
  const [identity, setIdentity] = useState<IdentityRecord | null>(null);
  const [identityType, setIdentityType] = useState("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [editingIntakeId, setEditingIntakeId] = useState<number | null>(null);
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [doctorNote, setDoctorNote] = useState("");
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [doctorMessage, setDoctorMessage] = useState("");
  const [workflowEvidence, setWorkflowEvidence] = useState<WorkflowEvidence | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [physicianSummary, setPhysicianSummary] = useState("");
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const identityFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("ayurdoc-language");
    if (
      storedLanguage === "English" ||
      storedLanguage === "हिन्दी" ||
      storedLanguage === "தமிழ்"
    ) {
      const languageTimer = window.setTimeout(
        () => setLanguage(storedLanguage),
        0,
      );
      return () => window.clearTimeout(languageTimer);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ayurdoc-language", language);
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        setAuthUser(null);
        setPortalView("home");
        setAuthLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (authUser?.role !== "patient") return;
    let active = true;
    fetch("/api/identity", { cache: "no-store" })
      .then(async (response) => {
        const data = (await readJsonResponse(response)) as { identity?: IdentityRecord | null };
        if (active && response.ok) {
          setIdentity(data.identity ?? null);
          if (data.identity?.id_type) setIdentityType(data.identity.id_type);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [authUser]);

  const activeQuestions = useMemo(() => {
    const complaint = responses.complaint?.[0] ?? "";
    return questions.filter((question) =>
      !question.showWhenComplaintIncludes?.length ||
      question.showWhenComplaintIncludes.some((term) => complaint.includes(term)),
    );
  }, [responses.complaint]);
  const activeQuestion = activeQuestions[Math.min(questionIndex, activeQuestions.length - 1)];
  const selectedChoices = responses[activeQuestion?.id] ?? [];
  const redFlag = (responses.breathing ?? []).some(
    (value) => !value.startsWith("No urgent"),
  );
  const selectedIntake =
    intakes.find((item) => item.id === selectedIntakeId) ?? intakes[0] ?? null;
  const signedInDoctor = authUser?.role === "doctor"
    ? doctorForUsername(authUser.username)
    : null;

  const phaseIndex =
    phase === "submitted"
      ? 3
      : patientSteps.findIndex((item) => item.id === phase);
  const patientSummary = useMemo(
    () => ({
      complaint: responses.complaint?.join(", ") ?? "Not provided",
      onset: responses.onset?.join(", ") ?? "Not provided",
      symptoms:
        [
          responses.agni?.length ? `Agni: ${responses.agni.join(", ")}` : "",
          responses.koshtha?.length ? `Koshtha: ${responses.koshtha.join(", ")}` : "",
          responses.ahara?.length ? `Ahara: ${responses.ahara.join(", ")}` : "",
          responses.nidra?.length ? `Nidra: ${responses.nidra.join(", ")}` : "",
          responses.mala_mutra?.length ? `Mala–Mutra: ${responses.mala_mutra.join(", ")}` : "",
          responses.deha?.length ? `Reported tendency: ${responses.deha.join(", ")}` : "",
          responses.satmya?.length ? `Satmya: ${responses.satmya.join(", ")}` : "",
          responses.sattva?.length ? `Sattva: ${responses.sattva.join(", ")}` : "",
          responses.ahara_shakti?.length ? `Ahara Shakti: ${responses.ahara_shakti.join(", ")}` : "",
          responses.vyayama_shakti?.length ? `Vyayama Shakti: ${responses.vyayama_shakti.join(", ")}` : "",
          responses.past_procedures?.length ? `Previous procedures: ${responses.past_procedures.join(", ")}` : "",
          responses.family_personal?.length ? `Family/personal history: ${responses.family_personal.join(", ")}` : "",
          responses.chest_pathway?.length ? `Chest pathway: ${responses.chest_pathway.join(", ")}` : "",
          responses.digestive_pathway?.length ? `Digestive pathway: ${responses.digestive_pathway.join(", ")}` : "",
          responses.skin_pathway?.length ? `Skin pathway: ${responses.skin_pathway.join(", ")}` : "",
          responses.womens_pathway?.length ? `Women’s-health pathway: ${responses.womens_pathway.join(", ")}` : "",
          responses.breathing?.join(", "),
        ]
          .filter(Boolean)
          .join(" · ") || "Not provided",
      conditions: responses.conditions?.join(", ") ?? "Not provided",
      allergies: responses.allergies?.join(", ") ?? "Not provided",
    }),
    [responses],
  );
  const patientInformationComplete = Boolean(
    profile.fullName.trim() &&
    Number(profile.age) >= 1 &&
    Number(profile.age) <= 120 &&
    profile.sex &&
    profile.address.trim() &&
    isValidPhoneNumber(profile.phone) &&
    profile.abhaNumber.replace(/\D/g, "").length === 14 &&
    profile.department && profile.doctorId && profile.doctorName,
  );
  const clinicalInterviewComplete = activeQuestions.every(
    (question) => (responses[question.id] ?? []).length > 0,
  );
  const sessionSignals = useMemo(() => ({
    currentModule: portalView,
    phase,
    hasIdentity: Boolean(identity || identityFile),
    hasConsent: consented && abhaConsented,
    patientInformationComplete,
    clinicalInterviewComplete,
    documentUploaded: Boolean(documentUpload || documentName),
    documentProcessed: Boolean(documentAnalysis),
    patientConfirmed,
    currentCase: submittedId ?? editingIntakeId,
    physicianVerified: Boolean(workflowEvidence?.workflow.decision === "confirmed"),
  }), [portalView, phase, identity, identityFile, consented, abhaConsented, patientInformationComplete, clinicalInterviewComplete, documentUpload, documentName, documentAnalysis, patientConfirmed, submittedId, editingIntakeId, workflowEvidence?.workflow.decision]);
  const { context: sessionContext, recordAction: recordSessionAction } = useSessionContextManager({
    username: authUser?.username ?? "anonymous",
    language,
    signals: sessionSignals,
  });

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function profileValid() {
    const age = Number(profile.age);
    return Boolean(
      profile.fullName.trim() &&
      age >= 1 &&
      age <= 120 &&
      profile.sex &&
      profile.address.trim() &&
      isValidPhoneNumber(profile.phone) &&
      profile.abhaNumber.replace(/\D/g, "").length === 14 &&
      abhaConsented &&
      profile.department &&
      profile.doctorId &&
      profile.doctorName &&
      consented,
    );
  }

  function choose(value: string) {
    const current = responses[activeQuestion.id] ?? [];
    let next: string[];
    if (activeQuestion.multiple) {
      const exclusive =
        value === "No" ||
        value.startsWith("None") ||
        value.startsWith("No known") ||
        value.startsWith("No ");
      if (exclusive) next = [value];
      else {
        const filtered = current.filter(
          (item) =>
            item !== "No" &&
            !item.startsWith("None") &&
            !item.startsWith("No known") &&
            !item.startsWith("No "),
        );
        next = filtered.includes(value)
          ? filtered.filter((item) => item !== value)
          : [...filtered, value];
      }
    } else next = [value];
    setResponses((currentResponses) => ({
      ...currentResponses,
      [activeQuestion.id]: next,
    }));
  }

  function nextQuestion() {
    if (questionIndex < activeQuestions.length - 1)
      setQuestionIndex((value) => value + 1);
    else setPhase("documents");
  }

  function continueFromVoiceGuide() {
    recordSessionAction("voice-guide-continue");
    if (portalView !== "intake") {
      setPortalView("intake");
      return;
    }
    if (phase === "identify") {
      if (profileValid()) setPhase("history");
      return;
    }
    if (phase === "history") {
      if (selectedChoices.length) nextQuestion();
      return;
    }
    if (phase === "documents") {
      void continueToSummary();
      return;
    }
    if (phase === "summary") {
      void submitIntake();
      return;
    }
    setPortalView("appointments");
  }

  function openReportsFromVoiceGuide() {
    recordSessionAction("voice-guide-reports");
    setPortalView("intake");
    if (!profileValid()) setPhase("identify");
    else if (!clinicalInterviewComplete) setPhase("history");
    else setPhase("documents");
  }

  function openSummaryFromVoiceGuide() {
    recordSessionAction("voice-guide-summary");
    setPortalView("intake");
    if (phase === "submitted") return;
    if (!profileValid()) setPhase("identify");
    else if (!clinicalInterviewComplete) setPhase("history");
    else void continueToSummary();
  }

  function everyClinicalQuestionAnswered() {
    return activeQuestions.every((question) => (responses[question.id] ?? []).length > 0);
  }

  async function uploadIdentityIfNeeded() {
    if (!identityFile) return Boolean(identity);
    if (!identityType) {
      setIdentityError("Choose the government ID type.");
      return false;
    }
    setIdentityLoading(true);
    setIdentityError("");
    try {
      const form = new FormData();
      form.set("idType", identityType);
      form.set("governmentId", identityFile);
      const response = await fetch("/api/identity", { method: "POST", body: form });
      const data = (await readJsonResponse(response)) as { identity?: IdentityRecord; error?: string };
      if (!response.ok || !data.identity)
        throw new Error(data.error || "Government ID could not be saved.");
      setIdentity(data.identity);
      setIdentityFile(null);
      return true;
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Government ID could not be saved.");
      return false;
    } finally {
      setIdentityLoading(false);
    }
  }

  async function continueToSummary() {
    if (!everyClinicalQuestionAnswered()) {
      const firstMissing = activeQuestions.findIndex((question) => !(responses[question.id] ?? []).length);
      setQuestionIndex(Math.max(0, firstMissing));
      setPhase("history");
      setIdentityError("Answer every required clinical question before review.");
      return;
    }
    if (!(await uploadIdentityIfNeeded())) {
      setIdentityError("A government-issued ID is required before submission.");
      return;
    }
    setPatientConfirmed(false);
    setPhase("summary");
  }

  function navigateIntakeStep(target: (typeof patientSteps)[number]["id"]) {
    setSubmitError("");
    if (target === "identify") return setPhase("identify");
    if (!profileValid()) {
      setSubmitError("Complete personal details, doctor referral and consent first.");
      return setPhase("identify");
    }
    if (target === "history") return setPhase("history");
    if (!everyClinicalQuestionAnswered()) {
      const firstMissing = activeQuestions.findIndex((question) => !(responses[question.id] ?? []).length);
      setQuestionIndex(Math.max(0, firstMissing));
      setSubmitError("Answer every clinical question before continuing.");
      return setPhase("history");
    }
    if (target === "documents") return setPhase("documents");
    void continueToSummary();
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    message.lang = languageTag[language];
    window.speechSynthesis.speak(message);
  }

  async function processDocument(file: File) {
    if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
    setCapturePreviewUrl("");
    setCapturedDocument(null);
    setDocumentName(file.name);
    setDocumentState("scanning");
    setDocumentError("");
    setDocumentAnalysis(null);
    setDocumentUpload(null);
    if (file.size > 1_500_000) {
      setDocumentState("empty");
      setDocumentName("");
      setDocumentError("Choose a document smaller than 1.5 MB.");
      return;
    }
    try {
      const dataUrl = await readBlobAsDataUrl(file);
      let analysis = await analyzeMedicalDocument(file);
      if (file.type.startsWith("image/")) {
        const externalResponse = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, consent: true }),
        }).catch(() => null);
        if (externalResponse?.ok) {
          const external = (await readJsonResponse(externalResponse)) as {
            extraction?: {
              documentType?: string;
              patientName?: string;
              recordDate?: string;
              issuingFacility?: string;
              medicines?: Array<{ name?: string; strength?: string; frequency?: string; duration?: string; sourceText?: string }>;
              laboratoryResults?: Array<{ test?: string; value?: string; unit?: string; referenceRange?: string; printedAbnormalFlag?: string; sourceText?: string }>;
              diagnoses?: string[];
              procedures?: string[];
              warnings?: string[];
              overallConfidence?: "low" | "moderate" | "high";
            };
          };
          const extracted = external.extraction;
          if (extracted) {
            const findings: ClinicalFinding[] = [
              ...(extracted.medicines ?? []).map((item) => ({
                kind: "medicine" as const,
                label: item.name || "Medicine",
                value: [item.strength, item.frequency, item.duration].filter(Boolean).join(" · ") || "Details not clear",
                status: "review" as const,
                source: item.sourceText || "Visible document text",
              })),
              ...(extracted.laboratoryResults ?? []).map((item) => ({
                kind: "laboratory" as const,
                label: item.test || "Lab result",
                value: `${item.value || ""} ${item.unit || ""}${item.referenceRange ? ` (range ${item.referenceRange})` : ""}`.trim(),
                status: item.referenceRange && /high|low|abnormal|critical/i.test(item.printedAbnormalFlag || "") ? "possible-abnormal" as const : "review" as const,
                source: item.sourceText || "Visible document text",
              })),
              ...(extracted.diagnoses ?? []).map((value) => ({ kind: "diagnosis" as const, label: "Documented diagnosis", value, status: "review" as const, source: value })),
              ...(extracted.recordDate ? [{ kind: "date" as const, label: "Record date", value: extracted.recordDate, status: "review" as const, source: extracted.recordDate }] : []),
            ];
            analysis = {
              ...analysis,
              type: extracted.documentType || analysis.type,
              confidence: extracted.overallConfidence || analysis.confidence,
              findings: [...findings, ...analysis.findings].slice(0, 30),
              feedback: [
                ...analysis.feedback,
                `External image extraction completed${extracted.issuingFacility ? ` · issuing facility: ${extracted.issuingFacility}` : ""}.`,
                ...(extracted.warnings ?? []).map((warning) => `Extraction warning: ${warning}`),
              ],
              evidence: createDocumentEvidence({
                documentType: extracted.documentType || analysis.type,
                summary: analysis.summary,
                confidence: extracted.overallConfidence || analysis.confidence,
                findings: [...findings, ...analysis.findings].slice(0, 30),
                recordDate: extracted.recordDate,
                issuingFacility: extracted.issuingFacility,
                warnings: extracted.warnings,
                external: true,
              }),
            };
          }
        }
      }
      setDocumentAnalysis(analysis);
      setDocumentUpload({
        dataUrl,
        fileName: file.name,
        contentType:
          file.type ||
          (file.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "text/plain"),
        sizeBytes: file.size,
      });
      setDocumentState("ready");
    } catch {
      setDocumentState("empty");
      setDocumentError(
        "This document could not be checked. Try a clearer image, PDF or text file.",
      );
    }
  }

  function previewCapturedDocument(file?: File) {
    if (!file) return;
    setDocumentError("");
    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      setDocumentError("Capture a JPG, JPEG or PNG image smaller than 1.5 MB.");
      return;
    }
    if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
    setCapturedDocument(file);
    setCapturePreviewUrl(URL.createObjectURL(file));
    setDocumentName(file.name || `camera-report-${Date.now()}.jpg`);
    setDocumentState("preview");
    setDocumentAnalysis(null);
    setDocumentUpload(null);
    recordSessionAction("camera-captured-document");
  }

  async function submitIntake() {
    if (!profileValid()) {
      setSubmitError("Complete every patient detail, referral and consent field.");
      setPhase("identify");
      return;
    }
    if (!everyClinicalQuestionAnswered()) {
      const firstMissing = activeQuestions.findIndex((question) => !(responses[question.id] ?? []).length);
      setQuestionIndex(Math.max(0, firstMissing));
      setSubmitError("Answer every required clinical question before submitting.");
      setPhase("history");
      return;
    }
    if (!(identity || (await uploadIdentityIfNeeded()))) {
      setSubmitError("Upload a government-issued ID before submitting.");
      setPhase("documents");
      return;
    }
    if (!patientConfirmed) {
      setSubmitError("Confirm that the final summary reflects what you reported before sending it to the doctor.");
      setPhase("summary");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const abhaResponse = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abhaNumber: profile.abhaNumber,
          abhaAddress: profile.abhaAddress,
          consentGranted: abhaConsented,
        }),
      });
      const abhaData = (await readJsonResponse(abhaResponse)) as { error?: string };
      if (!abhaResponse.ok)
        throw new Error(abhaData.error || "ABHA could not be linked to this intake.");
      const response = await fetch("/api/intakes", {
        method: editingIntakeId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingIntakeId ? { id: editingIntakeId } : {}),
          ...profile,
          age: Number(profile.age),
          language,
          complaint: patientSummary.complaint,
          onset: patientSummary.onset,
          symptoms: patientSummary.symptoms,
          conditions: patientSummary.conditions,
          allergies: patientSummary.allergies,
          narrative: Object.values(notes).filter(Boolean).join(" | "),
          documentName,
          documentType: documentAnalysis?.type ?? "",
          documentFeedback: documentAnalysis
            ? serializeDocumentFeedback(documentAnalysis.evidence, [
                documentAnalysis.summary,
                ...documentAnalysis.feedback,
                ...documentAnalysis.findings.map(
                  (finding) =>
                    `[${finding.status}] ${finding.label}: ${finding.value} | source: ${finding.source}`,
                ),
              ])
            : "",
          documentNotes,
          documentFile: documentUpload,
          redFlag,
          consentedAt: new Date().toISOString(),
          answers: responses,
          notes,
        }),
      });
      const data = (await readJsonResponse(response)) as { id?: number; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error || "Submission failed.");
      setSubmittedId(data.id);
      setEditingIntakeId(null);
      setPhase("submitted");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Submission failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const loadIntakes = useCallback(async () => {
    setDoctorLoading(true);
    setDoctorError("");
    try {
      const response = await fetch("/api/intakes", { cache: "no-store" });
      const data = (await readJsonResponse(response)) as {
        intakes?: IntakeRecord[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Unable to load patient records.");
      const records = data.intakes ?? [];
      setIntakes(records);
      setSelectedIntakeId((currentId) => {
        const nextId =
          currentId && records.some((item) => item.id === currentId)
            ? currentId
            : (records[0]?.id ?? null);
        setDoctorNote(
          records.find((item) => item.id === nextId)?.doctor_note ?? "",
        );
        return nextId;
      });
    } catch (error) {
      setDoctorError(
        error instanceof Error
          ? error.message
          : "Unable to load patient records.",
      );
    } finally {
      setDoctorLoading(false);
    }
  }, []);

  const loadWorkflowEvidence = useCallback(async (intakeId: number) => {
    setWorkflowLoading(true);
    try {
      const response = await fetch(`/api/clinical-workflow?intakeId=${intakeId}`, { cache: "no-store" });
      const data = (await readJsonResponse(response)) as WorkflowEvidence & { error?: string };
      if (!response.ok || !data.workflow) throw new Error(data.error || "Unable to load clinical workflow.");
      setWorkflowEvidence(data);
      setPhysicianSummary(data.workflow.physicianSummary);
      setDoctorNote(data.workflow.reviewNote || "");
    } catch (error) {
      setWorkflowEvidence(null);
      setDoctorError(error instanceof Error ? error.message : "Unable to load clinical workflow.");
    } finally {
      setWorkflowLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser?.role !== "doctor") return;
    const timer = window.setTimeout(() => void loadIntakes(), 0);
    return () => window.clearTimeout(timer);
  }, [authUser, loadIntakes]);

  useEffect(() => {
    if (authUser?.role !== "patient" || (portalView !== "cases" && portalView !== "intake")) return;
    const timer = window.setTimeout(() => void loadIntakes(), 0);
    return () => window.clearTimeout(timer);
  }, [authUser?.role, portalView, loadIntakes]);

  useEffect(() => {
    if (!authUser || !selectedIntake?.id ||
        (authUser.role === "doctor" ? portalView !== "ehr" : portalView !== "cases")) return;
    const intakeId = selectedIntake.id;
    const timer = window.setTimeout(() => void loadWorkflowEvidence(intakeId), 0);
    return () => window.clearTimeout(timer);
  }, [authUser, portalView, selectedIntake?.id, loadWorkflowEvidence]);

  async function submitPhysicianDecision(decision: "confirmed" | "needs-clarification" | "rejected") {
    if (!selectedIntake || !physicianSummary.trim()) return;
    setDoctorError("");
    setDoctorMessage("");
    const response = await fetch("/api/clinical-workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intakeId: selectedIntake.id,
        decision,
        physicianSummary,
        reviewNote: doctorNote,
      }),
    });
    const data = (await readJsonResponse(response)) as {
      error?: string;
      emailDelivery?: { status: string; reason?: string } | null;
    };
    if (!response.ok) {
      setDoctorError(data.error || "The physician decision could not be saved.");
      return;
    }
    if (decision === "confirmed") {
      setDoctorMessage(
        data.emailDelivery?.status === "sent"
          ? "Clinical record confirmed. The professional PDF report was emailed to the patient."
          : `Clinical record confirmed. ${data.emailDelivery?.reason || "No new report email was required."}`,
      );
    } else if (decision === "needs-clarification") {
      setDoctorMessage("Clarification request sent to the patient.");
    } else {
      setDoctorMessage("Generated record rejected and saved for audit.");
    }
    await Promise.all([loadIntakes(), loadWorkflowEvidence(selectedIntake.id)]);
  }

  async function performPatientWorkflow(action: "answer-clarification" | "revoke-consent" | "restore-consent", options?: { clarificationId?: number; answer?: string }) {
    if (!selectedIntake) return;
    setDoctorError("");
    const response = await fetch("/api/clinical-workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeId: selectedIntake.id, action, ...options }),
    });
    const data = (await readJsonResponse(response)) as { error?: string };
    if (!response.ok) {
      setDoctorError(data.error || "The clinical case could not be updated.");
      return;
    }
    await Promise.all([loadIntakes(), loadWorkflowEvidence(selectedIntake.id)]);
  }

  async function deleteIntake(id: number) {
    if (!window.confirm("Delete this clinical intake permanently?")) return;
    setSubmitError("");
    const response = await fetch(`/api/intakes?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await readJsonResponse(response)) as { error?: string };
      setSubmitError(data.error || "The intake could not be deleted.");
      return;
    }
    await loadIntakes();
    if (authUser?.role !== "doctor") setSelectedIntakeId(null);
  }

  function beginEditPatientIntake(record: IntakeRecord, evidence: WorkflowEvidence | null) {
    const fallbackDoctor = doctors.find((doctor) => doctor.department === record.department) ?? doctors[0];
    const assignedDoctor = doctors.find((doctor) => doctor.id === record.doctor_id) ?? fallbackDoctor;
    const structured = evidence?.workflow.structuredRecord as {
      history?: { questionnaireAnswers?: Record<string, string[]>; answerNotes?: Record<string, string> };
    } | undefined;
    setProfile({
      fullName: record.full_name,
      age: String(record.age),
      sex: record.sex,
      address: record.address,
      phone: record.phone,
      abhaNumber: record.abha_number?.replace(/\D/g, "") ?? "",
      abhaAddress: record.abha_address ?? "",
      department: assignedDoctor?.department ?? record.department,
      doctorId: assignedDoctor?.id ?? "",
      doctorName: assignedDoctor?.name ?? "",
    });
    setResponses(structured?.history?.questionnaireAnswers ?? {});
    setNotes(structured?.history?.answerNotes ?? {});
    setConsented(true);
    setAbhaConsented(Boolean(record.abha_number));
    setDocumentName(record.document_name ?? "");
    setDocumentState(record.document_name ? "ready" : "empty");
    const parsedDocument = parseDocumentEvidence(record.document_feedback ?? "");
    setDocumentAnalysis(parsedDocument.evidence ? {
      type: parsedDocument.evidence.documentType || record.document_type || "Medical record",
      confidence: parsedDocument.evidence.recordDate?.confidence ?? "moderate",
      summary: parsedDocument.evidence.summary,
      feedback: parsedDocument.displayLines,
      findings: parsedDocument.evidence.findings,
      evidence: parsedDocument.evidence,
    } : null);
    setDocumentNotes(record.document_notes ?? "");
    setDocumentUpload(null);
    setEditingIntakeId(record.id);
    setPatientConfirmed(false);
    setSubmittedId(null);
    setSubmitError("");
    setPhase("identify");
    setPortalView("intake");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout(nextRole: AppRole = authUser?.role ?? "patient") {
    setPreferredLoginRole(nextRole);
    setAccountMenuOpen(false);
    setAuthUser(null);
    setPortalView("home");
    setIdentity(null);
    resetIntake();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // The local portal closes immediately even if network cleanup is delayed.
    }
  }

  async function openProfile() {
    setAccountMenuOpen(false);
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const data = (await readJsonResponse(response)) as {
        profile?: PortalProfile;
        error?: string;
      };
      if (!response.ok || !data.profile)
        throw new Error(data.error || "Unable to load your profile.");
      setPortalProfile(data.profile);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to load your profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  function resetIntake() {
    setProfile(blankProfile);
    setConsented(false);
    setAbhaConsented(false);
    setQuestionIndex(0);
    setResponses({});
    setNotes({});
    setDocumentState("empty");
    setDocumentName("");
    setDocumentAnalysis(null);
    setDocumentUpload(null);
    setDocumentNotes("");
    setDocumentError("");
    if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
    setCapturePreviewUrl("");
    setCapturedDocument(null);
    setIdentityFile(null);
    setIdentityError("");
    setSubmittedId(null);
    setEditingIntakeId(null);
    setPatientConfirmed(false);
    setSubmitError("");
    setPhase("identify");
  }

  function navigateToBooking(doctorId: string) {
    setPreferredDoctorId(doctorId);
    setPortalView("appointments");
  }

  function renderPortalModule() {
    if (!authUser) return null;
    if (portalView === "home")
      return <PortalOverview role={authUser.role} onNavigate={setPortalView} language={language} />;
    if (portalView === "directory" && authUser.role === "patient")
      return <DoctorDirectory onBook={navigateToBooking} />;
    if (portalView === "abha" && authUser.role === "patient")
      return <AbhaProfile />;
    if (portalView === "cases" && authUser.role === "patient")
      return (
        <PatientCases
          intakes={intakes}
          selected={selectedIntake}
          selectedId={selectedIntakeId}
          loading={doctorLoading || workflowLoading}
          error={doctorError}
          evidence={workflowEvidence}
          onSelect={setSelectedIntakeId}
          onRefresh={loadIntakes}
          onAnswer={(clarificationId, answer) =>
            void performPatientWorkflow("answer-clarification", { clarificationId, answer })
          }
          onConsent={(action) => void performPatientWorkflow(action)}
          onEdit={(record) => beginEditPatientIntake(record, workflowEvidence)}
          onDelete={(id) => void deleteIntake(id)}
        />
      );
    if (portalView === "directory")
      return <PortalOverview role={authUser.role} onNavigate={setPortalView} language={language} />;
    if (portalView === "voice") return <VoiceCare role={authUser.role} language={language} onContextAction={recordSessionAction} />;
    if (portalView === "emergency")
      return <EmergencyBeds role={authUser.role} />;
    if (portalView === "blood") return <BloodBank role={authUser.role} />;
    if (portalView === "appointments")
      return (
        <Appointments
          role={authUser.role}
          preferredDoctorId={preferredDoctorId}
        />
      );
    return null;
  }

  if (authLoading)
    return (
      <main className="auth-loading">
        <div className="brand-mark">
          <AyurDocLogo size={36} />
        </div>
        <LoaderCircle className="spin" size={24} />
      </main>
    );
  if (!authUser)
    return (
      <LoginScreen
        initialRole={preferredLoginRole}
        language={language}
        onLanguageChange={setLanguage}
        onLogin={(user) => {
          setAuthUser(user);
          setPortalView("home");
        }}
      />
    );

  return (
    <main className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-lockup brand-home-button" onClick={() => setPortalView("home")} aria-label="Go to portal home">
          <div className="brand-mark">
            <AyurDocLogo size={36} />
          </div>
          <div>
            <div className="brand-name">AyurDoc</div>
          </div>
        </button>
        <div className="topbar-actions">
          <Select
            value={language}
            onValueChange={(value) => setLanguage(value as Language)}
          >
            <SelectTrigger
              className="language-select"
              aria-label="Choose language"
            >
              <Languages size={15} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="portal-language-en" value="English">English</SelectItem>
              <SelectItem key="portal-language-hi" value="हिन्दी">हिन्दी</SelectItem>
              <SelectItem key="portal-language-ta" value="தமிழ்">தமிழ்</SelectItem>
            </SelectContent>
          </Select>
          <div className="account-menu-wrap">
            <button
              type="button"
              className="account-chip"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <div>
                {authUser.role === "doctor" ? (
                  <Stethoscope size={15} />
                ) : (
                  <UserRound size={15} />
                )}
              </div>
              <span>
                <strong>
                  {authUser.role === "doctor"
                    ? signedInDoctor?.name ?? "Doctor portal"
                    : "Patient portal"}
                </strong>
                <span data-no-translate>
                  @{authUser.username}
                  {authUser.role === "doctor" && signedInDoctor
                    ? ` · ID ${signedInDoctor.id}`
                    : ""}
                </span>
              </span>
              <ChevronDown size={15} />
            </button>
            {accountMenuOpen && (
              <div className="account-dropdown">
                <button type="button" onClick={() => void openProfile()}>
                  <IdCard size={15} /> View my profile
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void logout(
                      authUser.role === "patient" ? "doctor" : "patient",
                    )
                  }
                >
                  {authUser.role === "patient" ? (
                    <Stethoscope size={15} />
                  ) : (
                    <UserRound size={15} />
                  )}
                  Go to {authUser.role === "patient" ? "Doctor" : "Patient"}{" "}
                  Portal
                </button>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="signout-button"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <LogOut size={16} /> <span>Sign out</span>
          </Button>
        </div>
      </header>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="portal-profile-dialog">
          <DialogHeader>
            <div className="portal-profile-heading">
              <div>{authUser.role === "doctor" ? <Stethoscope /> : <UserRound />}</div>
              <span>
                <DialogTitle>{portalProfile?.name || "My profile"}</DialogTitle>
                <DialogDescription>@{authUser.username} · {authUser.role} portal</DialogDescription>
              </span>
            </div>
          </DialogHeader>
          {profileLoading ? (
            <div className="portal-profile-loading"><LoaderCircle className="spin" /> Loading verified profile…</div>
          ) : profileError ? (
            <div className="login-error"><AlertTriangle size={16} /> {profileError}</div>
          ) : portalProfile ? (
            <div className="portal-profile-grid">
              <ProfileDetail label="Full name" value={portalProfile.name} />
              <ProfileDetail label="Username" value={`@${portalProfile.username}`} />
              {portalProfile.role === "patient" ? (
                <>
                  <ProfileDetail label="ABHA number" value={portalProfile.abhaNumber} />
                  <ProfileDetail label="ABHA address" value={portalProfile.abhaAddress} />
                  <ProfileDetail label="ABHA status" value={portalProfile.abhaStatus} />
                  <ProfileDetail label="Government ID" value={portalProfile.governmentIdStatus} />
                  <ProfileDetail label="Phone number" value={portalProfile.phone} />
                  <ProfileDetail label="Email" value={portalProfile.email} />
                  <ProfileDetail label="Age" value={portalProfile.age} />
                  <ProfileDetail label="Sex" value={portalProfile.sex} />
                  <ProfileDetail label="Address" value={portalProfile.address} wide />
                </>
              ) : (
                <>
                  <ProfileDetail label="Doctor ID" value={portalProfile.doctorId} />
                  <ProfileDetail label="Credential status" value={portalProfile.credentialStatus} />
                  <ProfileDetail label="Department" value={portalProfile.department} wide />
                  <ProfileDetail label="Qualification" value={portalProfile.qualification} wide />
                  <ProfileDetail label="Council registration" value={portalProfile.councilRegistration} />
                  <ProfileDetail label="Phone number" value={portalProfile.phone} />
                  <ProfileDetail label="Email" value={portalProfile.email} wide />
                </>
              )}
            </div>
          ) : null}
          {portalProfile?.role === "patient" && (!portalProfile.address || !portalProfile.abhaNumber) && (
            <Button onClick={() => { setProfileOpen(false); setPortalView(portalProfile.abhaNumber ? "intake" : "abha"); }}>
              <Pencil size={15} /> Complete missing profile details
            </Button>
          )}
          {portalProfile && <BiometricEnrollment username={authUser.username} language={language} />}
        </DialogContent>
      </Dialog>

      <PortalNavigation
        role={authUser.role}
        active={portalView}
        onChange={(view) => {
          setPortalView(view);
          setAccountMenuOpen(false);
        }}
        language={language}
      />

      {authUser.role === "patient" && (
        <ContextAwareVoiceGuide
          username={authUser.username}
          context={sessionContext}
          summary={`${profile.fullName || "Patient"}. Main concern: ${patientSummary.complaint}. Onset: ${patientSummary.onset}. Reported history: ${patientSummary.symptoms}. Assigned Vaidya: ${profile.doctorName || "not selected"}.`}
          onContinue={continueFromVoiceGuide}
          onReports={openReportsFromVoiceGuide}
          onSummary={openSummaryFromVoiceGuide}
          onNavigate={(destination) => {
            setPortalView(destination);
            setAccountMenuOpen(false);
            recordSessionAction(`voice-navigated-to-${destination}`);
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
          onLanguageChange={setLanguage}
          onLogout={() => logout("patient")}
          onAction={recordSessionAction}
        />
      )}

      <div id="portal-content" className="portal-content-shell">
      {authUser.role === "patient" && portalView === "intake" ? (
        <div className="workspace">
          <aside className="step-rail" aria-label="Patient intake progress">
                  <div className="rail-label">Your Ayurvedic intake journey</div>
            <div className="rail-steps">
              {patientSteps.map((item, index) => {
                const Icon = item.icon;
                const active = index === phaseIndex;
                const complete = index < phaseIndex || phase === "submitted";
                return (
                  <button
                    type="button"
                    className={`rail-step ${active ? "active" : ""} ${complete ? "complete" : ""}`}
                    key={item.id}
                    onClick={() => navigateIntakeStep(item.id)}
                    aria-current={active ? "step" : undefined}
                  >
                    <div className="rail-icon">
                      {complete && !active ? (
                        <Check size={16} />
                      ) : (
                        <Icon size={17} />
                      )}
                    </div>
                    <div>
                      <span>0{index + 1}</span>
                      <strong>{item.label}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
          <section className="main-panel">
            {phase === "identify" && (
              <section className="content-stage profile-stage">
                <div className="stage-heading compact">
                  <StatusPill tone="teal">
                    <UserCheck size={13} /> Step 1 · Personal details
                  </StatusPill>
                  <h1>Tell us about yourself.</h1>
                  <p>
                    Enter your own information exactly as you would like it to
                    appear for the doctor. Nothing is pre-filled.
                  </p>
                </div>
                <div className="form-card profile-card">
                  <div className="form-card-head">
                    <div>
                      <span className="mini-label">
                        Required patient information
                      </span>
                      <h2>Patient profile</h2>
                    </div>
                    <StatusPill tone="slate">
                      <ShieldCheck size={13} /> Consent required
                    </StatusPill>
                  </div>
                  <div className="profile-form-grid">
                    <label className="wide-field">
                      <span>Full name *</span>
                      <Input
                        value={profile.fullName}
                        onChange={(e) =>
                          updateProfile("fullName", e.target.value)
                        }
                        placeholder="Enter full name"
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      <span>Age *</span>
                      <Input
                        value={profile.age}
                        onChange={(e) =>
                          updateProfile(
                            "age",
                            e.target.value.replace(/\D/g, "").slice(0, 3),
                          )
                        }
                        placeholder="Age"
                        inputMode="numeric"
                      />
                    </label>
                    <label>
                      <span>Sex *</span>
                      <Select
                        value={profile.sex}
                        onValueChange={(value) => updateProfile("sex", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Rather not to say">
                            Rather not to say
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="wide-field">
                      <span>
                        <MapPin size={13} /> Address *
                      </span>
                      <Textarea
                        value={profile.address}
                        onChange={(e) =>
                          updateProfile("address", e.target.value)
                        }
                        placeholder="House, street, village/town, district and state"
                      />
                    </label>
                    <label>
                      <span>
                        <Phone size={13} /> Mobile number *
                      </span>
                      <Input
                        value={profile.phone}
                        onChange={(e) =>
                          updateProfile(
                            "phone",
                            normalizePhone(e.target.value),
                          )
                        }
                        placeholder="10-digit number"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      <small>
                        {profile.phone && !isValidPhoneNumber(profile.phone)
                          ? phoneValidationMessage(profile.phone)
                          : "Used only for this hospital record"}
                      </small>
                    </label>
                    <label>
                      <span><IdCard size={13} /> ABHA number *</span>
                      <Input
                        value={profile.abhaNumber}
                        onChange={(event) => updateProfile("abhaNumber", event.target.value.replace(/\D/g, "").slice(0, 14))}
                        placeholder="14-digit ABHA number"
                        inputMode="numeric"
                      />
                      <small>{profile.abhaNumber && profile.abhaNumber.length !== 14 ? "Enter all 14 digits" : "Saved with this clinical record"}</small>
                    </label>
                    <label>
                      <span>ABHA address (optional)</span>
                      <Input
                        value={profile.abhaAddress}
                        onChange={(event) => updateProfile("abhaAddress", event.target.value.toLowerCase().slice(0, 100))}
                        placeholder="name@abdm"
                      />
                    </label>
                    <label className="consent-row wide-field abha-inline-consent">
                      <Checkbox checked={abhaConsented} onCheckedChange={(value) => setAbhaConsented(value === true)} />
                      <span><strong>I consent to link this ABHA.</strong> The Vaidya and authorized administrator may view its number and verification status for this case.</span>
                    </label>
                    <label className="wide-field">
                      <span>
                        <Building2 size={13} /> Visiting department *
                      </span>
                      <Select
                        value={profile.department}
                        onValueChange={(value) => {
                          const recommended = doctors.find(
                            (doctor) => doctor.department === value,
                          );
                          setProfile((current) => ({
                            ...current,
                            department: value,
                            doctorId: recommended?.id ?? "",
                            doctorName: recommended?.name ?? "",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose hospital department" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            new Set(doctors.map((doctor) => doctor.department)),
                          )
                            .sort()
                            .map((department) => (
                              <SelectItem value={department} key={department}>
                                {department}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <section className="doctor-referral-panel">
                    <div className="doctor-referral-heading">
                      <div>
                        <span className="mini-label">Required referral</span>
                        <h3>
                          <Stethoscope size={20} /> Choose referral doctor
                        </h3>
                      </div>
                      {profile.doctorName && (
                        <StatusPill tone="teal">
                          <Check size={13} /> Doctor selected
                        </StatusPill>
                      )}
                    </div>
                    {!profile.department ? (
                      <div className="doctor-referral-empty">
                        <Building2 size={22} />
                        Select a visiting department above to see the doctor’s
                        name, qualification and clinic hours.
                      </div>
                    ) : (
                      <div className="doctor-referral-options">
                        {doctors.filter(
                          (doctor) => doctor.department === profile.department,
                        ).map((doctor, index) => (
                          <button
                            type="button"
                            key={doctor.id}
                            className={
                              profile.doctorId === doctor.id ? "selected" : ""
                            }
                            onClick={() =>
                              setProfile((current) => ({
                                ...current,
                                doctorId: doctor.id,
                                doctorName: doctor.name,
                              }))
                            }
                          >
                            <span className="doctor-referral-avatar">
                              {doctor.initials}
                            </span>
                            <span className="doctor-referral-copy">
                              <small>
                                {index === 0
                                  ? "Recommended specialist"
                                  : doctor.department}
                              </small>
                              <strong>{doctor.name}</strong>
                              <em data-no-translate>Doctor ID · {doctor.id}</em>
                              <span>{doctor.degree}</span>
                              <span>{doctor.hours}</span>
                            </span>
                            <span className="doctor-referral-check">
                              {profile.doctorId === doctor.id ? (
                                <CheckCircle2 size={22} />
                              ) : (
                                "Select"
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                  <label className="consent-row">
                    <Checkbox
                      checked={consented}
                      onCheckedChange={(value) => setConsented(value === true)}
                    />
                    <span>
                      <strong>I give informed consent for this visit.</strong>{" "}
                      My information may be securely stored and shown to the
                      hospital care team for clinical review. I can stop before
                      submission.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        speak(
                          "I give consent for my information to be shown to the hospital care team for this visit.",
                        )
                      }
                      aria-label="Hear consent"
                    >
                      <Volume2 size={17} />
                    </Button>
                  </label>
                  <div className="form-actions">
                    <Button
                      size="lg"
                      disabled={!profileValid()}
                      onClick={() => setPhase("history")}
                    >
                      Continue to Ayurvedic history <ArrowRight size={17} />
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {phase === "history" && (
              <section className="content-stage history-stage">
                <div className="history-topline">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      questionIndex
                        ? setQuestionIndex((value) => value - 1)
                        : setPhase("identify")
                    }
                  >
                    <ArrowLeft size={16} /> Back
                  </Button>
                  <div>
                    <span>
                      Question {questionIndex + 1} of {activeQuestions.length}
                    </span>
                    <Progress
                      value={((questionIndex + 1) / activeQuestions.length) * 100}
                    />
                  </div>
                </div>
                {redFlag && (
                  <div className="red-flag-banner" role="alert">
                    <div className="alert-icon">
                      <AlertTriangle size={21} />
                    </div>
                    <div>
                      <strong>Priority triage signal detected</strong>
                      <span>
                        Your answers indicate symptoms that need prompt staff
                        review. This is not a diagnosis.
                      </span>
                    </div>
                    <StatusPill tone="red">Alert prepared</StatusPill>
                  </div>
                )}
                <div className="question-card">
                  <div className="question-copy">
                    <div className="question-eyebrow">
                      <Activity size={15} /> {activeQuestion.eyebrow}
                    </div>
                    <h1>{activeQuestion.prompt[language]}</h1>
                    {language !== "English" && (
                      <p className="english-translation">
                        {activeQuestion.prompt.English}
                      </p>
                    )}
                    <p>{activeQuestion.hint}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="speak-button"
                    onClick={() => speak(activeQuestion.prompt[language])}
                  >
                    <Volume2 size={20} />
                  </Button>
                </div>
                <div className="vaidya-exam-note">
                  <Stethoscope size={18} />
                  <span>
                    Nadi, Jihva and other Darshana–Sparshana examinations are
                    completed by the Vaidya; patients should not self-assess them.
                  </span>
                </div>
                <Textarea
                  className="narrative-input"
                  value={notes[activeQuestion.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [activeQuestion.id]: event.target.value,
                    }))
                  }
                  placeholder="Add any useful details here…"
                />
                <div className="choice-block">
                  <div className="choice-label">
                    <span>Choose the closest option *</span>
                    {activeQuestion.multiple && (
                      <small>Select all that apply</small>
                    )}
                  </div>
                  <div className="choice-grid">
                    {activeQuestion.choices.map((choice) => (
                      <button
                        key={choice.value}
                        className={`choice-button ${selectedChoices.includes(choice.value) ? "selected" : ""}`}
                        onClick={() => choose(choice.value)}
                      >
                        <span className="choice-check">
                          {selectedChoices.includes(choice.value) && (
                            <Check size={15} />
                          )}
                        </span>
                        <span>
                          {language === "English"
                            ? choice.value
                            : language === "தமிழ்"
                              ? choice.tamil
                              : choice.hindi || choiceTranslations[language][choice.value] ||
                                choice.value}
                          {language !== "English" && (
                            <small>{choice.value}</small>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="stage-footer">
                  <span>
                    Every answer remains linked to the patient source for doctor
                    verification.
                  </span>
                  <Button
                    size="lg"
                    disabled={!selectedChoices.length}
                    onClick={nextQuestion}
                  >
                    {questionIndex === activeQuestions.length - 1
                      ? "Continue to records"
                      : "Next question"}{" "}
                    <ChevronRight size={17} />
                  </Button>
                </div>
              </section>
            )}

            {phase === "documents" && (
              <section className="content-stage documents-stage">
                <div className="stage-heading compact">
                  <StatusPill tone="teal">
                    <ScanLine size={13} /> Optional document step
                  </StatusPill>
                  <h1>Add your previous medical record.</h1>
                  <p>
                    Select a prescription, lab report, scan or discharge
                    summary. AyurDoc checks its type and readability, then
                    prepares safe review points for the doctor.
                  </p>
                </div>
                <div className="document-layout">
                  <div className={`upload-card state-${documentState}`}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.txt,.csv,text/plain,text/csv"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void processDocument(file);
                      }}
                    />
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      hidden
                      onChange={(event) => previewCapturedDocument(event.target.files?.[0])}
                    />
                    {documentState === "empty" && (
                      <>
                        <div className="upload-icon">
                          <Upload size={25} />
                        </div>
                        <h2>Select a medical document</h2>
                        <p>Photo, PDF or text record · up to 1.5 MB · optional</p>
                        <div className="document-source-actions">
                          <Button onClick={() => fileRef.current?.click()}>
                            <Upload size={17} /> Choose file
                          </Button>
                          <Button variant="outline" onClick={() => cameraRef.current?.click()}>
                            <Camera size={18} /> Photograph report
                          </Button>
                        </div>
                      </>
                    )}
                    {documentState === "preview" && capturedDocument && (
                      <>
                        <div className="camera-document-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={capturePreviewUrl} alt="Captured medical document preview" />
                          <span><Camera size={16} /> Check that all four corners and text are visible</span>
                        </div>
                        <h2>Confirm this photograph</h2>
                        <p>The original image will be preserved with the extracted summary.</p>
                        <div className="document-source-actions">
                          <Button variant="outline" onClick={() => cameraRef.current?.click()}><RefreshCw size={17} /> Retake</Button>
                          <Button onClick={() => void processDocument(capturedDocument)}><ScanLine size={17} /> Confirm & process</Button>
                        </div>
                      </>
                    )}
                    {documentState === "scanning" && (
                      <>
                        <div className="scan-animation">
                          <ScanLine size={38} />
                        </div>
                        <h2>Preparing {documentName}</h2>
                        <p>
                          Checking file and preparing it for clinical review…
                        </p>
                        <Progress value={68} />
                      </>
                    )}
                    {documentState === "ready" && (
                      <>
                        {documentUpload?.contentType.startsWith("image/") && (
                          <div className="camera-document-preview processed">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={documentUpload.dataUrl} alt={`Original report ${documentName}`} />
                            <span><FileCheck2 size={16} /> Original preserved</span>
                          </div>
                        )}
                        {documentUpload?.contentType === "application/pdf" && (
                          <div className="camera-document-preview processed">
                            <object data={documentUpload.dataUrl} type="application/pdf" aria-label={`Original report ${documentName}`}>
                              <span>PDF preview is unavailable in this browser. The original is still preserved.</span>
                            </object>
                            <span><FileCheck2 size={16} /> Original PDF preserved</span>
                          </div>
                        )}
                        <div className="upload-icon success">
                          <FileCheck2 size={25} />
                        </div>
                        <h2>Document attached</h2>
                        <p>{documentName}</p>
                        {documentAnalysis && (
                          <strong>{documentAnalysis.type}</strong>
                        )}
                        <StatusPill tone="teal">
                          <CheckCircle2 size={13} /> Ready for doctor
                        </StatusPill>
                        <button
                          className="text-action"
                          onClick={() => {
                            setDocumentState("empty");
                            setDocumentName("");
                            setDocumentAnalysis(null);
                            setDocumentUpload(null);
                            setDocumentNotes("");
                            setCapturedDocument(null);
                            if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
                            setCapturePreviewUrl("");
                          }}
                        >
                          Remove or replace
                        </button>
                      </>
                    )}
                  </div>
                  <div className="extraction-card">
                    <div className="extraction-head">
                      <div>
                        <span className="mini-label">
                          Patient-controlled record
                        </span>
                        <h2>
                          {documentAnalysis
                            ? "Document feedback"
                            : "What happens next?"}
                        </h2>
                      </div>
                      <StatusPill tone="slate">Human verification</StatusPill>
                    </div>
                    {documentAnalysis ? (
                      <div className="document-feedback">
                        <div className="document-feedback-summary">
                          <FileSearch size={21} />
                          <span>
                            <strong>{documentAnalysis.type}</strong>
                            {documentAnalysis.summary}
                          </span>
                        </div>
                        <div className="document-evidence-meta">
                          <div><span>Record date</span><strong>{documentAnalysis.evidence.recordDate?.value || "Date uncertain"}</strong><small>{documentAnalysis.evidence.recordDate ? `${documentAnalysis.evidence.recordDate.confidence} confidence · source preserved` : "Not confidently found in the source"}</small></div>
                          <div><span>Hospital / doctor</span><strong>{documentAnalysis.evidence.issuingFacility?.value || "Not confidently extracted"}</strong><small>{documentAnalysis.evidence.extractionMethod === "external-ai" ? "AI extracted · requires verification" : "Rule extracted · requires verification"}</small></div>
                        </div>
                        <ul>
                          {documentAnalysis.feedback.map((item) => (
                            <li key={item}>
                              <CheckCircle2 size={15} /> {item}
                            </li>
                          ))}
                        </ul>
                        {documentAnalysis.findings.length > 0 && (
                          <div className="document-findings" aria-label="Extracted document review items">
                            <div className="document-findings-head">
                              <strong>Source-linked extraction</strong>
                              <StatusPill tone={documentAnalysis.confidence === "high" ? "teal" : "amber"}>
                                {documentAnalysis.confidence} confidence
                              </StatusPill>
                            </div>
                            {documentAnalysis.findings.slice(0, 12).map((finding, index) => (
                              <article key={`${finding.kind}-${finding.label}-${index}`} className={finding.status === "possible-abnormal" ? "possible-abnormal" : ""}>
                                <div>
                                  <span>{finding.kind}</span>
                                  <strong>{finding.label}: {finding.value}</strong>
                                </div>
                                <small>Source: “{finding.source}” · {finding.status === "possible-abnormal" ? "Value is outside the reference range reported in the document." : "Doctor confirmation required"}</small>
                              </article>
                            ))}
                          </div>
                        )}
                        <label>
                          <span>
                            Anything important the doctor should notice?
                          </span>
                          <Textarea
                            value={documentNotes}
                            onChange={(event) =>
                              setDocumentNotes(event.target.value)
                            }
                            placeholder="Example: This report was issued after my surgery in June."
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="document-promise">
                        <div>
                          <FileText />
                          <span>
                            <strong>1. File checked</strong>Type, size and
                            readability are assessed.
                          </span>
                        </div>
                        <div>
                          <ScanLine />
                          <span>
                            <strong>2. Review points prepared</strong>Likely
                            prescription, lab, discharge or imaging sections are
                            identified.
                          </span>
                        </div>
                        <div>
                          <Stethoscope />
                          <span>
                            <strong>3. Doctor confirms</strong>No result becomes
                            a clinical fact automatically.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <MedicalTimeline
                  records={intakes}
                  title="Your previous medical timeline"
                />
                <section className="identity-intake-card">
                  <div className="identity-intake-head">
                    <div>
                      <span className="mini-label">Required identity verification</span>
                      <h2><ShieldCheck size={20} /> Government-issued ID</h2>
                      <p>The administrator reviews the verification status. Your doctor sees the status, not the ID image.</p>
                    </div>
                    {identity && (
                      <StatusPill tone={identity.review_status === "verified" ? "teal" : "amber"}>
                        <FileCheck2 size={13} /> {identity.review_status}
                      </StatusPill>
                    )}
                  </div>
                  <div className="identity-intake-fields">
                    <label>
                      <span>Government ID type *</span>
                      <Select value={identityType} onValueChange={setIdentityType}>
                        <SelectTrigger><SelectValue placeholder="Choose ID type" /></SelectTrigger>
                        <SelectContent>
                          {["Aadhaar", "PAN", "Voter ID", "Passport", "Driving licence", "Other government ID"].map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <div>
                      <span>Government ID file *</span>
                      <input
                        ref={identityFileRef}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(event) => {
                          setIdentityFile(event.target.files?.[0] ?? null);
                          setIdentityError("");
                        }}
                      />
                      <Button type="button" variant="outline" onClick={() => identityFileRef.current?.click()}>
                        <Upload size={16} /> {identityFile ? "Replace selected ID" : identity ? "Replace ID" : "Choose ID file"}
                      </Button>
                    </div>
                  </div>
                  <div className="identity-file-status">
                    {identityFile ? (
                      <><FileCheck2 size={17} /><span><strong>{identityFile.name}</strong>Ready to upload when you continue.</span></>
                    ) : identity ? (
                      <><ShieldCheck size={17} /><span><strong>{identity.file_name}</strong>{identity.id_type} · status: {identity.review_status}</span></>
                    ) : (
                      <><AlertTriangle size={17} /><span>No government ID has been attached to this intake account.</span></>
                    )}
                  </div>
                  {identityError && <div className="inline-message"><AlertTriangle size={15} /> {identityError}</div>}
                </section>
                {documentError && (
                  <div className="inline-message">
                    <AlertTriangle size={15} /> {documentError}
                  </div>
                )}
                <div className="stage-footer">
                  <Button variant="ghost" onClick={() => setPhase("history")}>
                    <ArrowLeft size={16} /> Back to history
                  </Button>
                  <Button size="lg" disabled={identityLoading} onClick={() => void continueToSummary()}>
                    {identityLoading ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
                    Review my information
                  </Button>
                </div>
              </section>
            )}

            {phase === "summary" && (
              <section className="content-stage summary-stage">
                <div className="summary-header">
                  <div>
                    <StatusPill tone="teal">
                      <ClipboardCheck size={13} /> Final patient review
                    </StatusPill>
                    <h1>Check before submitting.</h1>
                    <p>The doctor will see only the information shown below.</p>
                  </div>
                  <div className="time-saved">
                    <strong>100%</strong>
                    <span>entered by the patient</span>
                  </div>
                </div>
                {redFlag && (
                  <div className="red-flag-banner" role="alert">
                    <div className="alert-icon">
                      <AlertTriangle size={21} />
                    </div>
                    <div>
                      <strong>Priority review requested</strong>
                      <span>
                        Chest pain with an associated safety symptom was
                        reported.
                      </span>
                    </div>
                    <StatusPill tone="red">High priority</StatusPill>
                  </div>
                )}
                <div className="summary-grid">
                  <article className="clinical-summary">
                    <div className="summary-card-title">
                      <div>
                        <span className="mini-label">
                          Patient-entered information
                        </span>
                        <h2>{profile.fullName}</h2>
                      </div>
                      <StatusPill tone="slate">
                        {profile.age} yrs · {profile.sex}
                      </StatusPill>
                    </div>
                    <div className="summary-row">
                      <div>
                        <span>Contact</span>
                        <strong>{profile.phone}</strong>
                      </div>
                      <div>
                        <span>Department</span>
                        <strong>{profile.department}</strong>
                      </div>
                    </div>
                    <div className="summary-section">
                      <span>Referred doctor</span>
                      <strong>{profile.doctorName}</strong>
                    </div>
                    <div className="summary-section">
                      <span>Address</span>
                      <strong>{profile.address}</strong>
                    </div>
                    <div className="summary-section featured">
                      <span>Chief complaint</span>
                      <strong>{patientSummary.complaint}</strong>
                      <p>
                        {notes.complaint || "No additional narration provided."}
                      </p>
                    </div>
                    <div className="summary-row">
                      <div>
                        <span>Onset</span>
                        <strong>{patientSummary.onset}</strong>
                      </div>
                      <div>
                        <span>Safety symptoms</span>
                        <strong>{patientSummary.symptoms}</strong>
                      </div>
                    </div>
                    <div className="summary-row">
                      <div>
                        <span>Past conditions</span>
                        <strong>{patientSummary.conditions}</strong>
                      </div>
                      <div>
                        <span>Allergies</span>
                        <strong>{patientSummary.allergies}</strong>
                      </div>
                    </div>
                    {documentName && (
                      <div className="summary-section">
                        <span>Attached record</span>
                        <strong>{documentName}</strong>
                        <p>{documentAnalysis?.summary}</p>
                      </div>
                    )}
                    {identity && (
                      <div className="summary-section">
                        <span>Government ID verification</span>
                        <strong>{identity.id_type} · {identity.review_status}</strong>
                        <p>The ID image remains restricted to authorized administration.</p>
                      </div>
                    )}
                  </article>
                  <aside className="route-card">
                    <div className="route-icon">
                      <MonitorCheck size={25} />
                    </div>
                    <h2>Send to doctor</h2>
                    <p>
                      Your record will appear in the secure {profile.department}{" "}
                      queue for {profile.doctorName}.
                    </p>
                    <div className="route-list">
                      <div>
                        <Check size={15} /> Consent recorded
                      </div>
                      <div>
                        <Check size={15} /> Personal details complete
                      </div>
                      <div>
                        <Check size={15} /> History structured
                      </div>
                      <div>
                        <Check size={15} /> Safety rules checked
                      </div>
                      <div>
                        <Check size={15} /> Government ID attached
                      </div>
                    </div>
                    <label className="patient-confirmation-control">
                      <Checkbox
                        checked={patientConfirmed}
                        onCheckedChange={(value) => {
                          setPatientConfirmed(value === true);
                          setSubmitError("");
                          recordSessionAction(value === true ? "patient-confirmed-summary" : "patient-unconfirmed-summary");
                        }}
                      />
                      <span>
                        <strong>I confirm this summary reflects what I reported.</strong>
                        <small>The doctor will review it before treating it as verified clinical information.</small>
                      </span>
                    </label>
                    {submitError && (
                      <div className="login-error">
                        <AlertTriangle size={14} /> {submitError}
                      </div>
                    )}
                    <Button
                      className="w-full"
                      disabled={submitting || !patientConfirmed}
                      onClick={submitIntake}
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle className="spin" size={16} />{" "}
                          Submitting…
                        </>
                      ) : (
                        <>
                          {editingIntakeId
                            ? "Update intake"
                            : "Submit securely"}{" "}
                          <ArrowRight size={16} />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setPhase("identify")}
                    >
                      <ArrowLeft size={15} /> Edit personal details
                    </Button>
                  </aside>
                </div>
              </section>
            )}

            {phase === "submitted" && (
              <section className="content-stage submitted-stage">
                <div className="success-orbit">
                  <CheckCircle2 size={42} />
                </div>
                <StatusPill tone="teal">Submission #{submittedId}</StatusPill>
                <h1>Your information is with the doctor.</h1>
                <p>
                  The clinical team can now open the exact details you entered.
                  Please remain near the waiting area and contact staff
                  immediately if your condition worsens.
                </p>
                <div className="submission-ticket">
                  <div>
                    <span>Patient</span>
                    <strong>{profile.fullName}</strong>
                  </div>
                  <div>
                    <span>Department</span>
                    <strong>{profile.department}</strong>
                  </div>
                  <div>
                    <span>Doctor</span>
                    <strong>{profile.doctorName}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong className={redFlag ? "danger-text" : ""}>
                      {redFlag ? "Urgent review" : "Routine review"}
                    </strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>Submitted</strong>
                  </div>
                </div>
                {submitError && (
                  <div className="login-error">
                    <AlertTriangle size={14} /> {submitError}
                  </div>
                )}
                <div className="submitted-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingIntakeId(submittedId);
                      setPhase("identify");
                    }}
                  >
                    <Pencil size={16} /> Update this intake
                  </Button>
                  <Button
                    variant="outline"
                    className="danger-action"
                    disabled={!submittedId}
                    onClick={() =>
                      submittedId && void deleteIntake(submittedId)
                    }
                  >
                    <Trash2 size={16} /> Delete intake
                  </Button>
                  <Button onClick={resetIntake}>
                    <RotateCcw size={16} /> Start a new intake
                  </Button>
                </div>
              </section>
            )}
          </section>
        </div>
      ) : authUser.role === "doctor" && portalView === "ehr" ? (
        <DoctorDashboard
          intakes={intakes}
          selected={selectedIntake}
          loading={doctorLoading}
          error={doctorError}
          message={doctorMessage}
          selectedId={selectedIntakeId}
          doctorNote={doctorNote}
          workflowEvidence={workflowEvidence}
          workflowLoading={workflowLoading}
          physicianSummary={physicianSummary}
          onSelect={(id) => {
            setSelectedIntakeId(id);
            setDoctorNote(
              intakes.find((item) => item.id === id)?.doctor_note ?? "",
            );
          }}
          onRefresh={loadIntakes}
          onNote={setDoctorNote}
          onSummary={setPhysicianSummary}
          onDecision={(decision) => void submitPhysicianDecision(decision)}
          onDelete={(id) => void deleteIntake(id)}
        />
      ) : (
        renderPortalModule()
      )}
      </div>
      <FloatingMedicalAssistant
        onNavigate={setPortalView}
        language={language}
        onLanguageChange={setLanguage}
        role={authUser.role}
      />
      <footer
        className={`app-footer ${authUser.role === "doctor" || portalView !== "intake" ? "doctor-footer" : ""}`}
      >
        <span>AyurDoc · © 2026 Med Zone</span>
      </footer>
    </main>
  );
}

function PatientCases({
  intakes,
  selected,
  selectedId,
  loading,
  error,
  evidence,
  onSelect,
  onRefresh,
  onAnswer,
  onConsent,
  onEdit,
  onDelete,
}: {
  intakes: IntakeRecord[];
  selected: IntakeRecord | null;
  selectedId: number | null;
  loading: boolean;
  error: string;
  evidence: WorkflowEvidence | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  onAnswer: (clarificationId: number, answer: string) => void;
  onConsent: (action: "revoke-consent" | "restore-consent") => void;
  onEdit: (record: IntakeRecord) => void;
  onDelete: (id: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const latestConsent = evidence?.consents[0];
  return (
    <section className="module-page patient-cases-page">
      <div className="module-heading cases-heading">
        <div>
          <span className="mini-label">Longitudinal patient record</span>
          <h1>My clinical cases</h1>
          <p>Follow each submission from patient draft to physician confirmation.</p>
        </div>
        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Refresh
        </Button>
      </div>
      {error && <div className="login-error"><AlertTriangle size={15} /> {error}</div>}
      {!loading && !intakes.length ? (
        <div className="doctor-empty">
          <ClipboardCheck size={30} />
          <h2>No clinical case submitted</h2>
          <p>Complete Ayurvedic Intake to create your first physician-reviewable case.</p>
        </div>
      ) : (
        <div className="patient-cases-layout">
          <aside className="case-list" aria-label="Submitted clinical cases">
            {intakes.map((item) => (
              <button key={item.id} className={selectedId === item.id || (!selectedId && selected?.id === item.id) ? "active" : ""} onClick={() => onSelect(item.id)}>
                <span>Case #{item.id}</span>
                <strong>{item.complaint}</strong>
                <small>{item.doctor_name} · {new Date(item.created_at).toLocaleDateString()}</small>
                <StatusPill tone={item.status === "verified" ? "teal" : item.status === "rejected" ? "red" : "amber"}>{item.status}</StatusPill>
              </button>
            ))}
          </aside>
          {selected && (
            <article className="patient-case-detail">
              <header>
                <div>
                  <span className="mini-label">Case #{selected.id} · {selected.department}</span>
                  <h2>{selected.complaint}</h2>
                  <p>Assigned to {selected.doctor_name}</p>
                </div>
                <StatusPill tone={evidence?.workflow.decision === "confirmed" ? "teal" : evidence?.workflow.decision === "rejected" ? "red" : "amber"}>
                  {evidence?.workflow.decision ?? selected.status}
                </StatusPill>
              </header>
              <div className="patient-case-manage">
                <Button variant="outline" onClick={() => onEdit(selected)}><Pencil size={15} /> Edit clinical intake</Button>
                <Button variant="outline" className="danger-action" onClick={() => onDelete(selected.id)}><Trash2 size={15} /> Delete clinical intake</Button>
                <small>Deleting removes this case from the patient, assigned doctor and administrator records.</small>
              </div>

              {evidence?.clarifications.some((item) => item.status === "open") && (
                <section className="patient-action-card clarification-card">
                  <div className="patient-action-title">
                    <RefreshCw size={19} />
                    <div><strong>Doctor needs more information</strong><span>Reply here; your answer returns to the assigned doctor.</span></div>
                  </div>
                  {evidence.clarifications.filter((item) => item.status === "open").map((item) => (
                    <div className="clarification-request" key={item.id}>
                      <strong>{item.question}</strong>
                      <small>Asked by @{item.doctor_username} · {new Date(item.requested_at).toLocaleString()}</small>
                      <Textarea
                        value={answers[item.id] ?? ""}
                        onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Type the requested information"
                      />
                      <Button disabled={(answers[item.id] ?? "").trim().length < 2} onClick={() => onAnswer(item.id, answers[item.id] ?? "")}>
                        <ArrowRight size={16} /> Send answer to doctor
                      </Button>
                    </div>
                  ))}
                </section>
              )}

              <section className="patient-action-card">
                <div className="patient-action-title">
                  <FileCheck2 size={19} />
                  <div><strong>Physician summary</strong><span>Generated from your submitted answers; the doctor controls confirmation.</span></div>
                </div>
                <pre className="patient-summary-text">{evidence?.workflow.physicianSummary ?? "Preparing structured summary…"}</pre>
              </section>

              <div className="case-proof-grid">
                <div><small>Completeness</small><strong>{evidence?.workflow.completenessScore ?? 0}%</strong></div>
                <div><small>Audit events</small><strong>{evidence?.audit.length ?? 0}</strong></div>
                <div><small>Consent</small><strong>{latestConsent?.status ?? "loading"}</strong></div>
                <div><small>FHIR</small><strong>{latestConsent?.status === "granted" ? "Available" : "Locked"}</strong></div>
              </div>

              <section className="patient-action-card consent-manager-card">
                <div className="patient-action-title">
                  <ShieldCheck size={19} />
                  <div><strong>Encounter consent</strong><span>Controls FHIR export for this clinical case. The audit history is retained.</span></div>
                </div>
                <div className="consent-manager-actions">
                  {latestConsent?.status === "granted" ? (
                    <>
                      <a className="document-open-link" href={`/api/fhir?intakeId=${selected.id}`}><FileText size={15} /> Export my FHIR record</a>
                      <Button variant="outline" onClick={() => onConsent("revoke-consent")}><LockKeyhole size={15} /> Revoke export consent</Button>
                    </>
                  ) : (
                    <Button onClick={() => onConsent("restore-consent")}><ShieldCheck size={15} /> Restore encounter consent</Button>
                  )}
                </div>
              </section>

              {evidence?.clarifications.some((item) => item.status !== "open") && (
                <details className="case-history-details">
                  <summary>Answered clarification history</summary>
                  {evidence.clarifications.filter((item) => item.status !== "open" && item.answer).map((item) => (
                    <div key={item.id}><strong>{item.question}</strong><p>{item.answer}</p></div>
                  ))}
                </details>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function DoctorDashboard({
  intakes,
  selected,
  loading,
  error,
  message,
  selectedId,
  doctorNote,
  workflowEvidence,
  workflowLoading,
  physicianSummary,
  onSelect,
  onRefresh,
  onNote,
  onSummary,
  onDecision,
  onDelete,
}: {
  intakes: IntakeRecord[];
  selected: IntakeRecord | null;
  loading: boolean;
  error: string;
  message: string;
  selectedId: number | null;
  doctorNote: string;
  workflowEvidence: WorkflowEvidence | null;
  workflowLoading: boolean;
  physicianSummary: string;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  onNote: (note: string) => void;
  onSummary: (summary: string) => void;
  onDecision: (decision: "confirmed" | "needs-clarification" | "rejected") => void;
  onDelete: (id: number) => void;
}) {
  const red = selected ? Boolean(selected.red_flag) : false;
  const [exchangeBusy, setExchangeBusy] = useState<"fhir" | "abdm" | "">("");
  const [exchangeMessage, setExchangeMessage] = useState("");

  async function runExchange(kind: "fhir" | "abdm") {
    if (!selected) return;
    setExchangeBusy(kind);
    setExchangeMessage("");
    try {
      const response = await fetch(kind === "fhir" ? "/api/fhir" : "/api/abdm/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "fhir"
          ? { intakeId: selected.id, confirmExchange: true }
          : { intakeId: selected.id, confirmRequest: true }),
      });
      const data = (await readJsonResponse(response)) as { error?: string; requestId?: string; location?: string };
      if (!response.ok) throw new Error(data.error || `${kind.toUpperCase()} exchange failed.`);
      setExchangeMessage(kind === "fhir"
        ? `Hospital FHIR server accepted case #${selected.id}${data.location ? ` · ${data.location}` : ""}.`
        : `ABDM sandbox consent request accepted · request ${data.requestId}.`);
      onRefresh();
    } catch (exchangeError) {
      setExchangeMessage(exchangeError instanceof Error ? exchangeError.message : "External exchange failed.");
    } finally {
      setExchangeBusy("");
    }
  }
  return (
    <section className="doctor-app">
      <div className="doctor-hero">
        <div>
          <span className="mini-label">Live hospital intake workspace</span>
          <h1>Physician review queue</h1>
          <p>
            Patient-entered data, safety signals and attached records in one
            verifiable view.
          </p>
        </div>
        <div className="doctor-hero-actions">
          <div className="queue-stat">
            <strong>{String(intakes.length).padStart(2, "0")}</strong>
            <span>records</span>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}{" "}
            Refresh
          </Button>
        </div>
      </div>
      {error && (
        <div className="login-error doctor-error">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {message && (
        <div className="doctor-success">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
      {loading && !intakes.length ? (
        <div className="doctor-empty">
          <LoaderCircle className="spin" size={30} />
          <h2>Loading patient submissions…</h2>
        </div>
      ) : !intakes.length ? (
        <div className="doctor-empty">
          <div className="upload-icon">
            <ClipboardCheck size={26} />
          </div>
          <h2>No patient submissions yet</h2>
          <p>
            Ask the patient to sign in, complete the intake and press “Submit
            securely.” Then refresh this queue.
          </p>
          <Button onClick={onRefresh}>
            <RefreshCw size={16} /> Check again
          </Button>
        </div>
      ) : (
        <div className="doctor-grid live-grid">
          <aside className="queue-panel">
            <div className="queue-title">
              <span>Submitted intakes</span>
              <StatusPill tone="teal">Live</StatusPill>
            </div>
            {intakes.map((item) => (
              <button
                key={item.id}
                className={`queue-patient ${selectedId === item.id || (!selectedId && selected?.id === item.id) ? "active" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                <div className="patient-avatar">
                  {item.full_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <strong>{item.full_name}</strong>
                  <span>
                    #{item.id} · {item.age} yrs · {item.department}
                    <br />Referred to {item.doctor_name || "Unassigned"}
                  </span>
                </div>
                <StatusPill
                  tone={
                    item.red_flag
                      ? "red"
                      : item.status === "verified"
                        ? "teal"
                        : "amber"
                  }
                >
                  {item.red_flag
                    ? "Priority"
                    : item.status === "verified"
                      ? "Verified"
                      : "New"}
                </StatusPill>
              </button>
            ))}
          </aside>
          {selected && (
            <article className="doctor-record">
              <div className="record-head">
                <div className="record-patient">
                  <div className="patient-avatar large">
                    {selected.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <h2>{selected.full_name}</h2>
                    <p>
                      {selected.age} yrs · {selected.sex} · Intake #
                      {selected.id}
                    </p>
                  </div>
                </div>
                <div className="record-badges">
                  <StatusPill tone="slate">Patient-entered</StatusPill>
                  <StatusPill
                    tone={selected.status === "verified" ? "teal" : "amber"}
                  >
                    {selected.status}
                  </StatusPill>
                </div>
              </div>
              {red && (
                <div className="clinical-alert">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Immediate triage verification recommended</strong>
                    <span>
                      Chest pain with an associated safety symptom was reported
                      by the patient.
                    </span>
                  </div>
                </div>
              )}
              <div className="patient-meta-grid">
                <div>
                  <Phone size={15} />
                  <span>
                    <small>Mobile</small>
                    <strong>{selected.phone}</strong>
                  </span>
                </div>
                <div>
                  <MapPin size={15} />
                  <span>
                    <small>Address</small>
                    <strong>{selected.address}</strong>
                  </span>
                </div>
                <div>
                  <Building2 size={15} />
                  <span>
                    <small>Department</small>
                    <strong>{selected.department}</strong>
                  </span>
                </div>
                <div>
                  <Stethoscope size={15} />
                  <span>
                    <small>Referred doctor</small>
                    <strong>{selected.doctor_name || "Unassigned"}</strong>
                    {selected.doctor_id && (
                      <em data-no-translate>Doctor ID · {selected.doctor_id}</em>
                    )}
                  </span>
                </div>
                <div>
                  <Languages size={15} />
                  <span>
                    <small>Preferred language</small>
                    <strong>{selected.language}</strong>
                  </span>
                </div>
                <div>
                  <ShieldCheck size={15} />
                  <span>
                    <small>Government ID</small>
                    <strong>
                      {selected.identity_type
                        ? `${selected.identity_type} · ${selected.identity_status ?? "pending"}`
                        : "Not attached"}
                    </strong>
                  </span>
                </div>
                <div>
                  <IdCard size={15} />
                  <span>
                    <small>ABHA</small>
                    <strong data-no-translate>
                      {maskedAbhaNumber(selected.abha_number)}
                    </strong>
                    <em>{selected.abha_status || "not-linked"}</em>
                  </span>
                </div>
              </div>
              <div className="record-section">
                <span>Chief complaint & history</span>
                <h3>
                  {selected.complaint} · {selected.onset}
                </h3>
                <p>
                  {selected.narrative || "No additional narration was entered."}
                </p>
              </div>
              <div className="record-two-col">
                <div className="record-section">
                  <span>Associated safety symptoms</span>
                  <h3>{selected.symptoms}</h3>
                </div>
                <div className="record-section">
                  <span>Past conditions</span>
                  <h3>{selected.conditions}</h3>
                </div>
              </div>
              <div className="record-two-col">
                <div className="record-section">
                  <span>Allergy history</span>
                  <h3>{selected.allergies}</h3>
                </div>
                <div className="record-section">
                  <span>Submitted</span>
                  <h3>{new Date(selected.created_at).toLocaleString()}</h3>
                </div>
              </div>
              <DoctorCaseContext
                record={selected}
                structuredRecord={workflowEvidence?.workflow.structuredRecord}
                physicianSummary={workflowEvidence?.workflow.physicianSummary ?? physicianSummary}
                verified={workflowEvidence?.workflow.decision === "confirmed"}
              />
              <MedicationSafetyPanel />
              {selected.document_name && (
                <div className="record-section evidence-section">
                  <span>Patient-attached evidence</span>
                  <div className="evidence-row">
                    <FileText size={17} />
                    <div>
                      <strong>{selected.document_name}</strong>
                      <p>
                        {selected.document_type || "Medical record"} · clinical
                        contents require verification.
                      </p>
                    </div>
                    <StatusPill tone="slate">Source linked</StatusPill>
                    {selected.document_file_id && (
                      <a
                        className="document-open-link"
                        href={`/api/documents?intakeId=${selected.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye size={14} /> Open original
                      </a>
                    )}
                  </div>
                  {selected.document_feedback && (
                    <div className="doctor-document-feedback">
                      <strong>Assisted document review</strong>
                      {parseDocumentEvidence(selected.document_feedback).displayLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      {selected.document_notes && (
                        <p>
                          <b>Patient note:</b> {selected.document_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <RelevantPreviousHistory current={selected} records={intakes} />
              <MedicalTimeline records={intakes.filter((item) => item.patient_username === selected.patient_username)} />
              {selected.voice_message_id && (
                <div className="record-section doctor-voice-message">
                  <span>Patient voice message</span>
                  <div className="doctor-voice-head">
                    <AudioLines size={21} />
                    <div>
                      <h3>
                        Original recording · {selected.voice_duration_seconds}s
                      </h3>
                      <p>Listen before verifying the transcript below.</p>
                    </div>
                    <StatusPill
                      tone={
                        selected.voice_status === "reviewed" ? "teal" : "amber"
                      }
                    >
                      {selected.voice_status || "unreviewed"}
                    </StatusPill>
                  </div>
                  <audio
                    controls
                    preload="none"
                    src={`/api/voice-messages?intakeId=${selected.id}`}
                  />
                  <p className="voice-doctor-transcript">
                    <strong>Automatic transcript:</strong>{" "}
                    {selected.voice_transcript ||
                      "Transcript unavailable — use the audio recording."}
                  </p>
                </div>
              )}
              <section className="clinical-workflow-panel">
                <div className="workflow-panel-head">
                  <div>
                    <span>Structured clinical workflow</span>
                    <h3>Physician confirmation gate</h3>
                  </div>
                  {workflowLoading ? (
                    <StatusPill tone="slate">Loading evidence…</StatusPill>
                  ) : workflowEvidence ? (
                    <StatusPill tone={workflowEvidence.workflow.decision === "confirmed" ? "teal" : "amber"}>
                      {workflowEvidence.workflow.decision}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="red">Workflow unavailable</StatusPill>
                  )}
                </div>
                {workflowEvidence && (
                  <>
                    <div className="workflow-proof-grid">
                      <div><small>Completeness</small><strong>{workflowEvidence.workflow.completenessScore}%</strong></div>
                      <div><small>Schema</small><strong>{workflowEvidence.workflow.schemaVersion}</strong></div>
                      <div><small>Consent</small><strong>{workflowEvidence.consents[0]?.status ?? "missing"}</strong></div>
                      <div><small>Audit events</small><strong>{workflowEvidence.audit.length}</strong></div>
                    </div>
                    {workflowEvidence.workflow.redFlags.length > 0 && (
                      <div className="workflow-red-flags" role="alert">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>Rules-based safety findings</strong>
                          <span>{workflowEvidence.workflow.redFlags.map((flag) => `${flag.code}: ${flag.label}`).join(" · ")}</span>
                        </div>
                      </div>
                    )}
                    {workflowEvidence.clarifications.length > 0 && (
                      <div className="doctor-clarification-thread">
                        <strong>Patient clarification thread</strong>
                        {workflowEvidence.clarifications.map((item) => (
                          <div key={item.id}>
                            <span>{item.question}</span>
                            <p>{item.answer || "Waiting for patient response."}</p>
                            <StatusPill tone={item.status === "answered" ? "teal" : "amber"}>{item.status}</StatusPill>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="doctor-note workflow-summary-editor">
                      <span>Generated physician summary · edit before deciding</span>
                      <Textarea
                        value={physicianSummary}
                        onChange={(event) => onSummary(event.target.value)}
                        rows={7}
                        placeholder="Structured physician summary"
                      />
                    </label>
                    <div className="workflow-evidence-details">
                      <details>
                        <summary><Database size={16} /> Structured clinical JSON</summary>
                        <pre>{JSON.stringify(workflowEvidence.workflow.structuredRecord, null, 2)}</pre>
                      </details>
                      <details>
                        <summary><FileCheck2 size={16} /> FHIR Bundle preview</summary>
                        <div className="fhir-preview-actions">
                          <span>Authenticated export requires active encounter consent.</span>
                          <a className="document-open-link" href={`/api/fhir?intakeId=${selected.id}`}>
                            <FileCheck2 size={14} /> Export FHIR JSON
                          </a>
                          <Button
                            size="sm"
                            disabled={workflowEvidence.workflow.decision !== "confirmed" || Boolean(exchangeBusy)}
                            onClick={() => void runExchange("fhir")}
                          >
                            {exchangeBusy === "fhir" ? <LoaderCircle className="spin" size={14} /> : <Database size={14} />}
                            Send to hospital FHIR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workflowEvidence.workflow.decision !== "confirmed" || Boolean(exchangeBusy)}
                            onClick={() => void runExchange("abdm")}
                          >
                            {exchangeBusy === "abdm" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}
                            Request ABDM consent
                          </Button>
                        </div>
                        {exchangeMessage && <div className="inline-message" role="status">{exchangeMessage}</div>}
                        <pre>{JSON.stringify(workflowEvidence.workflow.fhirBundle, null, 2)}</pre>
                      </details>
                      <details>
                        <summary><ShieldCheck size={16} /> Consent and audit trail</summary>
                        <div className="audit-timeline">
                          {workflowEvidence.consents.map((consent) => (
                            <div key={`consent-${consent.id}`}>
                              <BadgeCheck size={15} />
                              <span><strong>Consent {consent.status}</strong><small>{consent.purpose} · {new Date(consent.granted_at).toLocaleString()}</small></span>
                            </div>
                          ))}
                          {workflowEvidence.audit.map((event) => (
                            <div key={`audit-${event.id}`}>
                              <Activity size={15} />
                              <span><strong>{event.action}</strong><small>{event.actor_role}: {event.actor_username} · {new Date(event.created_at).toLocaleString()}</small></span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </>
                )}
              </section>
              <label className="doctor-note">
                <span>Doctor’s note · this becomes the patient question when requesting clarification</span>
                <Textarea
                  value={doctorNote}
                  onChange={(event) => onNote(event.target.value)}
                  placeholder="Add clinical corrections, clarification or triage instructions…"
                />
              </label>
              <div className="record-actions">
                <span className="source-disclaimer">
                  <ShieldCheck size={14} /> Patient-entered draft; not a
                  diagnosis
                </span>
                <Button
                  variant="outline"
                  className="danger-action"
                  onClick={() => onDelete(selected.id)}
                >
                  <Trash2 size={16} /> Delete record
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDecision("rejected")}
                >
                  <X size={16} /> Reject generated record
                </Button>
                <Button variant="outline" onClick={() => onDecision("needs-clarification")}>
                  <RefreshCw size={16} /> Ask for clarification
                </Button>
                <Button
                  onClick={() => onDecision("confirmed")}
                  disabled={!workflowEvidence || workflowEvidence.workflow.decision === "confirmed"}
                >
                  {workflowEvidence?.workflow.decision === "confirmed" ? (
                    <><CheckCircle2 size={16} /> Confirmed by physician</>
                  ) : (
                    <><ClipboardCheck size={16} /> Confirm clinical record</>
                  )}
                </Button>
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
