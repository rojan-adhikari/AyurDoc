export type VoiceSummaryInput = {
  patientName: string;
  language: string;
  urgency: string;
  symptomCategory: string;
  symptomDuration: string;
  severity: string;
  doctorId: string;
  doctorName: string;
  department: string;
  transcript: string;
};

const EMERGENCY_PATTERNS = [
  /chest pain|cannot breathe|difficulty breathing|unconscious|heavy bleeding|seizure|face droop|sudden weakness/i,
  /सीने में दर्द|सांस नहीं|साँस नहीं|सांस लेने में|बेहोश|बहुत खून|दौरा|अचानक कमजोरी/i,
  /நெஞ்சு வலி|மூச்சு விட முடிய|சுவாசிக்க முடிய|மயக்கம்|அதிக இரத்தப்போக்கு|வலிப்பு|திடீர் பலவீனம்/i,
];

type SummaryLanguage = "English" | "हिन्दी" | "தமிழ்";

const COPY: Record<SummaryLanguage, Record<string, string>> = {
  English: {
    title: "AYURAI CLINICAL VOICE SUMMARY — PATIENT REPORTED", patient: "Patient",
    language: "Spoken language", concern: "Main concern", duration: "Duration",
    priority: "Severity / priority", statement: "Patient statement",
    urgent: "Safety flag: URGENT — assess immediately and verify emergency symptoms.",
    routine: "Safety flag: No emergency phrase detected in the reviewed caption.",
    vaidya: "Assigned Vaidya", department: "Department",
    verification: "Verification: Review this AI-assisted summary with the caption and original audio before clinical use.",
    missing: "Not entered", routineValue: "Routine", noId: "no ID",
    noTranscript: "Transcript not supplied; listen to the original recording.",
  },
  हिन्दी: {
    title: "आयुरAI क्लिनिकल वॉइस सारांश — मरीज द्वारा बताया गया", patient: "मरीज",
    language: "बोली गई भाषा", concern: "मुख्य समस्या", duration: "अवधि",
    priority: "गंभीरता / प्राथमिकता", statement: "मरीज का कथन",
    urgent: "सुरक्षा चेतावनी: अत्यावश्यक — तुरंत जाँच करें और आपात लक्षणों की पुष्टि करें।",
    routine: "सुरक्षा चेतावनी: समीक्षा किए गए कैप्शन में कोई आपात वाक्यांश नहीं मिला।",
    vaidya: "निर्धारित वैद्य", department: "विभाग",
    verification: "पुष्टि: चिकित्सकीय उपयोग से पहले इस AI-सहायित सारांश को कैप्शन और मूल ऑडियो से मिलाएँ।",
    missing: "दर्ज नहीं", routineValue: "सामान्य", noId: "आईडी नहीं",
    noTranscript: "ट्रांसक्रिप्ट उपलब्ध नहीं; मूल रिकॉर्डिंग सुनें।",
  },
  தமிழ்: {
    title: "ஆயுரAI மருத்துவக் குரல் சுருக்கம் — நோயாளர் தெரிவித்தது", patient: "நோயாளர்",
    language: "பேசிய மொழி", concern: "முக்கிய பிரச்சனை", duration: "கால அளவு",
    priority: "தீவிரம் / முன்னுரிமை", statement: "நோயாளர் கூறியது",
    urgent: "பாதுகாப்பு எச்சரிக்கை: அவசரம் — உடனடியாக மதிப்பிட்டு அவசர அறிகுறிகளை உறுதிப்படுத்தவும்.",
    routine: "பாதுகாப்பு எச்சரிக்கை: சரிபார்க்கப்பட்ட வசனவரியில் அவசர சொற்றொடர் கண்டறியப்படவில்லை.",
    vaidya: "ஒதுக்கப்பட்ட வைத்தியர்", department: "துறை",
    verification: "உறுதிப்படுத்தல்: மருத்துவப் பயன்பாட்டுக்கு முன் இந்த AI உதவிய சுருக்கத்தை வசனவரி மற்றும் அசல் ஒலியுடன் சரிபார்க்கவும்.",
    missing: "பதிவு செய்யப்படவில்லை", routineValue: "வழக்கமானது", noId: "அடையாள எண் இல்லை",
    noTranscript: "உரைமாற்றம் இல்லை; அசல் ஒலிப்பதிவைக் கேட்கவும்.",
  },
};

