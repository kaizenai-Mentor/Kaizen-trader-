const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.BREVO_SENDER_EMAIL,
    pass: process.env.BREVO_API_KEY
  }
});

// Send welcome email
const sendWelcomeEmail = async (toEmail, username) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: toEmail,
      subject: '改 Welcome to KAIZEN — Your Discipline Journey Begins',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { margin:0; padding:0; background:#080808; font-family:'Helvetica Neue',sans-serif; }
            .wrapper { max-width:560px; margin:0 auto; background:#111111; border:1px solid rgba(201,168,76,0.2); }
            .header { padding:40px 40px 32px; border-bottom:1px solid rgba(255,255,255,0.06); }
            .logo { font-size:1.4rem; color:#C9A84C; letter-spacing:0.1em; font-weight:600; }
            .body { padding:40px; }
            .greeting { font-size:1.6rem; font-weight:700; color:#F5F3EF; margin-bottom:16px; line-height:1.2; }
            .greeting span { color:#C9A84C; }
            .text { font-size:0.92rem; color:#A8A09A; line-height:1.85; margin-bottom:16px; }
            .text strong { color:#F5F3EF; }
            .score-box { background:#161616; border:1px solid rgba(201,168,76,0.2); padding:20px 24px; margin:24px 0; }
            .score-label { font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:#A8A09A; margin-bottom:6px; font-family:monospace; }
            .score-val { font-size:2rem; font-weight:700; color:#C9A84C; line-height:1; }
            .btn { display:inline-block; background:#C9A84C; color:#000000; font-weight:700; padding:14px 32px; text-decoration:none; font-size:0.9rem; margin-top:8px; }
            .footer { padding:24px 40px; border-top:1px solid rgba(255,255,255,0.06); }
            .footer-text { font-size:0.72rem; color:#3A3530; letter-spacing:0.08em; }
            .kanji { font-size:3rem; color:rgba(201,168,76,0.15); float:right; line-height:1; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <span class="logo">改 KAIZEN</span>
              <span class="kanji">改</span>
            </div>
            <div class="body">
              <div class="greeting">
                Welcome, <span>${username}.</span>
              </div>
              <p class="text">
                Your discipline journey starts today. Kaizen is not a trading signal app.
                It is a <strong>behavioral accountability system</strong> — built to help you
                follow your own rules, consistently, every single session.
              </p>
              <p class="text">
                The traders who win long-term are not the smartest. They are the most
                <strong>disciplined</strong>. That is what Kaizen is built to help you become.
              </p>
              <div class="score-box">
                <div class="score-label">Your Starting Discipline Score</div>
                <div class="score-val">0 / 100</div>
                <p style="font-size:0.8rem;color:#A8A09A;margin-top:8px;margin-bottom:0;">
                  Every compliant session raises this score. Every violation drops it.
                  Your job is to make it go up.
                </p>
              </div>
              <p class="text">
                Start by logging your first session in the Journal.
                Then check the Bounties section for Zero Authority DAO challenges
                you can complete to earn on-chain reputation.
              </p>
              <a href="${process.env.APP_URL}/dashboard" class="btn">
                Open Dashboard
              </a>
            </div>
            <div class="footer">
              <p class="footer-text">
                改善 — KAIZEN · Trade Better. Every Day.<br>
                You received this because you created a Kaizen account.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log('Welcome email sent to:', toEmail);
  } catch (error) {
    console.error('Email error:', error.message);
  }
};

// Send OTP email
const sendOTPEmail = async (toEmail, otp) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: toEmail,
      subject: `${otp} — Your KAIZEN Verification Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin:0; padding:0; background:#080808; font-family:'Helvetica Neue',sans-serif; }
            .wrapper { max-width:480px; margin:0 auto; background:#111111; border:1px solid rgba(201,168,76,0.2); }
            .header { padding:32px 36px; border-bottom:1px solid rgba(255,255,255,0.06); }
            .logo { font-size:1.2rem; color:#C9A84C; letter-spacing:0.1em; font-weight:600; }
            .body { padding:36px; text-align:center; }
            .title { font-size:1.1rem; font-weight:700; color:#F5F3EF; margin-bottom:8px; }
            .subtitle { font-size:0.85rem; color:#A8A09A; margin-bottom:32px; }
            .otp-box { background:#161616; border:2px solid rgba(201,168,76,0.4); padding:24px; margin:0 auto 28px; display:inline-block; min-width:160px; }
            .otp-code { font-size:3rem; font-weight:800; color:#C9A84C; letter-spacing:0.3em; font-family:monospace; line-height:1; }
            .note { font-size:0.78rem; color:#3A3530; margin-top:20px; }
            .footer { padding:20px 36px; border-top:1px solid rgba(255,255,255,0.06); }
            .footer-text { font-size:0.7rem; color:#3A3530; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <span class="logo">改 KAIZEN</span>
            </div>
            <div class="body">
              <div class="title">Verify Your Account</div>
              <div class="subtitle">Enter this 3-digit code to complete your registration</div>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p style="font-size:0.82rem;color:#A8A09A;">
                This code expires in <strong style="color:#F5F3EF;">10 minutes</strong>.
              </p>
              <p class="note">If you did not request this, ignore this email.</p>
            </div>
            <div class="footer">
              <p class="footer-text">改善 — KAIZEN · Trade Better. Every Day.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log('OTP sent to:', toEmail);
  } catch (error) {
    console.error('OTP email error:', error.message);
  }
};

module.exports = { sendWelcomeEmail, sendOTPEmail };
