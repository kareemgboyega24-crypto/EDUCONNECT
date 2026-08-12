const express = require('express');
const { TimetableEntry, Course, Enrollment, User } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/timetable - the logged-in user's full weekly schedule across all their courses
router.get('/', async (req, res) => {
  let courseIds;

  if (req.user.role === 'teacher') {
    const courses = await Course.findAll({ where: { teacherId: req.user.id } });
    courseIds = courses.map(c => c.id);
  } else {
    const enrollments = await Enrollment.findAll({ where: { studentId: req.user.id } });
    courseIds = enrollments.map(e => e.courseId);
  }

  const entries = await TimetableEntry.findAll({
    where: { courseId: courseIds },
    include: [{ model: Course, include: [{ model: User, as: 'teacher', attributes: ['id', 'fullName'] }] }],
    order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
  });

  res.json(entries);
});

// POST /api/timetable - teacher adds a schedule slot to one of their courses
router.post('/', requireRole('teacher'), async (req, res) => {
  const { courseId, dayOfWeek, startTime, endTime, location } = req.body;
  if (courseId === undefined || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: 'courseId, dayOfWeek, startTime and endTime are required' });
  }

  const course = await Course.findByPk(courseId);
  if (!course || course.teacherId !== req.user.id) {
    return res.status(403).json({ error: 'Not your course' });
  }

  const entry = await TimetableEntry.create({ courseId, dayOfWeek, startTime, endTime, location });
  res.status(201).json(entry);
});

// DELETE /api/timetable/:id
router.delete('/:id', requireRole('teacher'), async (req, res) => {
  const entry = await TimetableEntry.findByPk(req.params.id, { include: Course });
  if (!entry || entry.Course.teacherId !== req.user.id) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  await entry.destroy();
  res.json({ success: true });
});

module.exports = router;
