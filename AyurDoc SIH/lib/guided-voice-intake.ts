import { DEPARTMENTS, DOCTORS, type DoctorProfile } from "./doctor-directory";

export type GuidedVoiceLanguage = "English" | "हिन्दी" | "தமிழ்";
export type GuidedVoiceStage =
  | "name"
  | "age"
  | "sex"
  | "phone"
  | "address"
  | "problem"
  | "duration"
  | "severity"
  | "consent"
  | "confirm"
  | "submitted";

export type GuidedVoiceDraft = {
  name: string;
  age: string;
  sex: string;
  phone: string;
  address: string;
  problem: string;
  duration: string;
  severity: "" | "Mild" | "Moderate" | "Severe";
  consent: boolean;
};

export const EMPTY_GUIDED_DRAFT: GuidedVoiceDraft = {
  name: "", age: "", sex: "", phone: "", address: "", problem: "",
  duration: "", severity: "", consent: false,
};

const STAGES: GuidedVoiceStage[] = [
  "name", "age", "sex", "phone", "address", "problem", "duration",
  "severity", "consent", "confirm", "submitted",
];

const PROMPTS: Record<GuidedVoiceLanguage, Record<Exclude<GuidedVoiceStage, "submitted">, string>> = {
  English: {
    name: "I will guide you through a secure patient intake, one question at a time. First, please tell me your full name.",
    age: "Thank you. Please say your age in years.",
    sex: "Please say male, female, or rather not say.",
    phone: "Please say your ten digit mobile number, one digit at a time.",
    address: "Please say your village, town, or current address.",
    problem: "Now describe your main health problem in your own words.",
    duration: "How long have you had this problem?",
    severity: "Is it mild, moderate, or severe?",
    consent: "May AyurDoc send these patient-reported details to the assigned Vaidya? Say yes or no.",
    confirm: "Your details are ready. Say send to doctor to submit, or say change followed by the field name.",
  },
  हिन्दी: {
    name: "मैं सुरक्षित मरीज जानकारी के लिए एक-एक प्रश्न पूछूँगी। पहले कृपया अपना पूरा नाम बताइए।",
    age: "धन्यवाद। अपनी उम्र वर्ष में बोलें।",
    sex: "पुरुष, महिला, या बताना नहीं चाहते बोलें।",
    phone: "अपना दस अंकों का मोबाइल नंबर एक-एक अंक बोलें।",
    address: "अपना गाँव, शहर या वर्तमान पता बोलें।",
    problem: "अब अपनी मुख्य स्वास्थ्य समस्या अपने शब्दों में बताइए।",
    duration: "यह समस्या आपको कब से है?",
    severity: "समस्या हल्की, मध्यम या गंभीर है?",
    consent: "क्या AyurDoc यह मरीज द्वारा बताई जानकारी निर्धारित वैद्य को भेज सकता है? हाँ या नहीं बोलें।",
    confirm: "जानकारी तैयार है। भेजने के लिए डॉक्टर को भेजो बोलें, या बदलें और फ़ील्ड का नाम बोलें।",
  },
  தமிழ்: {
    name: "பாதுகாப்பான நோயாளர் பதிவிற்காக ஒவ்வொரு கேள்வியாக வழிகாட்டுகிறேன். முதலில் உங்கள் முழுப் பெயரைச் சொல்லுங்கள்.",
    age: "நன்றி. உங்கள் வயதை ஆண்டுகளில் சொல்லுங்கள்.",
    sex: "ஆண், பெண் அல்லது சொல்ல விரும்பவில்லை என்று சொல்லுங்கள்.",
    phone: "உங்கள் பத்து இலக்க கைபேசி எண்ணை ஒவ்வொரு இலக்கமாகச் சொல்லுங்கள்.",
    address: "உங்கள் கிராமம், நகரம் அல்லது தற்போதைய முகவரியைச் சொல்லுங்கள்.",
    problem: "இப்போது உங்கள் முக்கிய உடல்நலப் பிரச்சனையை உங்கள் சொந்த வார்த்தைகளில் சொல்லுங்கள்.",
    duration: "இந்தப் பிரச்சனை எவ்வளவு காலமாக உள்ளது?",
    severity: "இது லேசானதா, மிதமானதா அல்லது கடுமையானதா?",
    consent: "நோயாளர் தெரிவித்த இந்த தகவலை ஒதுக்கப்பட்ட வைத்தியருக்கு AyurDoc அனுப்பலாமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",
    confirm: "தகவல் தயாராக உள்ளது. அனுப்ப மருத்துவருக்கு அனுப்பு என்று சொல்லுங்கள், அல்லது மாற்று என்று கூறி புலத்தின் பெயரைச் சொல்லுங்கள்.",
  },
};

export function guidedPrompt(language: GuidedVoiceLanguage, stage: GuidedVoiceStage) {
  if (stage === "submitted") {
    return language === "हिन्दी" ? "आपकी जानकारी वैद्य को भेज दी गई है।"
      : language === "தமிழ்" ? "உங்கள் தகவல் வைத்தியருக்கு அனுப்பப்பட்டது."
        : "Your information has been sent to the Vaidya.";
  }
  return PROMPTS[language][stage];
}

export function nextGuidedStage(stage: GuidedVoiceStage): GuidedVoiceStage {
  return STAGES[Math.min(STAGES.indexOf(stage) + 1, STAGES.length - 1)];
}

export function previousGuidedStage(stage: GuidedVoiceStage): GuidedVoiceStage {
  return STAGES[Math.max(STAGES.indexOf(stage) - 1, 0)];
}

export function guidedProgress(stage: GuidedVoiceStage) {
  return Math.round((STAGES.indexOf(stage) / (STAGES.length - 1)) * 100);
}

