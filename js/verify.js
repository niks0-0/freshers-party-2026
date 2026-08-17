/* ========================================================
   CRUD 2026 — DIRECT GMAIL OTP VERIFICATION LOGIC
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

// Trigger Direct Serverless Gmail OTP Dispatch
async function sendOtpCode() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;
  const fullName = currentUserAuth.profile?.full_name || currentUserAuth.user?.user_metadata?.full_name || 'Student';

  // Clear previous verification flags on fresh code request
  localStorage.removeItem(`crud2026_verified_${userId}`);
  sessionStorage.removeItem(`crud2026_verified_${userId}`);

  try {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        userId: userId,
        fullName: fullName
      })
    });

    const result = await response.json();

    if (!result.success) {
      if (response.status === 403) {
        showToast(result.message || 'Email OTP dispatch is currently paused by Admin.', 'error', 8000);
        return;
      }
      // Fallback: if serverless function not ready, try Supabase native fallback
      console.warn("Direct API note, trying fallback:", result.message);
      await sb.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: false }
      });
    }

    showToast(`Verification code sent to your Gmail (${maskEmail(userEmail)})! Check Inbox & Spam.`, 'info', 7000);
    startResendCountdown();

  } catch (err) {
    console.error("Error generating OTP:", err);
    try {
      await sb.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: false }
      });
      showToast(`Verification code sent to your Gmail!`, 'info', 6000);
    } catch (e) {
      console.error("Fallback error:", e);
    }
    startResendCountdown();
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

    if (otpCode.length !== 6) {
      showToast('Please enter the full 6-digit code.', 'error');
      return;
    }

    setButtonLoading(verifyBtn, true, 'Verifying 6-Digit Code...');

    const sb = window.getSupabase();
    const userId = currentUserAuth.user.id;
    const userEmail = currentUserAuth.user.email;

    try {
      // 1. Check against verification_codes table in Supabase
      const { data: records, error: dbErr } = await sb
        .from('verification_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('otp_code', otpCode)
        .order('created_at', { ascending: false })
        .limit(1);

      let isMatch = false;

      if (records && records.length > 0) {
        isMatch = true;
        // Mark as verified in database
        await sb
          .from('verification_codes')
          .update({ is_verified: true, updated_at: new Date().toISOString() })
          .eq('id', records[0].id);
      } else {
        // Fallback check: Supabase verifyOtp
        const { data: authVerify } = await sb.auth.verifyOtp({
          email: userEmail,
          token: otpCode,
          type: 'email'
        });
        if (authVerify && authVerify.session) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        showToast('Incorrect verification code! Please check your email inbox.', 'error');
        setButtonLoading(verifyBtn, false);
        clearOtpInputs();
        return;
      }

      // 2. PERSISTENT TICKET GENERATION: Mark ticket as is_generated = true in database
      const generatedTimestamp = new Date().toISOString();
      await sb
        .from('tickets')
        .update({ 
          is_generated: true, 
          generated_at: generatedTimestamp,
          updated_at: generatedTimestamp 
        })
        .eq('student_profile_id', userId);

      // Failsafe: also update by student_details id if student_profile_id is detail id
      const { data: sd } = await sb
        .from('student_details')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();

      if (sd && sd.id) {
        await sb
          .from('tickets')
          .update({ 
            is_generated: true, 
            generated_at: generatedTimestamp,
            updated_at: generatedTimestamp 
          })
          .eq('student_profile_id', sd.id);
      }

      // 3. Set Verified Proof Flags
      localStorage.setItem(`crud2026_verified_${userId}`, 'true');
      sessionStorage.setItem(`crud2026_verified_${userId}`, 'true');

      showToast('Email verified successfully! Opening your ticket pass...', 'success');
      setTimeout(() => {
        window.location.href = 'ticket.html';
      }, 600);

    } catch (err) {
      console.error("Verification error:", err);
      showToast('Incorrect verification code! Please check your email inbox.', 'error');
      setButtonLoading(verifyBtn, false);
      clearOtpInputs();
    }
  });
}

window.clearOtpInputs = clearOtpInputs;
