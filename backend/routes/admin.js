const express = require('express');
const { User, Course, Enrollment, Assessment, Document, Comment, TimetableEntry, Attendance, Question, Answer, Announcement } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const VALID_ROLES = ['admin', 'teacher', 'student'];

// GET /api/admin/stats - institution-wide overview
router.get('/stats', async (req, res) => {
  try {
    const [userCount, teacherCount, studentCount, courseCount, assessmentCount, enrollmentCount] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'teacher' } }),
      User.count({ where: { role: 'student' } }),
      Course.count(),
      Assessment.count(),
      Enrollment.count()
    ]);
    res.json({ userCount, teacherCount, studentCount, courseCount, assessmentCount, enrollmentCount });
  } catch (err) {
    console.error('GET /admin/stats failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /api/admin/users - every account on the platform
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'fullName', 'email', 'role', 'active', 'emailVerified', 'avatarColor', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (err) {
    console.error('GET /admin/users failed:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// PATCH /api/admin/users/:id - suspend/reactivate an account, or change its role
router.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id && req.body.active === false) {
      return res.status(400).json({ error: "You can't suspend your own account" });
    }

    const { active, role } = req.body;
    if (active !== undefined) user.active = active;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role value' });
      if (user.id === req.user.id && role !== 'admin') {
        return res.status(400).json({ error: "You can't remove your own admin access" });
      }
      user.role = role;
    }
    await user.save();

    res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, active: user.active });
  } catch (err) {
    console.error('PATCH /admin/users/:id failed:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/courses - every course on the platform, with basic rollup stats
router.get('/courses', async (req, res) => {
  try {
    const courses = await Course.findAll({
      include: [{ model: User, as: 'teacher', attributes: ['id', 'fullName', 'email'] }],
      order: [['createdAt', 'DESC']]
    });

    const withCounts = await Promise.all(courses.map(async (course) => {
      const [enrollmentCount, assessmentCount] = await Promise.all([
        Enrollment.count({ where: { courseId: course.id } }),
        Assessment.count({ where: { courseId: course.id } })
      ]);
      return {
        id: course.id,
        name: course.name,
        code: course.code,
        teacher: course.teacher,
        enrollmentCount,
        assessmentCount,
        createdAt: course.createdAt
      };
    }));

    res.json(withCounts);
  } catch (err) {
    console.error('GET /admin/courses failed:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

// DELETE /api/admin/courses/:id - moderation override, not scoped to a specific teacher.
// Same cascade cleanup as the teacher-facing course delete (see routes/courses.js).
router.delete('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

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
    console.error('DELETE /admin/courses/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;
