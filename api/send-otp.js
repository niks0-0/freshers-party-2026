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

    // Remove older pending verification records for this user or email
    await supabase.from('verification_codes').delete().or(`user_id.eq.${userId},email.eq.${cleanEmail}`);

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

    // 5. Clean Multi-Part Email Design (HTML + Plaintext for Anti-Spam Deliverability)
    const mailOptions = {
      from: `CRUD 2026 Verification <${GMAIL_USER}>`,
      to: cleanEmail,
      replyTo: GMAIL_USER,
      priority: 'high',
      subject: `CRUD 2026 Verification Code: ${otpCode}`,
      text: `Hello ${studentName},\n\nYour security verification code for the CRUD 2026 Freshers Party ticket pass is: ${otpCode}\n\nThis code is valid for 15 minutes.\n\nCRUD 2026 Digital Ticket System - Crafted by NIKSLAB`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 2rem 1.5rem; max-width: 520px; margin: 0 auto; border-radius: 12px; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h2 style="color: #6366f1; margin: 0; font-size: 1.6rem; letter-spacing: 0.5px;">CRUD 2026</h2>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.3rem;">Official Event Pass Verification</p>
          </div>

          <p style="font-size: 0.95rem; color: #f1f5f9; margin-bottom: 0.5rem;">Hello <strong>${studentName}</strong>,</p>
          <p style="font-size: 0.9rem; color: #94a3b8; line-height: 1.5;">
            Use the 6-digit verification code below to access and download your personalized digital ticket pass for the <strong>CRUD 2026 Freshers Party</strong>:
          </p>

          <div style="text-align: center; margin: 1.75rem 0;">
            <div style="display: inline-block; font-size: 2rem; font-weight: 800; letter-spacing: 6px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 0.85rem 1.75rem; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.3); font-family: monospace;">
              ${otpCode}
            </div>
          </div>

          <p style="font-size: 0.8rem; color: #64748b; text-align: center; margin-top: 1rem;">
            ⏳ This code is valid for 15 minutes.
          </p>

          <div style="border-top: 1px solid #1e293b; margin-top: 1.5rem; padding-top: 1rem; text-align: center;">
            <p style="font-size: 0.75rem; color: #64748b; margin: 0;">
              © 2026 Department of Computer Science • Crafted by NIKSLAB
            </p>
          </div>
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
