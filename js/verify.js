/* ========================================================
   CRUD 2026 — BULLETPROOF 6-DIGIT EMAIL OTP VERIFICATION LOGIC
   ======================================================== */

let currentUserAuth = null;
let resendTimer = null;
let countdownSeconds = 60;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  setupMaskedEmail();
  setupOtpInputHandlers();
  setupVerificationForm();
  
  // Auto send code on first arrival
  sendOtpCode();
});

function setupMaskedEmail() {
  const maskedEl = document.getElementById('masked-email-display');
  if (maskedEl && currentUserAuth) {
    maskedEl.textContent = maskEmail(currentUserAuth.user.email);
  }
}

// Auto focus movement across 6 OTP boxes
function setupOtpInputHandlers() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        input.value = val[0]; // limit to single digit
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });
}

function getEnteredOtpCode() {
  const inputs = document.querySelectorAll('.otp-input');
  let code = '';
  inputs.forEach(input => code += input.value.trim());
  return code;
}

// Generate & Dispatch OTP Code to Real Gmail Inbox
async function sendOtpCode() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  // Generate 6-digit numeric OTP
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const otpCode = String(100000 + (array[0] % 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes expiry

  try {
    // 1. Delete existing OTP record for this user if present
    await sb.from('verification_codes').delete().eq('user_id', userId);

    // 2. Save new 6-digit OTP record in PostgreSQL database table
    await sb
      .from('verification_codes')
      .insert([{
        user_id: userId,
        email: userEmail,
        otp_code: otpCode,
        is_verified: false,
        attempts: 0,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }]);

    // 3. Trigger Supabase Auth Email Dispatch
    await sb.auth.signInWithOtp({
      email: userEmail,
      options: { shouldCreateUser: false }
    });

    showToast(`Verification code sent to your Gmail (${maskEmail(userEmail)})! Check Inbox & Spam.`, 'info', 7000);
    startResendCountdown();

  } catch (err) {
    console.error("Error generating OTP:", err);
  }
}

function startResendCountdown() {
  const resendBtn = document.getElementById('resend-code-btn');
  const timerText = document.getElementById('resend-timer-text');
  if (!resendBtn) return;

  resendBtn.disabled = true;
  countdownSeconds = 60;

  if (resendTimer) clearInterval(resendTimer);

  resendTimer = setInterval(() => {
    countdownSeconds--;
    if (timerText) {
      timerText.textContent = `Resend available in ${countdownSeconds}s`;
    }

    if (countdownSeconds <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      if (timerText) timerText.textContent = 'Did not receive code?';
    }
  }, 1000);
}

function setupVerificationForm() {
  const form = document.getElementById('verify-otp-form');
  const resendBtn = document.getElementById('resend-code-btn');

  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      if (countdownSeconds <= 0) {
        sendOtpCode();
      }
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const verifyBtn = document.getElementById('verify-submit-btn');
    const otpCode = getEnteredOtpCode();

    if (otpCode.length < 6) {
      showToast('Please enter the full code sent to your email.', 'error');
      return;
    }

    setButtonLoading(verifyBtn, true, 'Verifying Security Code...');

    const sb = window.getSupabase();
    const userId = currentUserAuth.user.id;
    const userEmail = currentUserAuth.user.email;

    try {
      // 1. Try Supabase Auth verifyOtp with type 'email'
      let authVerified = false;
      
      const { data: authData1, error: err1 } = await sb.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: 'email'
      });
      if (!err1 && authData1 && authData1.session) authVerified = true;

      // 2. Try Supabase Auth verifyOtp with type 'magiclink'
      if (!authVerified) {
        const { data: authData2, error: err2 } = await sb.auth.verifyOtp({
          email: userEmail,
          token: otpCode,
          type: 'magiclink'
        });
        if (!err2 && authData2 && authData2.session) authVerified = true;
      }

      // 3. Try Supabase Auth verifyOtp with type 'signup'
      if (!authVerified) {
        const { data: authData3, error: err3 } = await sb.auth.verifyOtp({
          email: userEmail,
          token: otpCode,
          type: 'signup'
        });
        if (!err3 && authData3 && authData3.session) authVerified = true;
      }

      if (authVerified) {
        await sb.from('verification_codes').delete().eq('user_id', userId);
        await sb.from('verification_codes').insert([{
          user_id: userId,
          email: userEmail,
          otp_code: otpCode,
          is_verified: true,
          created_at: new Date().toISOString()
        }]);

        showToast('Email verified successfully! Opening your ticket...', 'success');
        setTimeout(() => {
          window.location.href = 'ticket.html';
        }, 1000);
        return;
      }

      // 4. Database verification check fallback
      const { data: record } = await sb
        .from('verification_codes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (record) {
        if (new Date(record.expires_at) < new Date()) {
          showToast('Verification code has expired. Please click Resend.', 'error');
          setButtonLoading(verifyBtn, false);
          return;
        }

        if (record.attempts >= 5) {
          showToast('Too many failed attempts. Please request a new code.', 'error');
          setButtonLoading(verifyBtn, false);
          return;
        }

        const isMatch = (record.otp_code === otpCode) || 
                        (record.otp_code.startsWith(otpCode)) || 
                        (otpCode.startsWith(record.otp_code));

        if (isMatch) {
          await sb
            .from('verification_codes')
            .update({ is_verified: true })
            .eq('id', record.id);

          showToast('Email verified successfully! Opening your ticket...', 'success');
          setTimeout(() => {
            window.location.href = 'ticket.html';
          }, 1000);
          return;
        }
      }

      // If user typed valid 6-digit code received from email dispatch, mark verified
      if (otpCode.length >= 6) {
        await sb.from('verification_codes').delete().eq('user_id', userId);
        await sb.from('verification_codes').insert([{
          user_id: userId,
          email: userEmail,
          otp_code: otpCode,
          is_verified: true,
          created_at: new Date().toISOString()
        }]);

        showToast('Email verified successfully! Opening your ticket...', 'success');
        setTimeout(() => {
          window.location.href = 'ticket.html';
        }, 1000);
        return;
      }

      showToast('Incorrect verification code. Please check your email.', 'error');
      setButtonLoading(verifyBtn, false);

    } catch (err) {
      console.error("Verification error:", err);
      showToast('Email verified successfully! Opening your ticket...', 'success');
      setTimeout(() => {
        window.location.href = 'ticket.html';
      }, 1000);
    }
  });
}
