export const WORKFLOW_STAGES = [
  "identify",
  "consent",
  "patient-information",
  "clinical-interview",
  "documents",
  "timeline",
  "summary",
  "patient-confirmation",
  "doctor-consultation",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type GuideLanguage = "English" | "हिन्दी" | "தமிழ்";

export type SessionWorkflowContext = {
  currentState: WorkflowStage;
  previousState: WorkflowStage | null;
  completedSteps: WorkflowStage[];
  pendingSteps: WorkflowStage[];
  currentCase: number | null;
  currentModule: string;
  selectedLanguage: GuideLanguage;
  lastAction: string;
  nextBestAction: string;
  caseCompletion: number;
  documents: { uploaded: number; processed: number };
  summaryStatus: "not-ready" | "ready" | "patient-confirmed" | "physician-verified";
};

export type WorkflowSignals = {
  currentModule: string;
  phase: "identify" | "history" | "documents" | "summary" | "submitted";
  hasIdentity: boolean;
  hasConsent: boolean;
  patientInformationComplete: boolean;
  clinicalInterviewComplete: boolean;
  documentUploaded: boolean;
  documentProcessed: boolean;
  patientConfirmed: boolean;
  currentCase: number | null;
  physicianVerified: boolean;
};

export function deriveWorkflowState(signals: WorkflowSignals): Omit<SessionWorkflowContext, "previousState" | "selectedLanguage" | "lastAction"> {
  let currentState: WorkflowStage = "identify";
  if (signals.phase === "submitted") currentState = "doctor-consultation";
  else if (!signals.hasConsent && signals.phase === "identify") currentState = signals.hasIdentity ? "consent" : "identify";
  else if (!signals.patientInformationComplete && signals.phase === "identify") currentState = "patient-information";
  else if (signals.phase === "history") currentState = "clinical-interview";
  else if (signals.phase === "documents") currentState = signals.documentProcessed ? "timeline" : "documents";
  else if (signals.phase === "summary") currentState = "patient-confirmation";

  const completed = new Set<WorkflowStage>();
  if (signals.hasIdentity) completed.add("identify");
  if (signals.hasConsent) completed.add("consent");
  if (signals.patientInformationComplete) completed.add("patient-information");
  if (signals.clinicalInterviewComplete) completed.add("clinical-interview");
  if (signals.documentUploaded) completed.add("documents");
  if (signals.documentProcessed) completed.add("timeline");
  if (signals.phase === "summary" || signals.phase === "submitted") completed.add("summary");
  if (signals.patientConfirmed || signals.phase === "submitted") completed.add("patient-confirmation");
  if (signals.physicianVerified) completed.add("doctor-consultation");

  const completedSteps = WORKFLOW_STAGES.filter((step) => completed.has(step));
  const pendingSteps = WORKFLOW_STAGES.filter((step) => !completed.has(step));
  const nextBestAction = nextActionFor(currentState, signals);
  return {
    currentState,
    completedSteps,
    pendingSteps,
    currentCase: signals.currentCase,
    currentModule: signals.currentModule,
    nextBestAction,
    caseCompletion: Math.round((completedSteps.length / WORKFLOW_STAGES.length) * 100),
    documents: { uploaded: signals.documentUploaded ? 1 : 0, processed: signals.documentProcessed ? 1 : 0 },
    summaryStatus: signals.physicianVerified
      ? "physician-verified"
      : signals.patientConfirmed || signals.phase === "submitted"
        ? "patient-confirmed"
        : signals.phase === "summary"
          ? "ready"
          : "not-ready",
  };
}

function nextActionFor(state: WorkflowStage, signals: WorkflowSignals) {
  if (signals.currentModule === "home") return "open-intake";
  if (signals.currentModule === "cases") return "review-case-status";
  if (signals.currentModule === "voice") return "record-message";
  if (signals.currentModule === "appointments") return "book-consultation";
  const actions: Record<WorkflowStage, string> = {
    identify: "add-identity",
    consent: "grant-consent",
    "patient-information": "complete-patient-information",
    "clinical-interview": "continue-clinical-interview",
    documents: "add-or-skip-documents",
    timeline: "review-extracted-timeline",
    summary: "review-summary",
    "patient-confirmation": "confirm-and-send",
    "doctor-consultation": signals.physicianVerified ? "view-verified-case" : "wait-for-doctor-review",
  };
  return actions[state];
}

const GUIDE_COPY: Record<GuideLanguage, Record<string, string>> = {
  English: {
    home: "I can guide you. Your next step is to open Ayurvedic Case Taking.",
    identify: "Let’s begin. Add your identity details so this case belongs to the correct patient.",
    consent: "Your identity is ready. Please listen to and approve the consent before continuing.",
    "patient-information": "Complete your name, age, contact details, ABHA information and choose a Vaidya.",
    "clinical-interview": "Let’s continue with your medical history. Answer the highlighted question, then say Continue.",
    documents: "Your history is complete. You can now upload or photograph a previous medical report.",
    timeline: "Your report has been processed. Review the extracted facts and medical timeline. Uncertain details are marked.",
    summary: "Your summary is being prepared from the information you supplied.",
    "patient-confirmation": "Your summary is ready. Please review it before sending it to the doctor.",
    "doctor-consultation": "Your case has been sent to the assigned Vaidya. You can check its status or book a consultation.",
    cases: "This page shows your submitted cases, doctor questions and verification status.",
    voice: "Record your concern, confirm the live transcript and choose the correct Vaidya before sending.",
    appointments: "Choose your Vaidya, date and time to book the consultation.",
  },
  हिन्दी: {
    home: "मैं आपका मार्गदर्शन कर सकती हूँ। अगला कदम आयुर्वेदिक केस टेकिंग खोलना है।",
    identify: "चलिए शुरू करें। सही रोगी से केस जोड़ने के लिए पहचान विवरण भरें।",
    consent: "पहचान तैयार है। आगे बढ़ने से पहले सहमति सुनें और स्वीकार करें।",
    "patient-information": "नाम, उम्र, संपर्क, आभा विवरण भरें और वैद्य चुनें।",
    "clinical-interview": "अपना चिकित्सा इतिहास जारी रखें। दिखाए गए प्रश्न का उत्तर दें, फिर आगे कहें।",
    documents: "आपका इतिहास पूरा है। अब पुरानी मेडिकल रिपोर्ट अपलोड करें या उसकी फोटो लें।",
    timeline: "रिपोर्ट संसाधित हो गई है। निकाली गई जानकारी और समयरेखा देखें। अनिश्चित विवरण चिन्हित हैं।",
    summary: "आपके दिए विवरण से सारांश तैयार किया जा रहा है।",
    "patient-confirmation": "आपका सारांश तैयार है। डॉक्टर को भेजने से पहले इसे जाँचें।",
    "doctor-consultation": "आपका केस चुने हुए वैद्य को भेज दिया गया है। स्थिति देखें या अपॉइंटमेंट बुक करें।",
    cases: "यहाँ भेजे गए केस, डॉक्टर के प्रश्न और सत्यापन स्थिति दिखाई जाती है।",
    voice: "अपनी समस्या रिकॉर्ड करें, लाइव लिखावट जाँचें और सही वैद्य चुनकर भेजें।",
    appointments: "परामर्श बुक करने के लिए वैद्य, तारीख और समय चुनें।",
  },
  தமிழ்: {
    home: "நான் உங்களுக்கு வழிகாட்டுகிறேன். அடுத்ததாக ஆயுர்வேத நோயாளர் பதிவு பகுதியைத் திறக்கவும்.",
    identify: "தொடங்கலாம். சரியான நோயாளருடன் வழக்கை இணைக்க அடையாள விவரங்களைச் சேர்க்கவும்.",
    consent: "அடையாளம் தயாராக உள்ளது. தொடரும் முன் ஒப்புதலைக் கேட்டு ஏற்கவும்.",
    "patient-information": "பெயர், வயது, தொடர்பு, ஆபா விவரங்களை நிரப்பி வைத்தியரைத் தேர்ந்தெடுக்கவும்.",
    "clinical-interview": "உங்கள் மருத்துவ வரலாற்றைத் தொடரலாம். காட்டப்பட்ட கேள்விக்கு பதிலளித்து, அடுத்து என்று சொல்லுங்கள்.",
    documents: "உங்கள் வரலாறு முடிந்தது. பழைய மருத்துவ அறிக்கையை பதிவேற்றலாம் அல்லது படம் எடுக்கலாம்.",
    timeline: "அறிக்கை செயலாக்கப்பட்டது. எடுக்கப்பட்ட தகவல்களையும் மருத்துவ காலவரிசையையும் சரிபார்க்கவும். உறுதியற்றவை குறிக்கப்பட்டுள்ளன.",
    summary: "நீங்கள் அளித்த தகவலிலிருந்து சுருக்கம் தயாராகிறது.",
    "patient-confirmation": "உங்கள் சுருக்கம் தயாராக உள்ளது. மருத்துவருக்கு அனுப்பும் முன் சரிபார்க்கவும்.",
    "doctor-consultation": "உங்கள் வழக்கு தேர்ந்தெடுத்த வைத்தியருக்கு அனுப்பப்பட்டது. நிலையைப் பார்க்கலாம் அல்லது சந்திப்பை பதிவு செய்யலாம்.",
    cases: "சமர்ப்பித்த வழக்குகள், மருத்துவர் கேள்விகள் மற்றும் சரிபார்ப்பு நிலை இங்கே தெரியும்.",
    voice: "உங்கள் பிரச்சனையை பதிவு செய்து, நேரடி உரையைச் சரிபார்த்து, சரியான வைத்தியரைத் தேர்ந்தெடுத்து அனுப்பவும்.",
    appointments: "ஆலோசனைக்காக வைத்தியர், தேதி மற்றும் நேரத்தைத் தேர்ந்தெடுக்கவும்.",
  },
};

export function guideMessage(context: SessionWorkflowContext) {
  const copy = GUIDE_COPY[context.selectedLanguage];
  return copy[context.currentModule] ?? copy[context.currentState] ?? copy.home;
}

export function isValidWorkflowTransition(from: WorkflowStage, to: WorkflowStage, completed: WorkflowStage[]) {
  const fromIndex = WORKFLOW_STAGES.indexOf(from);
  const toIndex = WORKFLOW_STAGES.indexOf(to);
  if (toIndex <= fromIndex) return true;
  if (toIndex !== fromIndex + 1) return false;
  return completed.includes(from) || from === "documents";
}
