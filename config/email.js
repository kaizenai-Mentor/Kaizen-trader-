const https = require('https');

const sendEmail = async (to, subject, html) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: 'KAIZEN <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Email sent to:', to);
          resolve(body);
        } else {
          console.error('Email send failed:', body);
          reject(new Error(body));
        }
      });
    });

    req.on('error', (err) => {
      console.error('Email request error:', err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const sendWelcomeEmail = async (toEmail, username) => {
  try {
    await sendEmail(
      toEmail,
      '改 Welcome to KAIZEN — Your Discipline Journey Begins',
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin:0; padding:0; background:#080808; font-family:Arial,sans-serif; }
          .wrap { max-width:560px; margin:0 auto; background:#111111; border:1px solid rgba(201,168,76,0.2); }
          .head { padding:36px 40px; border-bottom:1px solid rgba(255,255,255,0.06); }
          .logo { font-size:1.3rem; color:#C9A84C; letter-spacing:0.1em; font-weight:700; font-family:monospace; }
          .body { padding:40px; }
          .greeting { font-size:1.5rem; font-weight:700; color:#F5F3EF; margin-bottom:16px; }
          .greeting span { color:#C9A84C; }
          .text { font-size:0.9rem; color:#A8A09A; line-height:1.85; margin-bottom:14px; }
          .text strong { color:#F5F3EF; }
          .box { background:#161616; border:1px solid rgba(201,168,76,0.2); padding:20px 24px; margin:24px 0; }
          .box-label { font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:#A8A09A; margin-bottom:6px; font-family:monospace; }
          .box-val { font-size:1.8rem; font-weight:700; color:#C9A84C; }
          .btn { display:inline-block; background:#C9A84C; color:#000; font-weight:700; padding:14px 32px; text-decoration:none; font-size:0.9rem; margin-top:8px; }
          .foot { padding:20px 40px; border-top:1px solid rgba(255,255,255,0.06); }
          .foot-text { font-size:0.7rem; color:#3A3530; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="head"><span class="logo">改 KAIZEN</span></div>
          <div class="body">
            <div class="greeting">Welcome, <span>${username}.</span></div>
            <p class="text">
              Your discipline journey starts today. KAIZEN is not a trading signal app.
              It is a <strong>behavioral accountability system</strong> built to help you
              follow your own rules, consistently, every single session.
            </p>
            <p class="text">
              The traders who win long-term are not the smartest.
              They are the most <strong>disciplined</strong>.
              That is what KAIZEN is built to help you become.
            </p>
            <div class="box">
              <div class="box-label">Your Starting Discipline Score</div>
              <div class="box-val">0 / 100</div>
              <p style="font-size:0.78rem;color:#A8A09A;margin-top:8px;margin-bottom:0;">
                Every compliant session raises this score.
                Every violation drops it. Make it go up.
              </p>
            </div>
            <p class="text">
              Start by logging your first session in the Journal.
              Then check Bounties for Zero Authority DAO challenges
              you can complete to earn on-chain reputation.
            </p>
            <a href="${process.env.APP_URL}/dashboard" class="btn">
              Open Dashboard
            </a>
          </div>
          <div class="foot">
            <p class="foot-text">
              改善 — KAIZEN · Trade Better. Every Day.<br>
              You received this because you created a KAIZEN account.
            </p>
          </div>
        </div>
      </body>
      </html>
      `
    );
  } catch (error) {
    console.error('Welcome email error:', error.message);
  }
};

const sendOTPEmail = async (toEmail, otp) => {
  try {
    await sendEmail(
      toEmail,
      `${otp} — Your KAIZEN Verification Code`,
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin:0; padding:0; background:#080808; font-family:Arial,sans-serif; }
          .wrap { max-width:480px; margin:0 auto; background:#111111; border:1px solid rgba(201,168,76,0.2); }
          .head { padding:28px 36px; border-bottom:1px solid rgba(255,255,255,0.06); }
          .logo { font-size:1.1rem; color:#C9A84C; letter-spacing:0.1em; font-weight:700; font-family:monospace; }
          .body { padding:36px; text-align:center; }
          .title { font-size:1.1rem; font-weight:700; color:#F5F3EF; margin-bottom:8px; }
          .sub { font-size:0.85rem; color:#A8A09A; margin-bottom:28px; }
          .otp-box { background:#161616; border:2px solid rgba(201,168,76,0.4); padding:24px 40px; display:inline-block; margin-bottom:24px; }
          .otp-code { font-size:3rem; font-weight:900; color:#C9A84C; letter-spacing:0.4em; font-family:monospace; line-height:1; text-indent:0.4em; }
          .note { font-size:0.82rem; color:#A8A09A; }
          .expire { font-size:0.78rem; color:#3A3530; margin-top:20px; }
          .foot { padding:18px 36px; border-top:1px solid rgba(255,255,255,0.06); }
          .foot-text { font-size:0.68rem; color:#3A3530; font-family:monospace; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="head"><span class="logo">改 KAIZEN</span></div>
          <div class="body">
            <div class="title">Verify Your Account</div>
            <div class="sub">Enter this 3-digit code to complete your registration</div>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p class="note">
              This code expires in <strong style="color:#F5F3EF;">10 minutes</strong>.
            </p>
            <p class="expire">If you did not request this, ignore this email.</p>
          </div>
          <div class="foot">
            <p class="foot-text">改善 — KAIZEN · Trade Better. Every Day.</p>
          </div>
        </div>
      </body>
      </html>
      `
    );
  } catch (error) {
    console.error('OTP email error:', error.message);
  }
};

module.exports = { sendWelcomeEmail, sendOTPEmail };