const VALUE_COPY: Record<Exclude<SummaryLanguage, "English">, Record<string, string>> = {
  हिन्दी: {
    Routine: "सामान्य", Urgent: "अत्यावश्यक", Mild: "हल्का", Moderate: "मध्यम", Severe: "गंभीर",
    Today: "आज", "2–3 days": "2–3 दिन", "About a week": "लगभग एक सप्ताह", "More than a month": "एक महीने से अधिक",
    "Fever, weakness or general illness": "बुखार, कमजोरी या सामान्य बीमारी",
    "Digestion, appetite or bowel concern": "पाचन, भूख या मल संबंधी समस्या",
    "Skin or hair concern": "त्वचा या बालों की समस्या", "Joint, injury or wound concern": "जोड़, चोट या घाव की समस्या",
    "Women's health concern": "महिला स्वास्थ्य समस्या", "Eye, ear, nose or throat concern": "आँख, कान, नाक या गले की समस्या",
    "Child health, growth or feeding concern": "बाल स्वास्थ्य, विकास या आहार संबंधी समस्या",
    "Recovery, stiffness or rehabilitation concern": "स्वास्थ्य-लाभ, अकड़न या पुनर्वास की समस्या",
    "Lifestyle, prevention, diet or yoga guidance": "जीवनशैली, रोकथाम, आहार या योग मार्गदर्शन",
    "Sleep, stress or emotional concern": "नींद, तनाव या भावनात्मक समस्या", "Another concern": "अन्य समस्या",
  },
  தமிழ்: {
    Routine: "வழக்கமானது", Urgent: "அவசரம்", Mild: "லேசானது", Moderate: "மிதமானது", Severe: "கடுமையானது",
    Today: "இன்று", "2–3 days": "2–3 நாட்கள்", "About a week": "சுமார் ஒரு வாரம்", "More than a month": "ஒரு மாதத்திற்கும் மேலாக",
    "Fever, weakness or general illness": "காய்ச்சல், பலவீனம் அல்லது பொதுவான உடல்நலக் குறைவு",
    "Digestion, appetite or bowel concern": "செரிமானம், பசி அல்லது குடல் பிரச்சனை",
    "Skin or hair concern": "தோல் அல்லது முடி பிரச்சனை", "Joint, injury or wound concern": "மூட்டு, காயம் அல்லது புண் பிரச்சனை",
    "Women's health concern": "பெண்கள் உடல்நலப் பிரச்சனை", "Eye, ear, nose or throat concern": "கண், காது, மூக்கு அல்லது தொண்டை பிரச்சனை",
    "Child health, growth or feeding concern": "குழந்தை நலம், வளர்ச்சி அல்லது உணவளிப்பு பிரச்சனை",
    "Recovery, stiffness or rehabilitation concern": "மீட்பு, விறைப்பு அல்லது மறுவாழ்வு பிரச்சனை",
    "Lifestyle, prevention, diet or yoga guidance": "வாழ்க்கைமுறை, தடுப்பு, உணவு அல்லது யோகா வழிகாட்டல்",
    "Sleep, stress or emotional concern": "தூக்கம், மனஅழுத்தம் அல்லது உணர்ச்சி பிரச்சனை", "Another concern": "வேறு பிரச்சனை",
  },
};

function resolveLanguage(value: string): SummaryLanguage {
  if (value === "हिन्दी" || value.toLowerCase().includes("hindi")) return "हिन्दी";
  if (value === "தமிழ்" || value.toLowerCase().includes("tamil")) return "தமிழ்";
  return "English";
}

function clean(value: string, fallback: string) {
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function spokenExtract(transcript: string, fallback: string) {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const parts = normalized
    .split(/(?<=[.!?।॥])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (parts.slice(0, 3).join(" ") || normalized).slice(0, 700);
}

export function createVoiceSummary(fields: VoiceSummaryInput) {
  const summaryLanguage = resolveLanguage(fields.language);
  const t = COPY[summaryLanguage];
  const transcript = fields.transcript.replace(/\s+/g, " ").trim();
  const emergencySignal =
    fields.severity === "Severe" ||
    fields.urgency === "Urgent" ||
    EMERGENCY_PATTERNS.some((pattern) => pattern.test(transcript));

  return [
    t.title,
    `${t.patient}: ${clean(fields.patientName, t.missing)}`,
    `${t.language}: ${clean(fields.language, "English")}`,
    `${t.concern}: ${summaryLanguage === "English" ? clean(fields.symptomCategory, t.missing) : VALUE_COPY[summaryLanguage][fields.symptomCategory] ?? clean(fields.symptomCategory, t.missing)}`,
    `${t.duration}: ${summaryLanguage === "English" ? clean(fields.symptomDuration, t.missing) : VALUE_COPY[summaryLanguage][fields.symptomDuration] ?? clean(fields.symptomDuration, t.missing)}`,
    `${t.priority}: ${summaryLanguage === "English" ? clean(fields.severity, t.missing) : VALUE_COPY[summaryLanguage][fields.severity] ?? clean(fields.severity, t.missing)} / ${summaryLanguage === "English" ? clean(fields.urgency, t.routineValue) : VALUE_COPY[summaryLanguage][fields.urgency] ?? clean(fields.urgency, t.routineValue)}`,
    `${t.statement}: ${spokenExtract(transcript, t.noTranscript)}`,
    emergencySignal ? t.urgent : t.routine,
    `${t.vaidya}: ${clean(fields.doctorName, t.missing)} (${clean(fields.doctorId, t.noId)})`,
    `${t.department}: ${summaryLanguage === "English" ? clean(fields.department, t.missing) : VALUE_COPY[summaryLanguage][fields.department] ?? clean(fields.department, t.missing)}`,
    t.verification,
  ].join("\n");
}
