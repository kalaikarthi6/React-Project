const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

/**
 * Send an email via SMTP.
 * @param {{ to: string, subject: string, html: string }} options
 */
async function sendEmail({ to, subject, html }) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(
      '[email] WARNING: SMTP_USER or SMTP_PASS is not set in .env. ' +
      'Skipping email send to:', to
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for port 465, false for 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"Certis" <${SMTP_USER}>`,
    to,
    subject,
    html,
  });

  console.log('[email] Message sent:', info.messageId);
}

/**
 * Send a temporary password email to a newly invited agent.
 * @param {string} to      - Recipient email address
 * @param {string} name    - Recipient display name
 * @param {string} tempPassword - The generated temporary password
 */
async function sendTempPasswordEmail(to, name, tempPassword) {
  const subject = 'Your Certis Account — Temporary Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Welcome to Certis, ${name}!</h2>
      <p>Your account has been created. Use the temporary password below to log in:</p>
      <div style="
        background: #f3f4f6;
        border-left: 4px solid #4f46e5;
        padding: 12px 20px;
        font-size: 20px;
        font-weight: bold;
        letter-spacing: 2px;
        margin: 20px 0;
      ">
        ${tempPassword}
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This password expires in <strong>48 hours</strong>. 
        You will be prompted to set a new password on first login.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        If you did not expect this email, please ignore it or contact your administrator.
      </p>
    </div>
  `;

  await sendEmail({ to, subject, html });
}

module.exports = { sendEmail, sendTempPasswordEmail };
