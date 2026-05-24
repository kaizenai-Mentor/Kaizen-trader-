const https = require('https');

const sendEmailJS = async (templateId, templateParams) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    });

    const options = {
      hostname: 'api.emailjs.com',
      port: 443,
      path: '/api/v1.0/email/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'origin': 'http://localhost'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('Email sent successfully via EmailJS');
          resolve(body);
        } else {
          console.error('EmailJS failed:', res.statusCode, body);
          reject(new Error(`EmailJS error: ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('EmailJS request error:', err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const sendWelcomeEmail = async (toEmail, username) => {
  try {
    await sendEmailJS(process.env.EMAILJS_WELCOME_TEMPLATE, {
      to_email: toEmail,
      username: username,
      dashboard_url: `${process.env.APP_URL}/dashboard`
    });
    console.log('Welcome email sent to:', toEmail);
  } catch (error) {
    console.error('Welcome email error:', error.message);
  }
};

const sendOTPEmail = async (toEmail, otp) => {
  try {
    await sendEmailJS(process.env.EMAILJS_OTP_TEMPLATE, {
      to_email: toEmail,
      otp: otp
    });
    console.log('OTP sent to:', toEmail);
  } catch (error) {
    console.error('OTP email error:', error.message);
  }
};

module.exports = { sendWelcomeEmail, sendOTPEmail };
