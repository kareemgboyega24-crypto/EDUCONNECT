// Switched from Gmail SMTP to Resend's HTTP API. Render's free tier blocks
// all outbound SMTP ports (25, 465, 587) as an anti-spam measure - a hard
// network-level restriction with no code-level workaround. Resend sends over
// plain HTTPS (port 443), which is never blocked, sidestepping the problem
// entirely rather than trying to work around it.

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendViaResend({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[No email configured] Would have sent "${subject}" to ${to}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'EduConnect <noreply@edduconnect.com>',
      to,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Resend API error:', response.status, errBody);
    throw new Error('Failed to send email via Resend');
  }
}

async function sendVerificationEmail(to, fullName, code) {
  await sendViaResend({
    to,
    subject: 'Your EduConnect verification code',
    text: `Hi ${fullName},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${fullName},</p><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
  });
}

async function sendPasswordResetEmail(to, fullName, code) {
  await sendViaResend({
    to,
    subject: 'Reset your EduConnect password',
    text: `Hi ${fullName},\n\nYour password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${fullName},</p><p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
  });
}

module.exports = { generateCode, sendVerificationEmail, sendPasswordResetEmail };
