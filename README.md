# AyurDoc – AI-Powered Patient Case-Taking Platform

AyurDoc is a multilingual, AI-assisted patient case-taking platform developed by Team MedZone for Smart India Hackathon 2026.

Live Application:  
https://ayurdoc.rozan-adhikari07.workers.dev/

## Demo Credentials

Patient Portal:

Username: patient  
Password: 123456  

Doctor Portal:

Username: doctor  
Password: 123456  


## Problem

Traditional patient history-taking is time-consuming and difficult for elderly, low-literacy, and multilingual patients. Doctors often receive incomplete or unstructured information, increasing consultation time and affecting care coordination.


## Solution

AyurDoc enables patients to provide their medical history through guided forms, voice interaction, and document uploads. The platform converts this information into a structured clinical summary that can be reviewed and verified by the selected Vaidya or doctor.


## Key Features

- Separate Patient, Doctor, and Admin portals
- Direct patient registration with email OTP verification
- English, Hindi, and Tamil language support
- Voice-guided patient case-taking
- AyurAI-powered preliminary triage and patient assistance
- Structured Ayurveda-focused clinical intake
- Voice-to-Vaidya messages with multilingual transcription
- Prescription and laboratory-report analysis
- Nine-department Ayurveda doctor directory
- Appointment booking and video consultation
- ABHA profile and FHIR-ready structured data
- Doctor review, correction, confirmation, or clarification workflow
- Professional PDF clinical reports delivered through email
- Emergency beds, ambulance, blood-bank, and donation modules
- Consent records, audit trail, biometric login, and role-based access
- Centralised administration for accounts, credentials, records, and hospital resources


## Workflow

1. The patient registers or signs in.
2. AyurDoc collects the patient’s details and health concerns.
3. The patient completes the clinical intake using text or voice.
4. Medical documents can be uploaded for AI-assisted analysis.
5. The system recommends a suitable Ayurveda department.
6. The case is forwarded to the selected Vaidya.
7. The Vaidya reviews, edits, confirms, or requests clarification.
8. A verified clinical report is generated and emailed to the patient.


## Technology Stack

- React, TypeScript, Tailwind CSS and Vite
- Cloudflare Workers and Cloudflare D1
- OpenAI API for AyurAI, transcription, and document intelligence
- Resend API for OTP and report emails
- WebAuthn for passkey and biometric authentication
- FHIR-ready healthcare data structure





## Local Setup

Requirements:

- Node.js 22.13 or newer
- npm
- Chrome or Microsoft Edge

Commands:

npm install
npm run db:setup:local
npm run dev

Open:

http://localhost:5173/


## Clinical Safety

AyurAI provides preliminary guidance, department recommendations, and consultation preparation. It does not provide a final diagnosis or prescription. All clinical information must be reviewed and confirmed by a qualified Vaidya or doctor.


Developed by Team MedZone.
