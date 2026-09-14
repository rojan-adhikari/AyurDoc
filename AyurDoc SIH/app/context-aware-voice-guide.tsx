"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Ear, Keyboard, Mic, Navigation, Repeat2, Send, Square, Volume2, X } from "lucide-react";
import { guideMessage, type GuideLanguage, type SessionWorkflowContext } from "@/lib/workflow-state";
import {
  EMPTY_GUIDED_DRAFT, cleanSpokenName, guidedProgress, guidedPrompt,
  hasEmergencyLanguage, nextGuidedStage, previousGuidedStage, routeGuidedConcern,
  spokenPhone, spokenSeverity, spokenSex, stageForCorrection,
  type GuidedVoiceDraft, type GuidedVoiceStage,
} from "@/lib/guided-voice-intake";

export type PatientGuideDestination = "home" | "directory" | "abha" | "voice" | "intake" | "cases" | "emergency" | "blood" | "appointments";
type RecognitionResultLike = { 0?: { transcript?: string }; isFinal?: boolean };
type RecognitionEventLike = { resultIndex?: number; results: ArrayLike<RecognitionResultLike> };
type RecognitionErrorLike = { error?: string };
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void; abort?: () => void;
};

const COPY: Record<GuideLanguage, Record<string, string>> = {
  English: {
    title: "AyurDoc Voice Guide", hear: "Hear again", listen: "Start listening", stop: "Stop listening",
    repeat: "Repeat question", placeholder: "Speak or type your answer", send: "Answer", close: "Minimize",
    listening: "Listening patiently—take your time…", heard: "I heard", auto: "Ready when you are",
    help: "Say: start health questions, change language to Hindi or Tamil, open reports, appointments, emergency, or logout.",
    unavailable: "Speech recognition is unavailable here. Answer with the large controls or type below.",
    blocked: "Microphone access is blocked. Allow microphone access, then press Start listening.",
    noSpeech: "I did not hear an answer. Take your time, then speak again.",
    audioError: "I cannot access the microphone. Check the browser microphone setting and try again.",
    processing: "Thank you. I am saving your answer…",
    stopped: "Hands-free listening is off.", invalid: "I could not safely save that answer. Please answer again.",
    noConsent: "Nothing was sent. Say yes when ready, or say cancel.", sending: "Sending your confirmed details to the assigned Vaidya.",
    failed: "I could not send the details. Your answers remain saved here.",
    sent: "Your details were sent to {doctor}. Opening Voice to Vaidya so you can see the record.",
    correction: "Okay. Please answer that question again.", cancelled: "The guided intake is paused. Say start health questions when ready.",
    language: "Language changed to English.", logout: "Signing out now.", start: "Start health questions",
    back: "Previous question", confirm: "Send to Vaidya", captured: "Answers captured", routed: "Assigned Vaidya",
    emergency: "This may need urgent care. I will mark it urgent. If there is immediate danger, open Emergency now.",
  },
  हिन्दी: {
    title: "आयुरडॉक आवाज़ मार्गदर्शक", hear: "फिर सुनें", listen: "सुनना शुरू करें", stop: "सुनना रोकें",
    repeat: "प्रश्न फिर सुनें", placeholder: "अपना उत्तर बोलें या लिखें", send: "उत्तर दें", close: "छोटा करें",
    listening: "आराम से बोलिए—मैं ध्यान से सुन रही हूँ…", heard: "मैंने सुना", auto: "जब आप तैयार हों",
    help: "बोलें: स्वास्थ्य प्रश्न शुरू करो, भाषा तमिल या अंग्रेज़ी करो, रिपोर्ट खोलो, अपॉइंटमेंट, आपातकाल, या लॉग आउट।",
    unavailable: "यहाँ आवाज़ पहचान उपलब्ध नहीं है। बड़े बटन से उत्तर दें या नीचे लिखें।",
    blocked: "माइक्रोफ़ोन की अनुमति बंद है। अनुमति दें, फिर सुनना शुरू करें दबाएँ।",
    noSpeech: "मुझे उत्तर सुनाई नहीं दिया। आराम से फिर बोलिए।",
    audioError: "माइक्रोफ़ोन उपलब्ध नहीं है। ब्राउज़र की अनुमति जाँचकर फिर प्रयास करें।",
    processing: "धन्यवाद। आपका उत्तर दर्ज हो रहा है…",
    stopped: "आवाज़ सुनना बंद है।", invalid: "यह उत्तर सुरक्षित रूप से दर्ज नहीं हुआ। फिर से जवाब दें।",
    noConsent: "कुछ नहीं भेजा गया। तैयार होने पर हाँ बोलें, या रद्द करें।", sending: "पुष्टि की गई जानकारी निर्धारित वैद्य को भेज रही हूँ।",
    failed: "जानकारी भेजी नहीं जा सकी। आपके उत्तर यहाँ सुरक्षित हैं।",
    sent: "आपकी जानकारी {doctor} को भेज दी गई है। रिकॉर्ड दिखाने के लिए वैद्य को आवाज़ खोल रही हूँ।",
    correction: "ठीक है। उस प्रश्न का उत्तर फिर से दें।", cancelled: "मार्गदर्शित इनटेक रुका है। तैयार होने पर स्वास्थ्य प्रश्न शुरू करो बोलें।",
    language: "भाषा हिन्दी कर दी गई है।", logout: "अब लॉग आउट कर रही हूँ।", start: "स्वास्थ्य प्रश्न शुरू करें",
    back: "पिछला प्रश्न", confirm: "वैद्य को भेजें", captured: "दर्ज उत्तर", routed: "निर्धारित वैद्य",
    emergency: "इसमें तुरंत देखभाल की आवश्यकता हो सकती है। इसे अत्यावश्यक चिन्हित कर रही हूँ। तत्काल खतरे में आपातकाल खोलें।",
  },
  தமிழ்: {
    title: "ஆயுர்டாக் குரல் வழிகாட்டி", hear: "மீண்டும் கேள்", listen: "கேட்கத் தொடங்கு", stop: "கேட்பதை நிறுத்து",
    repeat: "கேள்வியை மீண்டும் கேள்", placeholder: "உங்கள் பதிலை பேசவும் அல்லது எழுதவும்", send: "பதில்", close: "சிறிதாக்கு",
    listening: "அவசரமின்றி பேசுங்கள்—கவனமாகக் கேட்கிறேன்…", heard: "நான் கேட்டது", auto: "நீங்கள் தயாரானதும்",
    help: "சொல்லுங்கள்: உடல்நல கேள்விகளை தொடங்கு, மொழியை இந்தி அல்லது ஆங்கிலமாக மாற்று, அறிக்கைகளை திற, சந்திப்பு, அவசரம், அல்லது வெளியேறு.",
    unavailable: "இங்கு குரல் அறிதல் இல்லை. பெரிய கட்டுப்பாடுகளைப் பயன்படுத்தவும் அல்லது தட்டச்சு செய்யவும்.",
    blocked: "மைக்ரோஃபோன் அனுமதி தடுக்கப்பட்டுள்ளது. அனுமதித்து கேட்கத் தொடங்கு என்பதை அழுத்தவும்.",
    noSpeech: "உங்கள் பதில் கேட்கவில்லை. நேரம் எடுத்துக் கொண்டு மீண்டும் பேசுங்கள்.",
    audioError: "மைக்ரோஃபோனை அணுக முடியவில்லை. உலாவி அனுமதியைச் சரிபார்த்து மீண்டும் முயலவும்.",
    processing: "நன்றி. உங்கள் பதிலை பதிவு செய்கிறேன்…",
    stopped: "குரல் கேட்பது நிறுத்தப்பட்டது.", invalid: "இந்த பதிலை பாதுகாப்பாக சேமிக்க முடியவில்லை. மீண்டும் பதில் சொல்லுங்கள்.",
    noConsent: "எதுவும் அனுப்பப்படவில்லை. தயாரானதும் ஆம் அல்லது ரத்து என்று சொல்லுங்கள்.", sending: "உறுதிப்படுத்திய தகவலை ஒதுக்கப்பட்ட வைத்தியருக்கு அனுப்புகிறேன்.",
    failed: "தகவலை அனுப்ப முடியவில்லை. உங்கள் பதில்கள் இங்கே சேமிக்கப்பட்டுள்ளன.",
    sent: "உங்கள் தகவல் {doctor}க்கு அனுப்பப்பட்டது. பதிவைக் காட்ட வைத்தியருக்கு குரல் பகுதியைத் திறக்கிறேன்.",
    correction: "சரி. அந்தக் கேள்விக்கு மீண்டும் பதிலளிக்கவும்.", cancelled: "வழிகாட்டப்பட்ட பதிவு நிறுத்தப்பட்டுள்ளது. தயாரானதும் உடல்நல கேள்விகளை தொடங்கு என்று சொல்லுங்கள்.",
    language: "மொழி தமிழுக்கு மாற்றப்பட்டது.", logout: "இப்போது வெளியேறுகிறேன்.", start: "உடல்நல கேள்விகளைத் தொடங்கு",
    back: "முந்தைய கேள்வி", confirm: "வைத்தியருக்கு அனுப்பு", captured: "பதிவு செய்த பதில்கள்", routed: "ஒதுக்கப்பட்ட வைத்தியர்",
    emergency: "இதற்கு அவசர சிகிச்சை தேவைப்படலாம். இதை அவசரம் என்று குறிக்கிறேன். உடனடி ஆபத்து இருந்தால் அவசர சேவையைத் திறக்கவும்.",
  },
};

