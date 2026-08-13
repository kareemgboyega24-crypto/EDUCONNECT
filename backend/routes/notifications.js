const express = require('express');
const { Notification } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    res.json(notifications);
  } catch (err) {
    console.error('GET /notifications failed:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ count });
  } catch (err) {
    console.error('GET /notifications/unread-count failed:', err);
    res.status(500).json({ error: 'Failed to load unread count' });
  }
});

router.post('/mark-read', async (req, res) => {
  try {
    await Notification.update({ read: true }, { where: { userId: req.user.id, read: false } });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /notifications/mark-read failed:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;
