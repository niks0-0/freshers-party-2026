import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ggklbcjoumjtqfppdsfu.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdna2xiY2pvdW1qdHFmcHBkc2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTgxNTksImV4cCI6MjEwMjQzNDE1OX0.wobc0ZdBfZ1mQTlYhgih88AAHqqsk6XEqAsh8x7yCjg";

const GMAIL_USER = process.env.GMAIL_USER || 'crud2026otp@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, userId, fullName } = req.body || {};

    if (!email || !userId) {
      return res.status(400).json({ success: false, message: 'Email and User ID are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const studentName = fullName || 'Student';

    // 1. Initialize Supabase Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. CHECK ADMIN MASTER TOGGLE: Is Email OTP Allowed?
    const { data: settings, error: settingsErr } = await supabase
      .from('event_settings')
      .select('email_otp_enabled, ticket_live')
      .limit(1)
      .maybeSingle();

    if (settings && settings.email_otp_enabled === false) {
      return res.status(403).json({
        success: false,
        message: 'Email OTP dispatch is currently paused/disabled by the event administrator.'
      });
    }

    // 3. Generate 6-Digit Random OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes validity

    // Remove older pending verification records for this user
    await supabase.from('verification_codes').delete().eq('user_id', userId);

    // Insert new pending OTP with all required columns
    const { error: dbError } = await supabase.from('verification_codes').insert([{
      user_id: userId,
      email: cleanEmail,
      otp_code: otpCode,
      is_verified: false,
      attempts: 0,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }]);

    if (dbError) {
      console.error('Supabase DB error:', dbError);
      return res.status(500).json({ success: false, message: 'Failed to generate security code in database: ' + dbError.message });
    }

    // 4. Setup Nodemailer Transporter with Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') // remove any spaces
      }
    });

    // 5. Clean HTML Email Design
    const mailOptions = {
      from: `"CRUD 2026 Official" <${GMAIL_USER}>`,
      to: cleanEmail,
      subject: `Your CRUD 2026 Ticket Verification Code: ${otpCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #0d1117; color: #ffffff; padding: 2.5rem 1.5rem; max-width: 550px; margin: auto; border-radius: 12px; border: 1px solid #30363d;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h1 style="color: #6366f1; margin: 0; font-size: 1.8rem; letter-spacing: 1px;">CRUD 2026</h1>
            <p style="color: #8b949e; font-size: 0.9rem; margin-top: 0.3rem;">Official Digital Ticket Security Verification</p>
          </div>

          <p style="font-size: 1rem; color: #e6edf3;">Hello <strong>${studentName}</strong>,</p>
          <p style="font-size: 0.95rem; color: #8b949e; line-height: 1.6;">
            You requested to unlock your digital ticket pass for the <strong>CRUD 2026 Freshers Party</strong>. Use the 6-digit security code below to complete your verification:
          </p>

          <div style="text-align: center; margin: 2rem 0;">
            <span style="display: inline-block; font-size: 2.2rem; font-weight: 800; letter-spacing: 8px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 1rem 2rem; border-radius: 8px; border: 1px dashed #38bdf8; font-family: monospace;">
              ${otpCode}
            </span>
          </div>

          <p style="font-size: 0.85rem; color: #8b949e; text-align: center;">
            ⏳ This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.
          </p>

          <hr style="border: 0; border-top: 1px solid #30363d; margin: 2rem 0 1rem;" />

          <p style="font-size: 0.75rem; color: #6e7681; text-align: center; margin: 0;">
            © 2026 CRUD 2026 Digital Ticket System • Crafted by NIKSLAB
          </p>
        </div>
      `
    };

    // 6. Send the email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanEmail}`
    });

  } catch (error) {
    console.error('Send OTP Handler Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to dispatch email OTP.'
    });
  }
}