function languageCode(language: GuideLanguage) {
  return language === "हिन्दी" ? "hi-IN" : language === "தமிழ்" ? "ta-IN" : "en-IN";
}
function isYes(value: string) { return /\byes\b|\bokay\b|\bconfirm\b|हाँ|हां|जी हाँ|ஆம்|சரி/i.test(value); }
function isNo(value: string) { return /\bno\b|cancel|नहीं|नही|रद्द|வேண்டாம்|இல்லை|ரத்து/i.test(value); }
function isSend(value: string) { return /send|submit|confirm|doctor|vaidya|भेज|डॉक्टर|वैद्य|அனுப்பு|மருத்துவர்|வைத்தியர்/i.test(value); }

function localizedOpening(language: GuideLanguage, destination: PatientGuideDestination) {
  const names: Record<GuideLanguage, Record<PatientGuideDestination, string>> = {
    English: { home: "Opening home.", directory: "Opening the Vaidya directory.", abha: "Opening ABHA.", voice: "Opening Voice to Vaidya.", intake: "Opening Ayurvedic case taking.", cases: "Opening your clinical cases.", emergency: "Opening emergency and beds.", blood: "Opening the blood bank.", appointments: "Opening appointments." },
    हिन्दी: { home: "होम खोल रही हूँ।", directory: "वैद्य सूची खोल रही हूँ।", abha: "आभा खोल रही हूँ।", voice: "वैद्य को आवाज़ खोल रही हूँ।", intake: "आयुर्वेदिक केस टेकिंग खोल रही हूँ।", cases: "आपके क्लिनिकल केस खोल रही हूँ।", emergency: "आपातकाल और बेड खोल रही हूँ।", blood: "ब्लड बैंक खोल रही हूँ।", appointments: "अपॉइंटमेंट खोल रही हूँ।" },
    தமிழ்: { home: "முகப்பைத் திறக்கிறேன்.", directory: "வைத்தியர் பட்டியலைத் திறக்கிறேன்.", abha: "ஆபாவைத் திறக்கிறேன்.", voice: "வைத்தியருக்கு குரல் பகுதியைத் திறக்கிறேன்.", intake: "ஆயுர்வேத கேஸ் டேக்கிங்கைத் திறக்கிறேன்.", cases: "உங்கள் மருத்துவ கேஸ்களைத் திறக்கிறேன்.", emergency: "அவசர சேவை மற்றும் படுக்கைகளைத் திறக்கிறேன்.", blood: "இரத்த வங்கியைத் திறக்கிறேன்.", appointments: "சந்திப்புகளைத் திறக்கிறேன்." },
  };
  return names[language][destination];
}

