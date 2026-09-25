# EduConnect

A lecturer–student communication platform: assessment submissions, feedback comments, document sharing, weekly timetables, auto-graded quizzes, an AI study helper, and live group video/audio calls with screen share.

**Live demo:** [edduconnect.com](https://edduconnect.com)
*(Backend runs on Azure App Service with Always On enabled — no cold-start delay.)*

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

The original build ran on an Azure for Students subscription. When that subscription was disabled without warning, the project was migrated to independent infrastructure (Render, Cloudflare, PostgreSQL, Backblaze B2) as a temporary measure. After renewing Azure access, the live deployment was rebuilt on Azure - the same environment-driven storage/database abstraction that enabled the first migration made this second move possible with zero code changes.

**Backend API + Socket.io:** Azure App Service (Linux, Node.js 22). WebSockets and Always On are enabled in App Service Configuration - required for Socket.io to work correctly rather than falling back to slow polling.

**Frontend:** Azure Blob Storage static website hosting. A custom domain is connected directly to the storage account, via a CNAME on a subdomain since a true CNAME is not valid at a domain root per DNS standards, with Cloudflare providing HTTPS termination since Azure CDN and Front Door are unavailable on Azure for Students subscriptions.

**Database:** Azure SQL Database (serverless, auto-pausing). Swap backend/config/db.js dialect based on DB_DIALECT being set - no model/route code changes needed, thats the point of using Sequelize.

**File uploads:** Azure Blob Storage (documents container). Set STORAGE_DRIVER=azure plus AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER below.

**Transactional email:** Resend (HTTP API, free tier), unchanged from the interim setup. Used for signup verification codes and password resets. Requires a verified sending domain.

**TURN relay:** Metered.ca (free tier), unchanged since the original build - used for WebRTC connectivity across restrictive networks.

**Also supported (used during the interim migration, code paths kept working):** Render (backend), Cloudflare Workers (frontend), Render PostgreSQL (database), Backblaze B2 (file storage). Selecting between Azure and this alternative stack is purely an environment-variable choice.

## Environment variables

**backend/.env**
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d

# Database - leave both unset for local SQLite
DB_DIALECT=mssql  (for Azure SQL Database)
AZURE_SQL_SERVER=
AZURE_SQL_DATABASE=
AZURE_SQL_USER=
AZURE_SQL_PASSWORD=
DATABASE_URL=  (alternative: set for PostgreSQL instead of DB_DIALECT)

# Storage - azure | local | b2
STORAGE_DRIVER=azure
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=documents
B2_KEY_ID=  (alternative: Backblaze B2)
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
- The alternative Render/Cloudflare/PostgreSQL/B2 stack documented above was used during a temporary migration and is no longer the live deployment, though the code paths remain functional and were validated end-to-end during that period
