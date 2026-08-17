/* ========================================================
   CRUD 2026 — STUDENT DASHBOARD LOGIC
   ======================================================== */

let currentUserAuth = null;
let ticketData = null;
let isTicketLive = false;
let isEmailOtpEnabled = true;

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

    // 3. Fetch Ticket Record for this student (Failsafe for Auth ID, Details ID, or Email)
    let { data: tData } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    if (!tData && details) {
      const targetIds = [details.id, details.profile_id].filter(Boolean).join(',');
      if (targetIds) {
        const { data: fallbackTicket } = await sb
          .from('tickets')
          .select('*')
          .or(`student_profile_id.eq.${details.id},student_profile_id.eq.${details.profile_id || userId}`)
          .maybeSingle();

        if (fallbackTicket) tData = fallbackTicket;
      }
    }

    ticketData = tData;

    // Render Ticket Status Box Text & Banner
    const statusBanner = document.getElementById('ticket-status-message');
    if (statusBanner) {
      if (!isTicketLive) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `🔒 <strong>Tickets are not live yet.</strong> Please wait for the administrator to release them.`;
      } else if (!ticketData) {
        statusBanner.className = 'info-banner danger-banner';
        statusBanner.innerHTML = `⚠️ <strong>Ticket pending upload.</strong> Your individual PDF ticket has not been uploaded by organizers yet.`;
      } else if (!isEmailOtpEnabled) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `🔒 <strong>Email OTP verification is currently paused by Admin.</strong> Please wait for organizers to enable OTP dispatch.`;
      } else {
        statusBanner.className = 'info-banner success-banner';
        statusBanner.innerHTML = `📧 <strong>Security OTP Verification Required.</strong> Click 'Generate Ticket' below to send a 6-digit OTP code to your Gmail inbox.`;
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
    if (!isTicketLive) {
      showToast('Tickets are not live yet. Please wait for administrator release.', 'error');
      return;
    }

    if (!ticketData) {
      showToast('Your ticket has not been uploaded yet. Please contact administrators.', 'error');
      return;
    }

    if (!isEmailOtpEnabled) {
      showToast('Email OTP dispatch is currently paused by event administrators.', 'error', 6000);
      return;
    }

    // ALWAYS FORCE FRESH EMAIL OTP VERIFICATION BEFORE ACCESSING TICKET!
    const sb = window.getSupabase();
    const userId = currentUserAuth.user.id;

    // Reset previous verification status so student MUST enter fresh OTP sent to Gmail
    await sb.from('verification_codes').delete().eq('user_id', userId);

    showToast('Sending fresh OTP code to your Gmail inbox...', 'info');
    setTimeout(() => {
      window.location.href = 'verify.html';
    }, 800);
  });
}