export function ContextAwareVoiceGuide({
  username, context, summary, onContinue, onReports, onSummary, onNavigate,
  onLanguageChange, onLogout, onAction,
}: {
  username: string; context: SessionWorkflowContext; summary: string;
  onContinue: () => void; onReports: () => void; onSummary: () => void;
  onNavigate: (destination: PatientGuideDestination) => void;
  onLanguageChange: (language: GuideLanguage) => void;
  onLogout: () => void | Promise<void>; onAction: (action: string) => void;
}) {
  const storageKey = `ayurdoc-guided-intake:${username}`;
  const [open, setOpen] = useState(true);
  const [listening, setListening] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [input, setInput] = useState("");
  const [heard, setHeard] = useState("");
  const [stage, setStage] = useState<GuidedVoiceStage>("name");
  const [draft, setDraft] = useState<GuidedVoiceDraft>(EMPTY_GUIDED_DRAFT);
  const [intakeActive, setIntakeActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState(() => guidedPrompt(context.selectedLanguage, "name"));
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recognitionEpochRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const interpretRef = useRef<(raw: string) => void>(() => undefined);
  const speakingRef = useRef(false);
  const mountedRef = useRef(true);
  const introducedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const activeLanguageRef = useRef(context.selectedLanguage);
  const currentLanguageRef = useRef(context.selectedLanguage);
  const autoModeRef = useRef(true);
  const openRef = useRef(true);
  const responseRef = useRef(response);
  const labels = COPY[context.selectedLanguage];
  const contextualMessage = useMemo(() => guideMessage(context), [context]);
  const referral = useMemo(() => routeGuidedConcern(draft.problem), [draft.problem]);

  currentLanguageRef.current = context.selectedLanguage;
  responseRef.current = response;

  function clearRestart() { if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  function clearAnswerTimer() { if (answerTimerRef.current) window.clearTimeout(answerTimerRef.current); answerTimerRef.current = null; }
  function stopRecognition() {
    clearRestart(); clearAnswerTimer(); recognitionEpochRef.current += 1;
    try { recognitionRef.current?.abort?.(); } catch { try { recognitionRef.current?.stop(); } catch { /* It may already be stopped. */ } }
    recognitionRef.current = null; setListening(false);
  }
  function commitTranscript(recognitionEpoch: number) {
    if (recognitionEpoch !== recognitionEpochRef.current) return;
    const answer = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, " ").trim();
    if (!answer) return;
    clearAnswerTimer();
    recognitionEpochRef.current += 1;
    try { recognitionRef.current?.stop(); } catch { /* Recognition may already be closed. */ }
    recognitionRef.current = null;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setListening(false);
    setHeard(answer);
    setResponse(COPY[currentLanguageRef.current].processing);
    window.setTimeout(() => interpretRef.current(answer), 180);
  }
  function startListening(automatic = false) {
    if (!openRef.current || (!autoModeRef.current && automatic) || speakingRef.current) return;
    const speechWindow = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setResponse(labels.unavailable); setAutoMode(false); autoModeRef.current = false; return; }
    stopRecognition(); const recognitionEpoch = recognitionEpochRef.current; const recognition = new Recognition();
    finalTranscriptRef.current = ""; interimTranscriptRef.current = ""; setHeard("");
    recognition.lang = languageCode(currentLanguageRef.current); recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => { if (recognitionEpoch === recognitionEpochRef.current) setListening(true); };
    recognition.onresult = (event) => {
      if (recognitionEpoch !== recognitionEpochRef.current) return;
      let finalText = ""; let interimText = "";
      const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index]; const words = result?.[0]?.transcript?.trim() ?? "";
        if (!words) continue;
        if (result.isFinal) finalText += `${words} `; else interimText += `${words} `;
      }
      if (finalText) finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.replace(/\s+/g, " ").trim();
      interimTranscriptRef.current = interimText.trim();
      const visible = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, " ").trim();
      if (visible) setHeard(visible);
      clearAnswerTimer();
      if (finalTranscriptRef.current) answerTimerRef.current = window.setTimeout(() => commitTranscript(recognitionEpoch), 1350);
    };
    recognition.onerror = (event) => {
      if (recognitionEpoch !== recognitionEpochRef.current) return;
      setListening(false);
      const currentLabels = COPY[currentLanguageRef.current];
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setResponse(currentLabels.blocked); setAutoMode(false); autoModeRef.current = false; return;
      }
      if (event.error === "audio-capture") { setResponse(currentLabels.audioError); setAutoMode(false); autoModeRef.current = false; return; }
      if (event.error === "no-speech") setResponse(currentLabels.noSpeech);
    };
    recognition.onend = () => {
      if (recognitionEpoch !== recognitionEpochRef.current) return;
      recognitionRef.current = null; setListening(false);
      if (finalTranscriptRef.current || interimTranscriptRef.current) {
        clearAnswerTimer(); answerTimerRef.current = window.setTimeout(() => commitTranscript(recognitionEpoch), 350); return;
      }
      if (autoModeRef.current && openRef.current && !speakingRef.current) restartTimerRef.current = window.setTimeout(() => startListening(true), 1500);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setListening(false); if (!automatic) setResponse(COPY[currentLanguageRef.current].blocked); }
  }
  function speak(text: string, listenAfter = autoModeRef.current, language = context.selectedLanguage) {
    if (!("speechSynthesis" in window)) { if (listenAfter) startListening(true); return; }
    stopRecognition(); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode(language); const prefix = utterance.lang.slice(0, 2).toLowerCase();
    const matchingVoice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(prefix));
    if (matchingVoice) utterance.voice = matchingVoice;
    utterance.rate = .76; utterance.volume = 1; speakingRef.current = true;
    utterance.onend = () => { speakingRef.current = false; if (listenAfter && mountedRef.current) restartTimerRef.current = window.setTimeout(() => startListening(true), 850); };
    utterance.onerror = () => { speakingRef.current = false; if (listenAfter && mountedRef.current) restartTimerRef.current = window.setTimeout(() => startListening(true), 850); };
    window.speechSynthesis.speak(utterance);
  }
  function ask(nextStage: GuidedVoiceStage, nextDraft = draft) {
    setStage(nextStage); setDraft(nextDraft); setInput(""); const question = guidedPrompt(context.selectedLanguage, nextStage); setResponse(question); speak(question);
  }
  function invalidAnswer() { const message = `${labels.invalid} ${guidedPrompt(context.selectedLanguage, stage)}`; setResponse(message); speak(message); }

  async function submitGuidedIntake() {
    if (submitting) return;
    setSubmitting(true); setResponse(labels.sending); speak(labels.sending, false);
    try {
      const responseFromApi = await fetch("/api/direct-voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: draft.name, age: draft.age, sex: draft.sex, phone: draft.phone,
          address: draft.address, problem: draft.problem, symptomDuration: draft.duration,
          severity: draft.severity, consent: draft.consent, language: context.selectedLanguage,
          department: referral.doctor.department, doctorId: referral.doctor.id,
          doctorName: referral.doctor.name, symptomCategory: referral.category,
        }),
      });
      const data = await responseFromApi.json().catch(() => ({})) as { error?: string };
      if (!responseFromApi.ok) throw new Error(data.error || labels.failed);
      setStage("submitted"); setIntakeActive(false); const sent = labels.sent.replace("{doctor}", referral.doctor.name);
      setResponse(sent); onAction("guided-voice-intake-submitted"); window.sessionStorage.removeItem(storageKey);
      speak(sent, false); onNavigate("voice");
    } catch (error) {
      const message = error instanceof Error && error.message ? `${labels.failed} ${error.message}` : labels.failed;
      setResponse(message); speak(message);
    } finally { setSubmitting(false); }
  }

  function recordAnswer(raw: string) {
    const nextDraft = { ...draft };
    if (stage === "name") { const value = cleanSpokenName(raw); if (value.length < 2) return invalidAnswer(); nextDraft.name = value; }
    else if (stage === "age") { const value = raw.replace(/^(?:i am|मेरी उम्र|என் வயது)\s+/i, "").trim(); if (!value || value.length > 30) return invalidAnswer(); nextDraft.age = value; }
    else if (stage === "sex") { const value = spokenSex(raw); if (!value) return invalidAnswer(); nextDraft.sex = value; }
    else if (stage === "phone") { const value = spokenPhone(raw); if (value.length !== 10 || /^(\d)\1{9}$/.test(value)) return invalidAnswer(); nextDraft.phone = value; }
    else if (stage === "address") { const value = raw.replace(/\s+/g, " ").trim(); if (value.length < 3) return invalidAnswer(); nextDraft.address = value; }
    else if (stage === "problem") {
      const value = raw.replace(/\s+/g, " ").trim(); if (value.length < 3) return invalidAnswer(); nextDraft.problem = value;
      if (hasEmergencyLanguage(value)) {
        setStage("duration"); setDraft(nextDraft); setInput("");
        const message = `${labels.emergency} ${guidedPrompt(context.selectedLanguage, "duration")}`;
        setResponse(message); speak(message); return;
      }
    }
    else if (stage === "duration") { const value = raw.replace(/\s+/g, " ").trim(); if (!value) return invalidAnswer(); nextDraft.duration = value; }
    else if (stage === "severity") { const value = spokenSeverity(raw); if (!value) return invalidAnswer(); nextDraft.severity = value; }
    else if (stage === "consent") { if (isNo(raw)) { setResponse(labels.noConsent); speak(labels.noConsent); return; } if (!isYes(raw)) return invalidAnswer(); nextDraft.consent = true; }
    else if (stage === "confirm") {
      const correction = stageForCorrection(raw);
      if (/change|correct|बदल|सुधार|மாற்று|திருத்து/i.test(raw) && correction) { setResponse(labels.correction); ask(correction); return; }
      if (isSend(raw) || isYes(raw)) { void submitGuidedIntake(); return; }
      return invalidAnswer();
    } else return;
    ask(nextGuidedStage(stage), nextDraft);
  }

  function openDestination(destination: PatientGuideDestination) {
    onNavigate(destination); onAction(`voice-opened-${destination}`); const answer = localizedOpening(context.selectedLanguage, destination); setResponse(answer); speak(answer);
  }
  function switchLanguage(language: GuideLanguage) {
    onLanguageChange(language); activeLanguageRef.current = language; const answer = COPY[language].language;
    setResponse(answer); onAction(`voice-language-${language}`); speak(`${answer} ${guidedPrompt(language, stage)}`, true, language);
  }
  function interpret(raw: string) {
    const command = raw.trim().toLocaleLowerCase(); if (!command) return;
    setInput(raw.trim()); setHeard(raw.trim());
    if (/change.*tamil|தமிழ்.*(?:மாற்று|மொழி)|तमिल.*(?:करो|भाषा)/i.test(command)) return switchLanguage("தமிழ்");
    if (/change.*hindi|हिंदी.*(?:करो|भाषा)|இந்தி.*(?:மாற்று|மொழி)/i.test(command)) return switchLanguage("हिन्दी");
    if (/change.*english|अंग्रेज़ी.*(?:करो|भाषा)|ஆங்கில.*(?:மாற்று|மொழி)/i.test(command)) return switchLanguage("English");
    if (/logout|log out|sign out|लॉग आउट|साइन आउट|வெளியேறு|லாக் அவுட்/i.test(command)) { setResponse(labels.logout); speak(labels.logout, false); stopRecognition(); void onLogout(); return; }
    if (/stop listening|stop voice|चुप|सुनना बंद|நிறுத்து|கேட்பதை நிறுத்து/.test(command)) { setAutoMode(false); autoModeRef.current = false; stopRecognition(); setResponse(labels.stopped); speak(labels.stopped, false); return; }
    if (/start.*(?:health|question|intake)|health.*question|स्वास्थ्य.*(?:प्रश्न|शुरू)|உடல்நல.*(?:கேள்வி|தொடங்கு)/i.test(command)) {
      const nextStage = stage === "submitted" ? "name" : stage; const nextDraft = stage === "submitted" ? EMPTY_GUIDED_DRAFT : draft;
      setIntakeActive(true); ask(nextStage, nextDraft); return;
    }
    if (/cancel intake|pause intake|रद्द|रोक|பதிவை ரத்து|இடைநிறுத்து/i.test(command) && intakeActive) { setIntakeActive(false); setResponse(labels.cancelled); speak(labels.cancelled); return; }
    if (/go back|previous question|पीछे|पिछला प्रश्न|முந்தைய கேள்வி|பின்னால்/i.test(command) && intakeActive) return ask(previousGuidedStage(stage));
    if (/repeat|say again|फिर|दोहर|மீண்டும்/i.test(command)) { const message = intakeActive ? guidedPrompt(context.selectedLanguage, stage) : contextualMessage; setResponse(message); speak(message); return; }
    if (/help|options|मदद|विकल्प|உதவி|விருப்பம்/.test(command)) { setResponse(labels.help); onAction("voice-requested-navigation-help"); speak(labels.help); return; }
    const explicitOpen = /open|take me|go to|show|खोल|ले चल|दिखा|திற|அழைத்துச் செல்|காட்டு/i.test(command);
    if (explicitOpen && /emergency|ambulance|bed|आपात|एम्बुलेंस|बेड|அவசர|ஆம்புலன்ஸ்|படுக்கை/.test(command)) return openDestination("emergency");
    if (explicitOpen && /blood|donor|रक्त|ब्लड|இரத்த|தானம்/.test(command)) return openDestination("blood");
    if (explicitOpen && /appointment|video|book|अपॉइंटमेंट|वीडियो|சந்திப்பு|வீடியோ/.test(command)) return openDestination("appointments");
    if (explicitOpen && /voice|message|वैद्य.*आवाज़|डॉक्टर.*संदेश|வைத்திய.*குரல்/.test(command)) return openDestination("voice");
    if (explicitOpen && /my case|case status|मेरे केस|केस स्थिति|என் கேஸ்|கேஸ் நிலை/.test(command)) return openDestination("cases");
    if (explicitOpen && /abha|आभा|ஆபா/.test(command)) return openDestination("abha");
    if (explicitOpen && /doctor|vaidya|डॉक्टर|वैद्य|மருத்துவர்|வைத்தியர்/.test(command)) return openDestination("directory");
    if (explicitOpen && /home|main page|होम|मुख्य पेज|முகப்பு|முதன்மை/.test(command)) return openDestination("home");
    if (explicitOpen && /case taking|clinical intake|केस टेकिंग|கேஸ் டேக்கிங்/.test(command)) return openDestination("intake");
    if (explicitOpen && /report|document|record|रिपोर्ट|दस्तावेज|அறிக்கை|ஆவணம்/.test(command)) { onReports(); onAction("voice-opened-reports"); setResponse(contextualMessage); speak(contextualMessage); return; }
    if (/read.*summary|सारांश.*पढ़|சுருக்க.*படி/.test(command)) { onSummary(); const answer = context.summaryStatus === "not-ready" ? contextualMessage : summary; setResponse(answer); speak(answer); return; }
    if (/what.*next|what should|क्या.*कर|अगला.*क्या|அடுத்து.*என்ன|என்ன.*செய்ய/.test(command)) { const answer = intakeActive ? guidedPrompt(context.selectedLanguage, stage) : contextualMessage; setResponse(answer); speak(answer); return; }
    if (!intakeActive && /continue|next|आगे|जारी|अगला|தொடர|அடுத்து/.test(command)) { onContinue(); setResponse(contextualMessage); speak(contextualMessage); return; }
    if (intakeActive) return recordAnswer(raw);
    setResponse(labels.help); speak(labels.help);
  }

  interpretRef.current = interpret;

  useEffect(() => {
    mountedRef.current = true;
    let restoreTimer: number | null = null;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") as { stage?: GuidedVoiceStage; draft?: GuidedVoiceDraft; intakeActive?: boolean } | null;
      if (saved?.stage && saved?.draft) restoreTimer = window.setTimeout(() => {
        setStage(saved.stage!); setDraft(saved.draft!); setIntakeActive(saved.intakeActive !== false);
        const restoredPrompt = saved.intakeActive === false ? contextualMessage : guidedPrompt(context.selectedLanguage, saved.stage!);
        setResponse(restoredPrompt);
      }, 0);
    } catch { /* A damaged draft never blocks the guide. */ }
    return () => { if (restoreTimer) window.clearTimeout(restoreTimer); mountedRef.current = false; clearRestart(); clearAnswerTimer(); try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ } window.speechSynthesis?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (stage !== "submitted") window.sessionStorage.setItem(storageKey, JSON.stringify({ stage, draft, intakeActive })); }, [draft, intakeActive, stage, storageKey]);
  useEffect(() => {
    const autoStartTimer = window.setTimeout(() => {
      if (autoStartedRef.current || !mountedRef.current) return;
      autoStartedRef.current = true;
      setOpen(true); openRef.current = true;
      setAutoMode(true); autoModeRef.current = true;
      speak(responseRef.current, true);
    }, 650);
    return () => window.clearTimeout(autoStartTimer);
    // The guide intentionally starts once when the authenticated patient view mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (introducedRef.current) {
      if (activeLanguageRef.current !== context.selectedLanguage) {
        activeLanguageRef.current = context.selectedLanguage; stopRecognition(); const prompt = intakeActive ? guidedPrompt(context.selectedLanguage, stage) : contextualMessage;
        setResponse(prompt); if (openRef.current) { const timer = window.setTimeout(() => speak(prompt, true), 200); return () => window.clearTimeout(timer); }
      }
      return;
    }
    introducedRef.current = true; activeLanguageRef.current = context.selectedLanguage; const welcome = intakeActive ? guidedPrompt(context.selectedLanguage, stage) : contextualMessage;
    setResponse(welcome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.selectedLanguage]);

  function setPanelOpen(value: boolean) {
    setOpen(value); openRef.current = value;
    if (!value) { autoStartedRef.current = true; setAutoMode(false); autoModeRef.current = false; stopRecognition(); window.speechSynthesis?.cancel(); return; }
    setAutoMode(true); autoModeRef.current = true; speak(response, true);
  }
  function enableHandsFree() { setAutoMode(true); autoModeRef.current = true; startListening(false); }
  const capturedCount = [draft.name, draft.age, draft.sex, draft.phone, draft.address, draft.problem, draft.duration, draft.severity].filter(Boolean).length;

  if (!open) return <button type="button" className="context-guide-launcher" onClick={() => setPanelOpen(true)} aria-label={labels.title}><Mic size={27} /><span>{labels.title}</span><small>{labels.auto}</small></button>;
  return (
    <aside className="context-voice-guide" aria-live="polite">
      <header><span className={listening ? "context-guide-icon listening" : "context-guide-icon"}><Ear size={23} /></span><div><strong>{labels.title}</strong><small>{listening ? labels.listening : autoMode ? labels.auto : labels.stopped}</small></div><button type="button" onClick={() => setPanelOpen(false)} aria-label={labels.close}><X size={21} /></button></header>
      {heard && <div className="context-heard-caption"><Mic size={15} /><span><small>{labels.heard}</small><strong>{heard}</strong></span></div>}
      <p>{response}</p>
      <div className="context-guide-progress" aria-label={`${guidedProgress(stage)}% complete`}><span style={{ width: `${intakeActive ? guidedProgress(stage) : context.caseCompletion}%` }} /></div>
      {intakeActive && stage !== "submitted" && <div className="guided-intake-status"><span><strong>{capturedCount}/8</strong>{labels.captured}</span>{draft.problem && <span><strong>{referral.doctor.name}</strong>{labels.routed}</span>}</div>}
      {!intakeActive && <button type="button" className="context-start-intake" onClick={() => { const nextStage = stage === "submitted" ? "name" : stage; const nextDraft = stage === "submitted" ? EMPTY_GUIDED_DRAFT : draft; setIntakeActive(true); ask(nextStage, nextDraft); }}><Mic size={20} /> {labels.start}</button>}
      <div className="context-guide-quick-grid" aria-label="Quick navigation">
        <button type="button" onClick={() => openDestination("home")}><Navigation size={20} /><span>{context.selectedLanguage === "हिन्दी" ? "होम" : context.selectedLanguage === "தமிழ்" ? "முகப்பு" : "Home"}</span></button>
        <button type="button" onClick={() => openDestination("voice")}><Mic size={20} /><span>{context.selectedLanguage === "हिन्दी" ? "वैद्य को बोलें" : context.selectedLanguage === "தமிழ்" ? "வைத்தியரிடம் பேசு" : "Voice to Vaidya"}</span></button>
        <button type="button" onClick={() => openDestination("emergency")}><CheckCircle2 size={20} /><span>{context.selectedLanguage === "हिन्दी" ? "आपात सहायता" : context.selectedLanguage === "தமிழ்" ? "அவசர உதவி" : "Emergency"}</span></button>
      </div>
      <div className="context-guide-visual-actions">
        <button type="button" className="guide-hear" onClick={() => speak(response)}><Volume2 size={22} /><span>{labels.hear}</span></button>
        <button type="button" className={listening ? "guide-listen active" : "guide-listen"} onClick={listening ? () => { setAutoMode(false); autoModeRef.current = false; stopRecognition(); } : enableHandsFree}>{listening ? <Square size={21} /> : <Mic size={24} />}<span>{listening ? labels.stop : labels.listen}</span></button>
        <button type="button" onClick={() => speak(intakeActive ? guidedPrompt(context.selectedLanguage, stage) : labels.help)}><Repeat2 size={21} /><span>{labels.repeat}</span></button>
      </div>
      {intakeActive && stage !== "name" && stage !== "submitted" && <button type="button" className="context-next-question" onClick={() => ask(previousGuidedStage(stage))}><ArrowLeft size={18} /> {labels.back}</button>}
      {stage === "confirm" && <button type="button" className="context-submit-intake" onClick={() => void submitGuidedIntake()} disabled={submitting}><Send size={18} /> {labels.confirm}</button>}
      <form onSubmit={(event) => { event.preventDefault(); interpret(input); }}><Keyboard size={18} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={labels.placeholder} /><button type="submit" aria-label={labels.send}><ArrowRight size={18} /></button></form>
    </aside>
  );
}
