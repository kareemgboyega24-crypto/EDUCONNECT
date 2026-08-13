const express = require('express');
const { Assessment, Course, Document, Comment, User, Enrollment, Question, Answer, Notification } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { courseId } = req.query;

  const where = {};
  if (courseId) where.courseId = courseId;
  if (req.user.role === 'student') where.studentId = req.user.id;

  let assessments;
  if (req.user.role === 'teacher') {
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

router.post('/bulk-assign', requireRole('teacher'), async (req, res) => {
  try {
    const { courseId, title, questions } = req.body;
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });

    const course = await Course.findByPk(courseId);
    if (!course || course.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your course' });

    const enrollments = await Enrollment.findAll({ where: { courseId } });
    if (enrollments.length === 0) return res.status(400).json({ error: 'No students are enrolled in this course yet' });

    const questionList = Array.isArray(questions) ? questions : [];

    const createdAssessments = [];
    for (const enrollment of enrollments) {
      const assessment = await Assessment.create({
        courseId,
        studentId: enrollment.studentId,
        title,
        status: 'assigned'
      });
      createdAssessments.push(assessment);

      for (let i = 0; i < questionList.length; i++) {
        const q = questionList[i];
        await Question.create({
          assessmentId: assessment.id,
          type: q.type,
          prompt: q.prompt,
          options: q.type === 'multiple_choice' ? JSON.stringify(q.options) : null,
          correctOptionIndex: q.type === 'multiple_choice' ? q.correctOptionIndex : null,
          points: q.points || 1,
          order: i
        });
      }
    }

    res.status(201).json({ count: createdAssessments.length });
  } catch (err) {
    console.error('POST /assessments/bulk-assign failed:', err);
    res.status(500).json({ error: 'Failed to bulk-assign' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const assessment = await Assessment.findByPk(req.params.id, {
      include: [
        { model: Course },
        { model: User, as: 'student', attributes: ['id', 'fullName', 'email'] },
        { model: Document, as: 'documents', include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'fullName', 'role'] }] },
        { model: Comment, as: 'comments', include: [{ model: User, as: 'author', attributes: ['id', 'fullName', 'role'] }] },
        { model: Question, as: 'questions', include: [{ model: Answer, as: 'answer' }] }
      ],
      order: [
        [{ model: Comment, as: 'comments' }, 'createdAt', 'ASC'],
        [{ model: Question, as: 'questions' }, 'order', 'ASC']
      ]
    });
    if (!assessment) return res.status(404).json({ error: 'Not found' });

    const isOwnerStudent = req.user.role === 'student' && assessment.studentId === req.user.id;
    const isCourseTeacher = req.user.role === 'teacher' && assessment.Course.teacherId === req.user.id;
    if (!isOwnerStudent && !isCourseTeacher) return res.status(403).json({ error: 'Forbidden' });

    const payload = assessment.toJSON();
    payload.questions = (payload.questions || []).map((q) => {
      const options = q.options ? JSON.parse(q.options) : null;
      const hasAnswered = q.answer && (q.answer.selectedOptionIndex !== null || q.answer.textResponse !== null);
      const showAnswerKey = isCourseTeacher || hasAnswered;
      return { ...q, options, correctOptionIndex: showAnswerKey ? q.correctOptionIndex : undefined };
    });

    res.json(payload);
  } catch (err) {
    console.error('GET /assessments/:id failed:', err);
    res.status(500).json({ error: 'Failed to load assessment' });
  }
});

const VALID_STATUSES = ['assigned', 'submitted', 'reviewed', 'needs_revision'];

router.patch('/:id', requireRole('teacher'), async (req, res) => {
  const assessment = await Assessment.findByPk(req.params.id, { include: Course });
  if (!assessment) return res.status(404).json({ error: 'Not found' });
  if (assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { status, grade, feedbackSummary } = req.body;
  const gradeChanged = grade !== undefined && grade !== assessment.grade;
  const statusChanged = status !== undefined && status !== assessment.status;

  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status value' });
    assessment.status = status;
  }
  if (grade !== undefined) assessment.grade = grade;
  if (feedbackSummary !== undefined) assessment.feedbackSummary = feedbackSummary;
  await assessment.save();

  if (gradeChanged || statusChanged) {
    try {
      const message = gradeChanged
        ? `Your assessment "${assessment.title}" was graded: ${grade}`
        : `Your assessment "${assessment.title}" status changed to ${status.replace('_', ' ')}`;
      await Notification.create({
        userId: assessment.studentId,
        type: 'grade',
        message,
        link: `/assessments/${assessment.id}`
      });
    } catch (notifyErr) {
      console.error('Failed to create grade notification (assessment update still saved):', notifyErr);
    }
  }

  res.json(assessment);
});

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
    const questions = await Question.findAll({ where: { assessmentId: assessment.id } });
    for (const q of questions) {
      await Answer.destroy({ where: { questionId: q.id } });
    }
    await Question.destroy({ where: { assessmentId: assessment.id } });
    await assessment.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /assessments/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

module.exports = router;
