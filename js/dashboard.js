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
  const profile = currentUserAuth.profile;
  document.getElementById('student-name-display').textContent = profile.full_name || 'Student';
  document.getElementById('student-email-display').textContent = profile.email;
  document.getElementById('student-avatar-initial').textContent = (profile.full_name || 'S')[0].toUpperCase();

  try {
    // 1. Fetch Student Details (Course, Semester, Student ID, Mobile)
    const { data: details } = await sb
      .from('student_details')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle();

    if (details) {
      document.getElementById('student-id-display').textContent = details.student_id || 'N/A';
      document.getElementById('student-course-display').textContent = details.course || 'N/A';
      document.getElementById('student-semester-display').textContent = details.semester || 'N/A';
      document.getElementById('student-mobile-display').textContent = details.mobile || 'N/A';
    }

    // 2. Fetch Global Event Settings (Is Ticket LIVE?)
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live, event_name, event_date, venue')
      .limit(1)
      .single();

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

  } catch (err) {
    console.error("Error loading dashboard data:", err);
    showToast('Failed to load dashboard profile details.', 'error');
  }
}

function setupGenerateTicketButton() {
  const generateBtn = document.getElementById('generate-ticket-btn');
  if (!generateBtn) return;

  generateBtn.addEventListener('click', () => {
    // Perform Master Checklist Checks
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
