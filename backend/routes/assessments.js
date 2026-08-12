const express = require('express');
const { Assessment, Course, Document, Comment, User, Enrollment } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth);

// GET /api/assessments - list assessments relevant to the logged-in user
router.get('/', async (req, res) => {
  const { courseId } = req.query;

  const where = {};
  if (courseId) where.courseId = courseId;
  if (req.user.role === 'student') where.studentId = req.user.id;

  let assessments;
  if (req.user.role === 'teacher') {
    // only assessments belonging to courses this teacher owns
    const courses = await Course.findAll({ where: { teacherId: req.user.id } });
    where.courseId = courses.map(c => c.id);
    assessments = await Assessment.findAll({
      where,
      include: [
        { model: Course, attributes: ['id', 'name', 'code'] },
        { model: User, as: 'student', attributes: ['id', 'fullName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  } else {
    assessments = await Assessment.findAll({
      where,
      include: [{ model: Course, attributes: ['id', 'name', 'code'] }],
      order: [['createdAt', 'DESC']]
    });
  }

  res.json(assessments);
});

// POST /api/assessments
// Student: creates a self-submission (a report they're submitting for review) - status 'submitted'.
// Teacher: assigns a new assessment directly to one of their enrolled students - status 'assigned',
// so the student sees it waiting for them and can attach their work when ready.
router.post('/', async (req, res) => {
  try {
    const { courseId, title } = req.body;
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });

    if (req.user.role === 'student') {
      const enrolled = await Enrollment.findOne({ where: { courseId, studentId: req.user.id } });
      if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this course' });

      const assessment = await Assessment.create({ courseId, studentId: req.user.id, title, status: 'submitted' });
      return res.status(201).json(assessment);
    }

    // teacher path
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const course = await Course.findByPk(courseId);
    if (!course || course.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your course' });

    const enrolled = await Enrollment.findOne({ where: { courseId, studentId } });
    if (!enrolled) return res.status(400).json({ error: 'That student is not enrolled in this course' });

    const assessment = await Assessment.create({ courseId, studentId, title, status: 'assigned' });
    res.status(201).json(assessment);
  } catch (err) {
    console.error('POST /assessments failed:', err);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// GET /api/assessments/:id - full detail incl. documents & comments
router.get('/:id', async (req, res) => {
  try {
    const assessment = await Assessment.findByPk(req.params.id, {
      include: [
        { model: Course },
        { model: User, as: 'student', attributes: ['id', 'fullName', 'email'] },
        { model: Document, as: 'documents', include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'fullName', 'role'] }] },
        { model: Comment, as: 'comments', include: [{ model: User, as: 'author', attributes: ['id', 'fullName', 'role'] }] }
      ],
      order: [[{ model: Comment, as: 'comments' }, 'createdAt', 'ASC']]
    });
    if (!assessment) return res.status(404).json({ error: 'Not found' });

    const isOwnerStudent = req.user.role === 'student' && assessment.studentId === req.user.id;
    const isCourseTeacher = req.user.role === 'teacher' && assessment.Course.teacherId === req.user.id;
    if (!isOwnerStudent && !isCourseTeacher) return res.status(403).json({ error: 'Forbidden' });

    res.json(assessment);
  } catch (err) {
    console.error('GET /assessments/:id failed:', err);
    res.status(500).json({ error: 'Failed to load assessment' });
  }
});

const VALID_STATUSES = ['assigned', 'submitted', 'reviewed', 'needs_revision'];

// PATCH /api/assessments/:id - teacher updates status/grade/feedback summary
router.patch('/:id', requireRole('teacher'), async (req, res) => {
  const assessment = await Assessment.findByPk(req.params.id, { include: Course });
  if (!assessment) return res.status(404).json({ error: 'Not found' });
  if (assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { status, grade, feedbackSummary } = req.body;
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status value' });
    assessment.status = status;
  }
  if (grade !== undefined) assessment.grade = grade;
  if (feedbackSummary !== undefined) assessment.feedbackSummary = feedbackSummary;
  await assessment.save();

  res.json(assessment);
});

// DELETE /api/assessments/:id - teacher deletes an assessment they created (e.g. made
// by mistake). Since the student's view queries this exact same record, removing it
// here removes it from the student's side automatically - there's only one copy of
// the data. Documents/comments are cleaned up first since foreign keys are set to
// NO ACTION rather than CASCADE (a SQL Server requirement - see models/index.js).
router.delete('/:id', requireRole('teacher'), async (req, res) => {
  try {
    const assessment = await Assessment.findByPk(req.params.id, { include: Course });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const documents = await Document.findAll({ where: { assessmentId: assessment.id } });
    for (const doc of documents) {
      try {
        await deleteStoredFile(doc.storedFileName);
      } catch (fileErr) {
        console.error(`Could not delete stored file for document ${doc.id} (continuing):`, fileErr);
      }
    }
    await Document.destroy({ where: { assessmentId: assessment.id } });
    await Comment.destroy({ where: { assessmentId: assessment.id } });
    await assessment.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /assessments/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

module.exports = router;
