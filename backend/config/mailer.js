const nodemailer = require('nodemailer');
const dns = require('dns');
const util = require('util');

const dnsLookup = util.promisify(dns.lookup);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Render (and many similar hosts) have no outbound IPv6 route. smtp.gmail.com
// resolves to both an IPv4 and an IPv6 address, and nodemailer's own internal
// DNS resolution picks between them at random - meaning roughly half of all
// send attempts fail immediately with ENETUNREACH or hang until ETIMEDOUT.
// Passing a plain hostname to nodemailer triggers that random A/AAAA pick;
// passing a literal IP address instead skips it entirely (nodemailer detects
// a literal IP via net.isIP() and never resolves it further). Resolving the
// address ourselves via dns.lookup with family: 4 guarantees only the IPv4
// address is ever used, while tls.servername is set explicitly to the real
// hostname so Gmail's TLS certificate still validates correctly against it.
async function createTransporter() {
  const { address } = await dnsLookup('smtp.gmail.com', { family: 4 });

  return nodemailer.createTransport({
    host: address,
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    },
    tls: {
      servername: 'smtp.gmail.com'
    }
  });
}

async function sendVerificationEmail(to, fullName, code) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[No email configured] Verification code for ${to}: ${code}`);
    return;
  }

  const transporter = await createTransporter();
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: 'Your EduConnect verification code',
    text: `Hi ${fullName},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${fullName},</p><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
  });
}

async function sendPasswordResetEmail(to, fullName, code) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[No email configured] Password reset code for ${to}: ${code}`);
    return;
  }

  const transporter = await createTransporter();
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: 'Reset your EduConnect password',
    text: `Hi ${fullName},\n\nYour password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${fullName},</p><p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
  });
}

module.exports = { generateCode, sendVerificationEmail, sendPasswordResetEmail };
