const express = require('express');
const { Course, Enrollment, User, Attendance, TimetableEntry, Assessment, Document, Comment } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth);

// GET /api/courses - list courses relevant to the logged-in user
router.get('/', async (req, res) => {
  if (req.user.role === 'teacher') {
    const courses = await Course.findAll({ where: { teacherId: req.user.id } });
    return res.json(courses);
  }
  // student: only courses they're enrolled in
  const enrollments = await Enrollment.findAll({
    where: { studentId: req.user.id },
    include: [{ model: Course, include: [{ model: User, as: 'teacher', attributes: ['id', 'fullName'] }] }]
  });
  res.json(enrollments.map(e => e.Course));
});

// POST /api/courses - teacher creates a course
router.post('/', requireRole('teacher'), async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
  const course = await Course.create({ name, code, description, teacherId: req.user.id });
  res.status(201).json(course);
});

// POST /api/courses/:id/enroll - teacher enrolls a student by email, or student self-enrolls via course code
router.post('/:id/enroll', async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  let studentId;
  if (req.user.role === 'student') {
    studentId = req.user.id;
  } else if (req.user.role === 'teacher') {
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

// GET /api/courses/:id/roster - teacher views enrolled students
router.get('/:id/roster', requireRole('teacher'), async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

  const enrollments = await Enrollment.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'student', attributes: ['id', 'fullName', 'email'] }]
  });
  res.json(enrollments.map(e => e.student));
});

// GET /api/courses/:id/attendance - teacher views who has joined video calls for this course
router.get('/:id/attendance', requireRole('teacher'), async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course || course.teacherId !== req.user.id) return res.status(404).json({ error: 'Course not found' });

  const records = await Attendance.findAll({
    where: { courseId: course.id },
    order: [['joinedAt', 'DESC']]
  });

  const uniqueStudents = new Set(records.filter(r => r.role === 'student').map(r => r.userId));

  res.json({
    records,
    uniqueStudentCount: uniqueStudents.size
  });
});

// DELETE /api/courses/:id - teacher deletes an entire course (e.g. created by mistake).
// A course has enrollments, timetable slots, assessments (each with their own documents
// and comments), and attendance records all pointing back to it via foreign keys set to
// NO ACTION (a SQL Server requirement - see models/index.js), so everything has to be
// removed in dependency order before the course row itself can go. Students see this
// automatically once it's gone, since their dashboard/assessments queries read from
// the same underlying tables - there's no separate "student copy" to clean up.
router.delete('/:id', requireRole('teacher'), async (req, res) => {
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
    }
    await Assessment.destroy({ where: { courseId: course.id } });

    await Attendance.destroy({ where: { courseId: course.id } });
    await TimetableEntry.destroy({ where: { courseId: course.id } });
    await Enrollment.destroy({ where: { courseId: course.id } });
    await course.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /courses/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;
