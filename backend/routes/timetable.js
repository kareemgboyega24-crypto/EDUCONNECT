const express = require('express');
const { TimetableEntry, Course, Enrollment, User } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  let courseIds;

  if (req.user.role === 'lecturer') {
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

router.post('/', requireRole('lecturer'), async (req, res) => {
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

router.delete('/:id', requireRole('lecturer'), async (req, res) => {
  const entry = await TimetableEntry.findByPk(req.params.id, { include: Course });
  if (!entry || entry.Course.teacherId !== req.user.id) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  await entry.destroy();
  res.json({ success: true });
});

module.exports = router;
