/* ========================================================
   CRUD 2026 — STRICT MATHEMATICAL OTP COMPARISON LOGIC
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

function clearOtpInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach(input => input.value = '');
  if (inputs.length > 0) inputs[0].focus();
}

function getEnteredOtpCode() {
  const inputs = document.querySelectorAll('.otp-input');
  let code = '';
  inputs.forEach(input => code += input.value.trim());
  return code;
}

// Generate & Save Exact 6-Digit Numeric OTP Code
async function sendOtpCode() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  // Clear previous verification flags on fresh code request
  localStorage.removeItem(`crud2026_verified_${userId}`);
  sessionStorage.removeItem(`crud2026_verified_${userId}`);

  // Generate cryptographically secure 6-digit numeric OTP
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const otpCode = String(100000 + (array[0] % 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes expiry

  try {
    // 1. Delete existing OTP record for this user if present
    await sb.from('verification_codes').delete().eq('user_id', userId);

    // 2. Save new 6-digit OTP record in PostgreSQL database table
    const { error: insertErr } = await sb
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

    if (insertErr) {
      console.warn("OTP Insert Note:", insertErr);
    }

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
    const enteredOtpCode = getEnteredOtpCode();

    if (enteredOtpCode.length !== 6) {
      showToast('Please enter the full 6-digit code.', 'error');
      return;
    }

    setButtonLoading(verifyBtn, true, 'Verifying 6-Digit Code...');

    const sb = window.getSupabase();
    const userId = currentUserAuth.user.id;

    try {
      // 1. Fetch exact verification record from database
      const { data: record, error: fetchErr } = await sb
        .from('verification_codes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr || !record) {
        showToast('No active verification code found. Click Resend Code.', 'error');
        setButtonLoading(verifyBtn, false);
        clearOtpInputs();
        return;
      }

      // 2. Check Expiry
      if (new Date(record.expires_at) < new Date()) {
        showToast('Verification code has expired. Please click Resend Code.', 'error');
        setButtonLoading(verifyBtn, false);
        clearOtpInputs();
        return;
      }

      // 3. Check Failed Attempts Limit
      if (record.attempts >= 5) {
        showToast('Too many failed attempts. Please request a new code.', 'error');
        setButtonLoading(verifyBtn, false);
        clearOtpInputs();
        return;
      }

      // 4. STRICT EXACT COMPARISON (Sent OTP vs Received OTP Typed by User)
      const sentOtpCode = String(record.otp_code).trim();
      const userEnteredCode = String(enteredOtpCode).trim();

      // Check exact match (or prefix match if sent token is 8-digit)
      const isExactMatch = (sentOtpCode === userEnteredCode);
      const isPrefixMatch = (sentOtpCode.length >= 6 && sentOtpCode.startsWith(userEnteredCode));

      if (!isExactMatch && !isPrefixMatch) {
        // Increment failed attempts in DB
        await sb
          .from('verification_codes')
          .update({ attempts: (record.attempts || 0) + 1 })
          .eq('id', record.id);

        showToast('Incorrect verification code! Please check your email inbox.', 'error');
        setButtonLoading(verifyBtn, false);
        clearOtpInputs();
        return;
      }

      // 5. SUCCESS! Sent OTP matches Received OTP!
      await sb
        .from('verification_codes')
        .update({ is_verified: true })
        .eq('id', record.id);

      // Store local & session verification proof
      localStorage.setItem(`crud2026_verified_${userId}`, 'true');
      sessionStorage.setItem(`crud2026_verified_${userId}`, 'true');

      showToast('Email verified successfully! Opening your ticket...', 'success');
      setTimeout(() => {
        window.location.href = 'ticket.html';
      }, 600);

    } catch (err) {
      console.error("Verification error:", err);
      showToast('Verification failed. Incorrect code or connection error.', 'error');
      setButtonLoading(verifyBtn, false);
      clearOtpInputs();
    }
  });
}

window.clearOtpInputs = clearOtpInputs;
