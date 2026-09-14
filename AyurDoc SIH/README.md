# AyurDoc — SIH 2026 Clinical Platform

AyurDoc is a full-stack, multilingual patient–Vaidya coordination application. It supports patient and doctor portals, an administration control centre, Ayurveda-focused clinical intake, voice-to-Vaidya messages, appointments, browser video rooms, ABHA profiles, document review, FHIR previews, emergency/bed workflows, blood-bank workflows, consent, audit records, and physician-verified PDF reports delivered by email.

## Requirements

- Node.js 22.13 or newer
- npm
- Chrome or Microsoft Edge recommended for speech recognition
- Microphone and camera permission for voice/video features

## Run locally

1. Extract the ZIP and open a terminal inside the `AyurDoc` folder.
2. Install dependencies with `npm install`.
3. Optional: copy `.dev.vars.example` to `.dev.vars` and enter a Resend API key and verified sender address. This enables real Gmail OTP and physician-report email delivery.
4. Start the application with `npm run dev`.
5. Open the local address displayed in the terminal, normally `http://localhost:5173`.

The development server provisions a local Cloudflare-compatible D1 database. This D1-only edition stores structured records and small uploaded files in the same database. Local data is separate from the production database.

## Demo accounts

All demo passwords are `123456`.

### Patients

`patient`, `rojan`, `karan`, `sachin`, `gaurav`, `deepak`, `dharani`

### Nine department Vaidyas

| Username | Doctor | Department |
| --- | --- | --- |
| `ananyasharma` | Dr. Ananya Sharma | Kayachikitsa |
| `rohandas` | Dr. Rohan Das | Twacha Roga & Dermatology |
| `vikramsingh` | Dr. Vikram Singh | Shalya Tantra |
| `farahkhan` | Dr. Farah Khan | Prasuti Tantra & Stri Roga |
| `ayeshajoseph` | Dr. Ayesha Joseph | Shalakya Tantra |
| `aditirao` | Dr. Aditi Rao | Kaumarabhritya / Bala Roga |
| `naveenpatil` | Dr. Naveen Patil | Panchakarma & Rehabilitation |
| `anjaliverma` | Dr. Anjali Verma | Swasthavritta & Yoga |
| `arunalal` | Dr. Aruna Lal | Manasa Roga |

### Hospital-wide supervisor

- Username: `doctor`
- Password: `123456`
- Access: all patient clinical histories across all assigned Vaidyas

### Administrator

- Username: `admin`
- Password: `123456`
- Open from the shield icon on the login page. Administration opens in a separate tab.

## Email configuration

Create `.dev.vars` with:

```text
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=AyurDoc <reports@your-verified-domain.com>
```

Do not commit or share `.dev.vars`. Resend requires the sender domain to be verified before it can deliver reports to arbitrary patient addresses. Without these settings, every other module continues to work and clinical confirmation reports that email delivery is not configured.

## Included modules

- Direct patient registration with Gmail OTP, required government-ID upload and immediate portal access
- Doctor credentialing application and administrator verification
- ABHA profile and verification status
- English, Hindi and Tamil interface support
- Ayurvedic clinical intake with editable/deletable patient records
- Voice-to-Vaidya audio, browser captions and multilingual summary routing
- Nine-department Vaidya directory and appointment booking
- Patient/doctor video consultation rooms
- Patient EHR, physician edit/confirm/reject workflow and clarification requests
- Professional PDF report emailed after physician confirmation
- Medical-document upload and assisted review feedback
- FHIR Bundle preview, consent records and audit trail
- Emergency/bed request and blood-bank/donation workflows
- AyurAI guided triage with text, speech input, spoken replies and references
- Administration dashboard for accounts, credentials, ABHA, records and inventory

## D1-only file storage

This edition does not require Cloudflare R2. Voice recordings, government IDs,
credential documents and clinical attachments are stored in the `stored_files`
D1 table. Each file is limited to 1.5 MB because Cloudflare D1 has a 2 MB
maximum BLOB/row size. This design is intended for the SIH prototype; a
production hospital deployment should use encrypted object storage.

## First local run

Create the local schema before starting the application:

```bash
npm run db:setup:local
npm run dev
```

## Cloudflare deployment

This project is already configured for D1 database `ayurdoc-db` with database
ID `e6dc411f-d8ed-4497-93dc-f8df564fafac`.

Use these Cloudflare Git build settings:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Node version: 22.13.0 or newer
```

Apply the production schema once before first use:

```bash
npm run db:setup:remote
```

No R2 subscription or bucket is required.

## Production build

Run `npm run build`.

The application targets a Cloudflare Workers-compatible environment and uses D1 for both structured data and size-limited uploaded files.

## Clinical safety

AyurAI provides preliminary routing, general safety information and consultation preparation. It does not provide a final diagnosis or prescribe treatment. The Vaidya remains responsible for reviewing and confirming clinical information.

Med Zone · AyurDoc
