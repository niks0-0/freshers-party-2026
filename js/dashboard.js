/* ========================================================
   CRUD 2026 — STUDENT DASHBOARD LOGIC (PERSISTENT LIFECYCLE)
   ======================================================== */

let currentUserAuth = null;
let ticketData = null;
let isTicketLive = false;
let isEmailOtpEnabled = true;
let isTicketAlreadyGenerated = false;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  await loadStudentDashboardData();
  setupGenerateTicketButton();
});

async function loadStudentDashboardData() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  // Render User Name & Email
  const profile = currentUserAuth.profile || {};
  const nameDisplay = profile.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student';

  const nameHeader = document.getElementById('student-name-header');
  if (nameHeader) nameHeader.textContent = `Welcome, ${nameDisplay} 👋`;

  const nameEl = document.getElementById('student-name-display');
  if (nameEl) nameEl.textContent = nameDisplay;

  const emailEl = document.getElementById('student-email-display');
  if (emailEl) emailEl.textContent = userEmail;

  const avatarEl = document.getElementById('student-avatar-initial');
  if (avatarEl) avatarEl.textContent = (nameDisplay || 'S')[0].toUpperCase();

  try {
    // 1. Fetch Student Details (Course, Mobile)
    const { data: details } = await sb
      .from('student_details')
      .select('*')
      .or(`profile_id.eq.${userId},email.eq.${userEmail}`)
      .limit(1)
      .maybeSingle();

    if (details) {
      const mobileEl = document.getElementById('student-mobile-display');
      if (mobileEl) mobileEl.textContent = details.mobile || 'N/A';

      const courseEl = document.getElementById('student-course-display');
      if (courseEl) courseEl.textContent = details.course || 'N/A';

      if (details.full_name) {
        if (nameEl) nameEl.textContent = details.full_name;
        if (avatarEl) avatarEl.textContent = details.full_name[0].toUpperCase();
      }
    }

    // 2. Fetch Global Event Settings (Is Ticket LIVE? & Is Email OTP Allowed?)
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live, email_otp_enabled, event_name, event_date, venue')
      .limit(1)
      .maybeSingle();

    isTicketLive = settings ? settings.ticket_live : false;
    isEmailOtpEnabled = settings ? (settings.email_otp_enabled !== false) : true;

    // Update LIVE/OFF badge on Dashboard UI
    const ticketLiveBadge = document.getElementById('ticket-live-badge');
    if (ticketLiveBadge) {
      if (isTicketLive) {
        ticketLiveBadge.className = 'badge badge-live';
        ticketLiveBadge.innerHTML = `<span class="badge-dot"></span> TICKETS LIVE`;
      } else {
        ticketLiveBadge.className = 'badge badge-off';
        ticketLiveBadge.innerHTML = `<span class="badge-dot"></span> TICKETS OFF`;
      }
    }

    // 3. Fetch Ticket Record for this student (Bulletproof Failsafe for Auth ID, Details ID, Student ID)
    let { data: tData } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    if (!tData && details) {
      let queryOr = `student_profile_id.eq.${details.id}`;
      if (details.profile_id) queryOr += `,student_profile_id.eq.${details.profile_id}`;
      if (details.student_id) queryOr += `,ticket_id.eq.${details.student_id}`;

      const { data: fallbackTicket } = await sb
        .from('tickets')
        .select('*')
        .or(queryOr)
        .maybeSingle();

      if (fallbackTicket) tData = fallbackTicket;
    }

    ticketData = tData;

    // 4. Check if student has already generated/verified their ticket once
    let isDbVerified = false;
    try {
      const { data: verifyRecord } = await sb
        .from('verification_codes')
        .select('is_verified')
        .eq('user_id', userId)
        .eq('is_verified', true)
        .limit(1);

      if (verifyRecord && verifyRecord.length > 0) {
        isDbVerified = true;
      }
    } catch (e) {
      console.warn("Verify record check note:", e);
    }

    isTicketAlreadyGenerated = (ticketData && ticketData.is_generated) || isDbVerified;

    // 4. Render Dynamic Ticket Status Banner & Button States
    const statusBanner = document.getElementById('ticket-status-message');
    const generateBtn = document.getElementById('generate-ticket-btn');
    const blurredStub = document.querySelector('.blurred-stub');
    const lockIcon = document.querySelector('.lock-icon');

    if (statusBanner && generateBtn) {
      // STATE 1: Master Tickets OFF (Strict Admin Lockout)
      if (!isTicketLive) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `🔒 <strong>Tickets are currently locked by Admin.</strong> Please wait for organizers to release tickets.`;
        generateBtn.textContent = 'TICKETS CURRENTLY LOCKED 🔒';
        generateBtn.className = 'btn btn-secondary btn-full';
        generateBtn.disabled = true;
        if (blurredStub) blurredStub.textContent = 'CRUD26-LOCKED';
        if (lockIcon) lockIcon.textContent = '🔒';
      }
      // STATE 2: Missing Ticket Record in DB
      else if (!ticketData) {
        statusBanner.className = 'info-banner danger-banner';
        statusBanner.innerHTML = `⚠️ <strong>Ticket pending upload.</strong> Your individual PDF ticket has not been uploaded by organizers yet.`;
        generateBtn.textContent = 'TICKET PENDING UPLOAD ⚠️';
        generateBtn.className = 'btn btn-secondary btn-full';
        generateBtn.disabled = true;
      }
      // STATE 3: Tickets LIVE but Email OTP Paused by Admin
      else if (!isEmailOtpEnabled) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `🔒 <strong>Email OTP verification is currently paused by Admin.</strong> Please wait for organizers to enable OTP dispatch.`;
        generateBtn.textContent = 'OTP VERIFICATION PAUSED 🔒';
        generateBtn.className = 'btn btn-secondary btn-full';
        generateBtn.disabled = true;
        if (blurredStub) blurredStub.textContent = 'CRUD26-PAUSED';
        if (lockIcon) lockIcon.textContent = '⏳';
      }
      // STATE 4: Ready for OTP Verification (Tickets LIVE + OTP ALLOWED)
      else {
        statusBanner.className = 'info-banner success-banner';
        statusBanner.innerHTML = `📧 <strong>Security Verification Required:</strong> Click 'Verify & Get Ticket' below to send a fresh 6-digit OTP code to your Gmail inbox.`;
        generateBtn.textContent = 'VERIFY & GET TICKET 🎟️';
        generateBtn.className = 'btn btn-primary btn-full';
        generateBtn.disabled = false;
        if (blurredStub) blurredStub.textContent = 'CRUD26-PASS';
        if (lockIcon) lockIcon.textContent = '🔐';
      }
    }

  } catch (err) {
    console.error("Error loading dashboard data:", err);
  }
}

function setupGenerateTicketButton() {
  const generateBtn = document.getElementById('generate-ticket-btn');
  if (!generateBtn) return;

  generateBtn.addEventListener('click', async () => {
    // Check 1: Master Ticket Live Switch
    if (!isTicketLive) {
      showToast('Tickets are currently locked by the administrator.', 'error');
      return;
    }

    // Check 2: Ticket Record Exists
    if (!ticketData) {
      showToast('Your ticket has not been uploaded yet. Please contact administrators.', 'error');
      return;
    }

    // Check 3: If Email OTP is paused
    if (!isEmailOtpEnabled) {
      showToast('Email OTP dispatch is currently paused by event administrators.', 'error', 6000);
      return;
    }

    const userId = currentUserAuth.user.id;

    // Trigger Fresh OTP Verification Flow
    const sb = window.getSupabase();
    await sb.from('verification_codes').delete().eq('user_id', userId);

    showToast('Sending fresh OTP code to your Gmail inbox...', 'info');
    setTimeout(() => {
      window.location.href = 'verify.html';
    }, 600);
  });
}
