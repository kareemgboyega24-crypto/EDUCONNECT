const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { generateCode, sendVerificationEmail, sendPasswordResetEmail } = require('../config/mailer');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const CODE_VALID_MINUTES = 15;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, fullName: user.fullName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { fullName, email, password, role, adminInviteCode, studentIdNumber } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'fullName, email, password and role are required' });
    }
    if (!['lecturer', 'student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be "lecturer", "student", or "admin"' });
    }
    if (role === 'admin') {
      if (!process.env.ADMIN_INVITE_CODE || adminInviteCode !== process.env.ADMIN_INVITE_CODE) {
        return res.status(403).json({ error: 'Invalid admin invite code' });
      }
    }
    if (role === 'student' && !studentIdNumber?.trim()) {
      return res.status(400).json({ error: 'studentIdNumber is required for student accounts' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const palette = ['#5B6CFF', '#FF7A59', '#2FB88A', '#C084FC', '#F5A623'];
    const avatarColor = palette[Math.floor(Math.random() * palette.length)];

    const code = generateCode();
    const verificationCodeExpires = new Date(Date.now() + CODE_VALID_MINUTES * 60 * 1000);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role,
      avatarColor,
      studentIdNumber: role === 'student' ? studentIdNumber.trim() : null,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpires
    });

    try {
      await sendVerificationEmail(user.email, user.fullName, code);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
    }

    res.status(201).json({ requiresVerification: true, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'No account found for that email' });

    if (user.emailVerified) {
      const token = signToken(user);
      return res.json({
        token,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor, studentIdNumber: user.studentIdNumber }
      });
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ error: 'Incorrect code' });
    }
    if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired - request a new one' });
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor, studentIdNumber: user.studentIdNumber }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/resend-code', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'No account found for that email' });
    if (user.emailVerified) return res.status(400).json({ error: 'This account is already verified' });

    const code = generateCode();
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + CODE_VALID_MINUTES * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, user.fullName, code);
    res.json({ success: true });
  } catch (err) {
    console.error('Resend code failed:', err);
    res.status(500).json({ error: 'Could not resend code' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in',
        requiresVerification: true,
        email: user.email
      });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'This account has been suspended. Contact an administrator.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor, studentIdNumber: user.studentIdNumber }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (user) {
      const code = generateCode();
      user.resetCode = code;
      user.resetCodeExpires = new Date(Date.now() + CODE_VALID_MINUTES * 60 * 1000);
      await user.save();

      try {
        await sendPasswordResetEmail(user.email, user.fullName, code);
      } catch (mailErr) {
        console.error('Failed to send password reset email:', mailErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'No account found for that email' });

    if (!user.resetCode || user.resetCode !== code) {
      return res.status(400).json({ error: 'Incorrect code' });
    }
    if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired - request a new one' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpires = null;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor, studentIdNumber: user.studentIdNumber });
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { fullName, currentPassword, newPassword, studentIdNumber } = req.body;

    if (fullName !== undefined) {
      if (!fullName.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      user.fullName = fullName.trim();
    }

    if (studentIdNumber !== undefined) {
      if (user.role !== 'student') return res.status(400).json({ error: 'Only student accounts have a student ID' });
      if (!studentIdNumber.trim()) return res.status(400).json({ error: 'Student ID cannot be empty' });
      user.studentIdNumber = studentIdNumber.trim();
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Enter your current password to set a new one' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor, studentIdNumber: user.studentIdNumber }
    });
  } catch (err) {
    console.error('PATCH /auth/me failed:', err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

module.exports = router;
