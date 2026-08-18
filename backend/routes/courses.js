const express = require('express');
const { Course, Enrollment, User, Attendance, TimetableEntry, Assessment, Document, Comment, Question, Answer, Announcement } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  if (req.user.role === 'lecturer') {
    const courses = await Course.findAll({ where: { teacherId: req.user.id } });
    return res.json(courses);
  }
  const enrollments = await Enrollment.findAll({
    where: { studentId: req.user.id },
    include: [{ model: Course, include: [{ model: User, as: 'teacher', attributes: ['id', 'fullName'] }] }]
  });
  res.json(enrollments.map(e => e.Course));
});

router.post('/', requireRole('lecturer'), async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
  const course = await Course.create({ name, code, description, teacherId: req.user.id });
  res.status(201).json(course);
});

router.post('/:id/enroll', async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  let studentId;
  if (req.user.role === 'student') {
    studentId = req.user.id;
  } else if (req.user.role === 'lecturer') {
    if (course.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your course' });
    const { studentEmail } = req.body;
    const student = await User.findOne({ where: { email: (studentEmail || '').toLowerCase(), role: 'student' } });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    studentId = student.id;
  }

  const existing = await Enrollment.findOne({ where: { courseId: course.id, studentId } });
  if (existing) return res.status(409).json({ error: 'Already enrolled' });

  const enrollment = await Enrollment.create({ courseId: course.id, studentId });
  res.status(201).json(enrollment);
});

router.get('/:id/roster', requireRole('lecturer'), async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

  const enrollments = await Enrollment.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'student', attributes: ['id', 'fullName', 'email'] }]
  });
  res.json(enrollments.map(e => e.student));
});

router.get('/:id/attendance', requireRole('lecturer'), async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

  const records = await Attendance.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'account', attributes: ['studentIdNumber'] }],
    order: [['joinedAt', 'DESC']]
  });

  const uniqueStudents = new Set(records.filter(r => r.role === 'student').map(r => r.userId));

  const recordsWithStudentId = records.map((r) => {
    const plain = r.toJSON();
    return { ...plain, studentIdNumber: plain.account?.studentIdNumber || null, account: undefined };
  });

  res.json({
    records: recordsWithStudentId,
    uniqueStudentCount: uniqueStudents.size
  });
});

router.get('/:id/grades/export', requireRole('lecturer'), async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

    const assessments = await Assessment.findAll({
      where: { courseId: course.id },
      include: [{ model: User, as: 'student', attributes: ['fullName', 'email'] }],
      order: [[{ model: User, as: 'student' }, 'fullName', 'ASC']]
    });

    const escape = (value) => {
      const str = String(value ?? '');
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const header = ['Student Name', 'Student Email', 'Assessment', 'Status', 'Grade', 'Feedback Summary'];
    const rows = assessments.map((a) => [
      a.student?.fullName || '',
      a.student?.email || '',
      a.title,
      a.status.replace('_', ' '),
      a.grade || '',
      a.feedbackSummary || ''
    ]);

    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');

    const safeFileName = course.code.replace(/[^a-zA-Z0-9-_]/g, '_');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}-grades.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /courses/:id/grades/export failed:', err);
    res.status(500).json({ error: 'Failed to export grades' });
  }
});

router.delete('/:id', requireRole('lecturer'), async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

    const assessments = await Assessment.findAll({ where: { courseId: course.id } });
    for (const assessment of assessments) {
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
    }
    await Assessment.destroy({ where: { courseId: course.id } });

    await Attendance.destroy({ where: { courseId: course.id } });
    await TimetableEntry.destroy({ where: { courseId: course.id } });
    await Announcement.destroy({ where: { courseId: course.id } });
    await Enrollment.destroy({ where: { courseId: course.id } });
    await course.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /courses/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;
