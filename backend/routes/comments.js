const express = require('express');
const { Assessment, Course, Comment, User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function canAccessAssessment(user, assessmentId) {
  const assessment = await Assessment.findByPk(assessmentId, { include: Course });
  if (!assessment) return null;
  const isOwnerStudent = user.role === 'student' && assessment.studentId === user.id;
  const isCourseTeacher = user.role === 'teacher' && assessment.Course.teacherId === user.id;
  return (isOwnerStudent || isCourseTeacher) ? assessment : null;
}

// POST /api/comments/:assessmentId - add a comment to an assessment's feedback thread
router.post('/:assessmentId', async (req, res) => {
  const assessment = await canAccessAssessment(req.user, req.params.assessmentId);
  if (!assessment) return res.status(403).json({ error: 'Forbidden' });

  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

  const comment = await Comment.create({ assessmentId: assessment.id, authorId: req.user.id, body: body.trim() });
  const full = await Comment.findByPk(comment.id, { include: [{ model: User, as: 'author', attributes: ['id', 'fullName', 'role'] }] });

  // Notify anyone in the assessment's live room, if a comments channel is open (see server.js sockets)
  req.app.get('io')?.to(`assessment:${assessment.id}`).emit('new_comment', full);

  res.status(201).json(full);
});

module.exports = router;
