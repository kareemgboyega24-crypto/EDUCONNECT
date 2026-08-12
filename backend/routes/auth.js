const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { generateCode, sendVerificationEmail } = require('../config/mailer');

const router = express.Router();

const CODE_VALID_MINUTES = 15;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, fullName: user.fullName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/signup
// Creates the account in an unverified state and emails a 6-digit code.
// No token is issued yet - the account can't be used until /verify succeeds.
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'fullName, email, password and role are required' });
    }
    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'role must be "teacher" or "student"' });
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
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpires
    });

    try {
      await sendVerificationEmail(user.email, user.fullName, code);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
      // Account still created - user can use "Resend code" once email is fixed,
      // rather than losing their signup entirely over a transient email failure.
    }

    res.status(201).json({ requiresVerification: true, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/verify
// Confirms the 6-digit code and issues the real session token - this is the
// actual moment the account becomes usable.
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'No account found for that email' });

    if (user.emailVerified) {
      // Already verified (e.g. double submission) - just log them in cleanly
      const token = signToken(user);
      return res.json({
        token,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor }
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
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/resend-code
router.post('/resend-code', async (req, res) => {
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

// POST /api/auth/login
router.post('/login', async (req, res) => {
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

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarColor: user.avatarColor }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