export function cleanSpokenName(value: string) {
  return value
    .replace(/^(?:my name is|i am|मेरा नाम|मैं|என் பெயர்|நான்)\s+/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 120);
}

export function spokenPhone(value: string) {
  const wordDigits: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
    शून्य: "0", जीरो: "0", एक: "1", दो: "2", तीन: "3", चार: "4", पांच: "5", पाँच: "5", छह: "6", सात: "7", आठ: "8", नौ: "9",
    பூஜ்ஜியம்: "0", ஒன்று: "1", இரண்டு: "2", மூன்று: "3", நான்கு: "4", ஐந்து: "5", ஆறு: "6", ஏழு: "7", எட்டு: "8", ஒன்பது: "9",
  };
  const replaced = value.toLocaleLowerCase().split(/[\s,.-]+/).map((word) => wordDigits[word] ?? word).join("");
  const digits = replaced.replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits.slice(0, 10);
}

export function spokenSex(value: string) {
  const text = value.toLocaleLowerCase();
  if (/rather not|prefer not|बताना नहीं|नहीं बताना|சொல்ல விரும்பவில்லை/.test(text)) return "Rather not to say";
  if (/female|woman|महिला|स्त्री|பெண்/.test(text)) return "Female";
  if (/\bmale\b|\bman\b|पुरुष|ஆண்/.test(text)) return "Male";
  return "";
}

export function spokenSeverity(value: string): GuidedVoiceDraft["severity"] {
  const text = value.toLocaleLowerCase();
  if (/severe|serious|गंभीर|बहुत|கடுமை|கடுமையான/.test(text)) return "Severe";
  if (/moderate|medium|मध्यम|மிதமான/.test(text)) return "Moderate";
  if (/mild|हल्क|லேசான/.test(text)) return "Mild";
  return "";
}

const ROUTES: Array<{ pattern: RegExp; department: string; category: string }> = [
  { pattern: /skin|rash|itch|hair|त्वचा|खुजली|बाल|தோல்|அரிப்பு|முடி/i, department: DEPARTMENTS[1], category: "Skin or hair concern" },
  { pattern: /joint|bone|injury|wound|pain in knee|जोड़|हड्डी|चोट|घाव|மூட்டு|எலும்பு|காயம்|புண்/i, department: DEPARTMENTS[2], category: "Joint, injury or wound concern" },
  { pattern: /period|pregnan|women|uterus|मासिक|गर्भ|महिला|மாதவிடாய்|கர்ப்ப|பெண்கள்/i, department: DEPARTMENTS[3], category: "Women's health concern" },
  { pattern: /eye|ear|nose|throat|vision|आँख|कान|नाक|गला|கண்|காது|மூக்கு|தொண்டை/i, department: DEPARTMENTS[4], category: "Eye, ear, nose or throat concern" },
  { pattern: /child|baby|growth|feeding|बच्च|शिशु|குழந்தை|சிசு/i, department: DEPARTMENTS[5], category: "Child health, growth or feeding concern" },
  { pattern: /recover|stiff|rehab|therapy|अकड़|पुनर्वास|விறைப்பு|மறுவாழ்வு/i, department: DEPARTMENTS[6], category: "Recovery, stiffness or rehabilitation concern" },
  { pattern: /diet|yoga|lifestyle|prevent|वजन|आहार|योग|உணவு|யோகா|வாழ்க்கைமுறை/i, department: DEPARTMENTS[7], category: "Lifestyle, prevention, diet or yoga guidance" },
  { pattern: /sleep|stress|anxiety|mood|नींद|तनाव|चिंता|தூக்கம்|மனஅழுத்தம்|கவலை/i, department: DEPARTMENTS[8], category: "Sleep, stress or emotional concern" },
  { pattern: /digestion|stomach|abdomen|appetite|bowel|gas|पेट|पाचन|भूख|வயிறு|செரிமானம்|பசி/i, department: DEPARTMENTS[0], category: "Digestion, appetite or bowel concern" },
];

export function routeGuidedConcern(problem: string): { doctor: DoctorProfile; category: string } {
  const route = ROUTES.find((item) => item.pattern.test(problem)) ?? {
    department: DEPARTMENTS[0], category: "Fever, weakness or general illness",
  };
  const doctor = DOCTORS.find((item) => item.department === route.department) ?? DOCTORS[0];
  return { doctor, category: route.category };
}

export function hasEmergencyLanguage(problem: string) {
  return /chest pain|cannot breathe|difficulty breathing|unconscious|heavy bleeding|seizure|सीने में दर्द|सांस नहीं|साँस नहीं|बेहोश|बहुत खून|दौरा|நெஞ்சு வலி|மூச்சு விட முடிய|மயக்கம்|அதிக இரத்தப்போக்கு|வலிப்பு/i.test(problem);
}

export function stageForCorrection(value: string): GuidedVoiceStage | null {
  const text = value.toLocaleLowerCase();
  if (/name|नाम|பெயர்/.test(text)) return "name";
  if (/age|उम्र|வயது/.test(text)) return "age";
  if (/sex|gender|लिंग|பாலினம்/.test(text)) return "sex";
  if (/phone|mobile|नंबर|मोबाइल|கைபேசி|தொலைபேசி/.test(text)) return "phone";
  if (/address|पता|முகவரி/.test(text)) return "address";
  if (/problem|symptom|समस्या|लक्षण|பிரச்சனை|அறிகுறி/.test(text)) return "problem";
  if (/duration|how long|कब से|अवधि|எவ்வளவு காலம்/.test(text)) return "duration";
  if (/severity|गंभीरता|தீவிரம்/.test(text)) return "severity";
  return null;
}
