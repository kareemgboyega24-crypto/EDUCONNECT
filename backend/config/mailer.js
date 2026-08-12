const nodemailer = require('nodemailer');

// Gmail SMTP: free, reliable, no domain verification needed - just requires an
// "App Password" (not your regular Gmail password) generated from your Google
// Account's security settings once 2-Step Verification is enabled.
const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })
  : null;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
}

async function sendVerificationEmail(toEmail, fullName, code) {
  if (!transporter) {
    console.warn(`Email not configured - verification code for ${toEmail} is: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: `"EduConnect" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your EduConnect verification code',
    text: `Hi ${fullName},\n\nYour EduConnect verification code is: ${code}\n\nThis code expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #161A2B;">EduConnect</h2>
        <p>Hi ${fullName},</p>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #161A2B; margin: 24px 0;">${code}</p>
        <p style="color: #666; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });
}

module.exports = { generateCode, sendVerificationEmail };
