# EduConnect

A lecturer–student communication platform: assessment submissions, feedback comments, document sharing, weekly timetables, auto-graded quizzes, an AI study helper, and live group video/audio calls with screen share.

**Live demo:** [edduconnect.com](https://edduconnect.com)
*(Runs on a free hosting tier that sleeps after 15 minutes idle — the first request after a quiet period can take 30-50 seconds to respond.)*

## What's included

| Requirement | How it's implemented |
|---|---|
| Assessment submission + feedback | Students create an **Assessment**, attach a document; lecturer reviews, comments, attaches feedback docs, sets status/grade |
| Timetable | Lecturers add weekly time slots per course; students/lecturers see a combined weekly view |
| Login + signup, both roles | JWT auth, role selection (`lecturer` / `student`) at signup, email verification and password reset via Resend |
| Comments + document exchange | Real-time comment thread per assessment (Socket.io) + document upload works both directions |
| Video/audio group calls + screen share | Browser WebRTC (mesh) signaled over Socket.io — no paid service required to run |
| Quizzes | Auto-graded multiple-choice and manually-graded short-answer questions, bulk-assignable to an entire class at once |
| AI study helper | Context-aware chat scoped to a specific assessment; deliberately withholds correct answers to support learning rather than replace it |
| Admin oversight | A dedicated admin role for account management, course moderation, and platform-wide usage stats |
| Announcements + notifications | Course-wide announcements, auto-posted on new assessment assignment, plus a per-user notification bell for grades and comments |
| Attendance | Per-course, per-session attendance automatically logged from call join/leave events, with live student ID lookup |
| Grade export | CSV export per course, including each student's institutional ID number |

## Project structure

backend/    Node.js + Express + Sequelize (PostgreSQL / SQLite) + Socket.io
frontend/   React + Vite + Tailwind

## Running it locally

**Backend**: cd backend && npm install && cp .env.example .env && npm run dev
With no DATABASE_URL set, SQLite auto-creates educonnect.sqlite on first run.

**Optional: seed demo data** instead of manually signing up twice: npm run seed

This creates one admin, one lecturer, two students, an enrolled course, and a sample assessment - all accounts use password `password123`:
- admin@educonnect.dev
- teacher@educonnect.dev (lecturer)
- student1@educonnect.dev (has the sample submission)
- student2@educonnect.dev

**Frontend**: cd frontend && npm install && cp .env.example .env && npm run dev

## How the video call works

No third-party video SDK is required - it uses the browsers native WebRTC APIs directly, with the Node server only relaying signaling messages over Socket.io. Peers connect directly in a mesh topology, fine for small groups. Screen sharing uses getDisplayMedia and swaps the video track live. A free TURN relay (Metered.ca) handles connections across restrictive networks.

## Deployment

The original build ran entirely on an Azure for Students subscription. That subscription was disabled without warning once its grant period ended, forcing a full migration to independent, permanently-free infrastructure across multiple providers.

**Backend API + Socket.io:** Render (free web service), deployed via a render.yaml Blueprint at the repo root. Free tier sleeps after 15 min idle. Notably, Render blocks all outbound SMTP traffic (ports 25/465/587) as an anti-spam measure - this is why email sends over Resend HTTP API instead of raw SMTP.

**Frontend:** Cloudflare Workers (static assets), deployed via frontend/wrangler.jsonc, connected to this repo for auto-deploy on push. A custom domain is connected under the projects Custom Domains settings.

**Database:** Render PostgreSQL (free tier). Swap backend/config/db.js dialect based on DATABASE_URL being set - no model/route code changes needed, thats the point of using Sequelize.

**File uploads:** Backblaze B2 (S3-compatible, free tier). Set STORAGE_DRIVER=b2 plus the B2_* variables below. Falls back to local disk if unset - fine for local dev, but Renders free disk is ephemeral, so B2 is required for anything meant to persist in production.

**Transactional email:** Resend (HTTP API, free tier). Used for signup verification codes and password resets. Requires a verified sending domain - free-tier providers generally wont send to arbitrary recipients from an unverified domain, so this needs a real domain you control.

**TURN relay:** Metered.ca (free tier). Unrelated to the migration - used since the original build for WebRTC connectivity across restrictive networks.

## Environment variables

**backend/.env**
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
DATABASE_URL=  (leave unset for local SQLite; set for PostgreSQL)
STORAGE_DRIVER=local  (local or b2)
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
B2_ENDPOINT=
RESEND_API_KEY=  (required for signup/password reset emails)
METERED_SUBDOMAIN=
METERED_API_KEY=
ADMIN_INVITE_CODE=  (secret code for admin self-signup)
GROQ_API_KEY=  (powers the AI study helper)

**frontend/.env**
VITE_API_URL=http://localhost:5000

## Notes / things to harden before a real production launch

- File upload validation currently only caps size (25MB) - add MIME-type allowlisting if you want to be strict about what students can upload
- The mesh WebRTC approach doesnt scale past roughly 6-8 simultaneous video participants; fine for lecturer+small group feedback sessions
- Free-tier hosting means real trade-offs: Renders backend sleeps after inactivity, and Backblaze B2 storage isnt yet fully wired up in production (an AWS SDK compatibility quirk with non-AWS S3-compatible providers is still being worked through) - production currently runs on Renders ephemeral local disk as an interim measure
