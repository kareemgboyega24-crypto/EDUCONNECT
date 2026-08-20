# EduConnect

A lecturer–student communication platform: assessment submissions, feedback comments, document sharing, weekly timetables, and live group video/audio calls with screen share.

## What's included

| Requirement | How it's implemented |
|---|---|
| 1. Report submission + feedback | Students create an **Assessment**, attach a document; lecturer reviews, comments, attaches feedback docs, sets status/grade |
| 2. Timetable | Lecturers add weekly time slots per course; students/lecturers see a combined weekly view |
| 3. Login + signup, both roles | JWT auth, role selection (`lecturer` / `student`) at signup |
| 4. Comments on feedback + send documents to student | Real-time comment thread per assessment (Socket.io) + document upload works both directions |
| 5. Video/audio group calls + screen share | Browser WebRTC (mesh) signaled over Socket.io — no paid service required to run |

## Project structure

```
educonnect/
├── backend/     Node.js + Express + Sequelize (SQLite) + Socket.io
└── frontend/    React + Vite + Tailwind
```

## Running it locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # edit JWT_SECRET at minimum
npm run dev                # http://localhost:5000
```
SQLite auto-creates `educonnect.sqlite` on first run — no separate database install needed.

**Optional: seed demo data** instead of manually signing up twice:
```bash
npm run seed
```
This creates one lecturer, two students, an enrolled course, two timetable slots, and one submitted assessment with a starter comment — all accounts use password `password123`:
- `teacher@educonnect.dev`
- `student1@educonnect.dev` (has the sample submission)
- `student2@educonnect.dev`

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env       # defaults already point at localhost:5000
npm run dev                 # http://localhost:5173
```

Open two browser windows (or one normal + one incognito) — sign up as a lecturer in one, a student in the other (or just log in with the seeded accounts above), to try the full loop:

1. Lecturer signs up → creates a course → copies the course ID from the dashboard card
2. Student signs up → "Join a course" → pastes the course ID
3. Lecturer adds timetable slots for the course
4. Student creates an assessment submission and uploads a report document
5. Lecturer opens the assessment → comments, uploads feedback doc, sets grade/status
6. Either can hit "Start call" to open a group video/audio room with screen share

## How the video call works

No third-party video SDK is required to run this — it uses the browser's native WebRTC APIs directly:
- Each participant grabs their camera/mic via `getUserMedia`
- The Node server just relays signaling messages (`offer`/`answer`/ICE candidates) over Socket.io — it never touches media itself
- Peers connect directly to each other in a **mesh** topology (fine for small groups — a class discussion or feedback session; for large lecture-style calls with 15+ people, a mesh gets expensive on bandwidth and you'd want an SFU)
- Screen sharing uses `getDisplayMedia` and swaps the outgoing video track on the fly with `replaceTrack`, so it works mid-call without renegotiating from scratch

## Deploying on your Azure student account

This was built so each piece maps cleanly onto Azure services:

| Piece | Azure service | Notes |
|---|---|---|
| Backend API + Socket.io | **App Service** (Linux, Node 20) | Enable **WebSockets** in App Service → Configuration → General settings, or Socket.io falls back to slow polling |
| Frontend | **Static Web Apps** | Free tier is generous for student projects; auto-builds from `frontend/` |
| Database | **Azure SQL Database** (free tier) | Swap `backend/config/db.js` dialect from `sqlite` to `mssql`, install `tedious`, point at your connection string. No model/route code changes needed — that's the point of using Sequelize. |
| File uploads | **Azure Blob Storage** | Set `STORAGE_DRIVER=azure` and `AZURE_STORAGE_CONNECTION_STRING` in `.env`; see the comment block in `backend/config/storage.js` for the two-line swap |
| Video calls at scale | **Azure Communication Services** | The current mesh WebRTC works out of the box for small groups. If you later need large multi-party calls, reliable TURN traversal, or recording, ACS's Calling SDK can replace the client-side WebRTC logic in `CallRoom.jsx` — the Socket.io signaling layer becomes unnecessary since ACS handles that internally. |

**Quick TURN tip:** the demo only configures a public STUN server. If calls fail to connect from restrictive networks (some campus wifi does this), add a TURN server to the `ICE_SERVERS` array in `frontend/src/pages/CallRoom.jsx` — Azure Communication Services can issue you free TURN credentials even if you don't use the rest of ACS.

## Environment variables

**backend/.env**
```
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
STORAGE_DRIVER=local
```

**frontend/.env**
```
VITE_API_URL=http://localhost:5000
```

## Notes / things to harden before a real production launch

- Password reset / email verification aren't implemented (out of scope for a course project, but flag it if this graduates beyond that)
- File upload validation currently only caps size (25MB) — add MIME-type allowlisting if you want to be strict about what students can upload
- The mesh WebRTC approach doesn't scale past roughly 6-8 simultaneous video participants; fine for lecturer+small group feedback sessions
