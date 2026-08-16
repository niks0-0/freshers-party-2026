/* ========================================================
   FRESHERS PARTY 2026 — STUDENT DASHBOARD LOGIC
   ======================================================== */

let currentUserAuth = null;
let ticketData = null;
let isTicketLive = false;
let isEmailVerified = false;

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

    // 2. Fetch Global Event Settings (Is Ticket LIVE?)
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live, event_name, event_date, venue')
      .limit(1)
      .maybeSingle();

    isTicketLive = settings ? settings.ticket_live : false;

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

    // 3. Fetch Ticket Record for this student
    const { data: tData } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    ticketData = tData;

    // 4. Fetch Verification Status for this student
    const { data: verifyRecord } = await sb
      .from('verification_codes')
      .select('is_verified')
      .eq('user_id', userId)
      .eq('is_verified', true)
      .maybeSingle();

    isEmailVerified = !!verifyRecord;

    // Render Ticket Status Box Text & Banner
    const statusBanner = document.getElementById('ticket-status-message');
    if (statusBanner) {
      if (!isTicketLive) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `🔒 <strong>Tickets are not live yet.</strong> Please wait for the administrator to release them.`;
      } else if (!ticketData) {
        statusBanner.className = 'info-banner danger-banner';
        statusBanner.innerHTML = `⚠️ <strong>Ticket pending upload.</strong> Your individual PDF ticket has not been uploaded by organizers yet.`;
      } else if (!isEmailVerified) {
        statusBanner.className = 'info-banner warning-banner';
        statusBanner.innerHTML = `📧 <strong>Email Verification Required.</strong> Click 'Generate Ticket' below to verify your email.`;
      } else {
        statusBanner.className = 'info-banner success-banner';
        statusBanner.innerHTML = `✓ <strong>Ticket Unlocked & Ready!</strong> Click below to view and download your ticket PDF.`;
      }
    }

  } catch (err) {
    console.error("Error loading dashboard data:", err);
  }
}

function setupGenerateTicketButton() {
  const generateBtn = document.getElementById('generate-ticket-btn');
  if (!generateBtn) return;

  generateBtn.addEventListener('click', () => {
    if (!isTicketLive) {
      showToast('Tickets are not live yet. Please wait for administrator release.', 'error');
      return;
    }

    if (!ticketData) {
      showToast('Your ticket has not been uploaded yet. Please contact administrators.', 'error');
      return;
    }

    if (!isEmailVerified) {
      showToast('Redirecting to email verification...', 'info');
      setTimeout(() => {
        window.location.href = 'verify.html';
      }, 1000);
      return;
    }

    // All checks pass -> Redirect to Ticket Viewer
    showToast('Unlocking your digital ticket...', 'success');
    setTimeout(() => {
      window.location.href = 'ticket.html';
    }, 1000);
  });
}
