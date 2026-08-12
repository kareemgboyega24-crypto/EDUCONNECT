require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { initDb, Course, Attendance } = require('./models');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const timetableRoutes = require('./routes/timetable');
const assessmentRoutes = require('./routes/assessments');
const documentRoutes = require('./routes/documents');
const commentRoutes = require('./routes/comments');
const turnRoutes = require('./routes/turn');

const app = express();
const server = http.createServer(app);

// Safety net: an uncaught error in one request should never take down the whole
// server (which would drop every connected user's session). Node 15+ crashes the
// process by default on an unhandled promise rejection - we log instead so the one
// bad request fails, but the server keeps running for everyone else.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (server stayed up):', reason);
});

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/turn-credentials', turnRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Socket.io: signaling for group audio/video calls + screen share, and live comment updates ---
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] }
});
app.set('io', io);

// roomId -> Map<socketId, { socketId, userId, fullName, role, handRaised }>
const roomParticipants = new Map();

io.on('connection', (socket) => {
  // Join a live discussion channel for an assessment (so comments push in real time)
  socket.on('join_assessment_room', (assessmentId) => {
    socket.join(`assessment:${assessmentId}`);
  });

  // --- Call room signaling ---
  // A "call room" is scoped to a courseId (group call for the whole class)
  // or an assessmentId (1:1 feedback call). The client picks the roomId string.
  socket.on('call:join', async ({ roomId, userId, fullName, role }) => {
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.fullName = fullName;
    socket.data.role = role;
    socket.join(roomId);

    if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Map());
    const participants = roomParticipants.get(roomId);

    // Tell the newcomer who's already in the room, so they can initiate WebRTC offers to each
    const existing = Array.from(participants.values());
    socket.emit('call:existing-participants', existing);

    participants.set(socket.id, { socketId: socket.id, userId, fullName, role, handRaised: false });

    // Tell everyone else a new participant joined
    socket.to(roomId).emit('call:participant-joined', { socketId: socket.id, userId, fullName, role, handRaised: false });

    // Attendance: only recorded when the room is a course-wide call (roomId === a real course id).
    // Assessment-scoped 1:1 calls (roomId === an assessment id) aren't tracked as class attendance.
    try {
      const course = await Course.findByPk(roomId);
      if (course && role) {
        const record = await Attendance.create({ courseId: roomId, userId, fullName, role, joinedAt: new Date() });
        socket.data.attendanceId = record.id;
      }
    } catch (err) {
      console.error('Attendance record failed (call continues normally):', err);
    }
  });

  // WebRTC offer/answer/ICE relay - always targeted at one peer (mesh topology)
  socket.on('call:signal', ({ to, signal }) => {
    io.to(to).emit('call:signal', { from: socket.id, signal });
  });

  socket.on('call:screen-share-toggle', ({ roomId, sharing }) => {
    socket.to(roomId).emit('call:screen-share-toggle', { socketId: socket.id, sharing });
  });

  // Transient reactions (👍 ❤️ 😂 🎉 etc) - just relayed, not persisted
  socket.on('call:reaction', ({ roomId, emoji }) => {
    io.to(roomId).emit('call:reaction', { socketId: socket.id, fullName: socket.data.fullName, emoji });
  });

  // Raise hand is persistent state (so late joiners can see who currently has a hand up)
  socket.on('call:hand-toggle', ({ roomId, raised }) => {
    const participants = roomParticipants.get(roomId);
    const entry = participants?.get(socket.id);
    if (entry) entry.handRaised = raised;
    io.to(roomId).emit('call:hand-toggle', { socketId: socket.id, raised });
  });

  socket.on('call:leave', () => {
    leaveCall(socket);
  });

  socket.on('disconnect', () => {
    leaveCall(socket);
  });

  async function leaveCall(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const participants = roomParticipants.get(roomId);
    if (participants) {
      participants.delete(socket.id);
      if (participants.size === 0) roomParticipants.delete(roomId);
    }
    socket.to(roomId).emit('call:participant-left', { socketId: socket.id });
    socket.leave(roomId);
    socket.data.roomId = null;

    if (socket.data.attendanceId) {
      try {
        await Attendance.update({ leftAt: new Date() }, { where: { id: socket.data.attendanceId } });
      } catch (err) {
        console.error('Failed to record attendance leave time:', err);
      }
      socket.data.attendanceId = null;
    }
  }
});

const PORT = process.env.PORT || 5000;

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`EduConnect API + signaling server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
