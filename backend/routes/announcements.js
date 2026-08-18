const express = require('express');
const { Announcement, Course, User, Enrollment } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();
router.use(requireAuth);

router.get('/unread-count', async (req, res) => {
  try {
    let courseIds;
    if (req.user.role === 'lecturer') {
      const courses = await Course.findAll({ where: { teacherId: req.user.id } });
      courseIds = courses.map((c) => c.id);
    } else {
      const enrollments = await Enrollment.findAll({ where: { studentId: req.user.id } });
      courseIds = enrollments.map((e) => e.courseId);
    }

    const user = await User.findByPk(req.user.id);
    const since = user.lastAnnouncementsViewedAt || new Date(0);

    const count = await Announcement.count({
      where: {
        courseId: courseIds,
        authorId: { [Op.ne]: req.user.id },
        createdAt: { [Op.gt]: since }
      }
    });

    res.json({ count });
  } catch (err) {
    console.error('GET /announcements/unread-count failed:', err);
    res.status(500).json({ error: 'Failed to load unread count' });
  }
});

router.post('/mark-read', async (req, res) => {
  try {
    await User.update({ lastAnnouncementsViewedAt: new Date() }, { where: { id: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /announcements/mark-read failed:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { courseId } = req.query;

    let courseIds;
    if (courseId) {
      courseIds = [courseId];
    } else if (req.user.role === 'lecturer') {
      const courses = await Course.findAll({ where: { teacherId: req.user.id } });
      courseIds = courses.map((c) => c.id);
    } else {
      const enrollments = await Enrollment.findAll({ where: { studentId: req.user.id } });
      courseIds = enrollments.map((e) => e.courseId);
    }

    if (courseId) {
      if (req.user.role === 'lecturer') {
        const course = await Course.findByPk(courseId);
        if (!course || course.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your course' });
      } else {
        const enrolled = await Enrollment.findOne({ where: { courseId, studentId: req.user.id } });
        if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    }

    const announcements = await Announcement.findAll({
      where: { courseId: courseIds },
      include: [
        { model: Course, attributes: ['id', 'name', 'code'] },
        { model: User, as: 'author', attributes: ['id', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(announcements);
  } catch (err) {
    console.error('GET /announcements failed:', err);
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

router.post('/', requireRole('lecturer'), async (req, res) => {
  try {
    const { courseId, title, body } = req.body;
    if (!courseId || !title || !body) return res.status(400).json({ error: 'courseId, title and body are required' });

    const course = await Course.findByPk(courseId);
    if (!course || course.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your course' });

    const announcement = await Announcement.create({ courseId, authorId: req.user.id, title, body });
    const withCourse = await Announcement.findByPk(announcement.id, {
      include: [
        { model: Course, attributes: ['id', 'name', 'code'] },
        { model: User, as: 'author', attributes: ['id', 'fullName'] }
      ]
    });

    res.status(201).json(withCourse);
  } catch (err) {
    console.error('POST /announcements failed:', err);
    res.status(500).json({ error: 'Failed to post announcement' });
  }
});

router.delete('/:id', requireRole('lecturer'), async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id, { include: Course });
    if (!announcement) return res.status(404).json({ error: 'Not found' });
    if (announcement.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await announcement.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /announcements/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
