/* ========================================================
   FRESHERS PARTY 2026 — SECURE PROTECTED TICKET PASS PASS
   ======================================================== */

let currentUserAuth = null;
let liveClockInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  setupLiveSecondsClock();
  setupSecurityShortcutBlocker();
  await loadAndUnlockTicket();
});

// 1. Live Seconds Verification Clock Engine
function setupLiveSecondsClock() {
  const clockEl = document.getElementById('clock-timestamp-str');

  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    const formatted = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    clockEl.textContent = formatted;
  }

  updateClock();
  if (liveClockInterval) clearInterval(liveClockInterval);
  liveClockInterval = setInterval(updateClock, 1000);
}

// 2. Security Shortcut & Print Blocker
function setupSecurityShortcutBlocker() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  document.addEventListener('keyup', e => {
    if (e.key === 'PrintScreen') {
      navigator.clipboard.writeText('');
      showToast('Screenshot blocked! Ticket pass protected.', 'warning');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'PrintScreen') {
      navigator.clipboard.writeText('');
      e.preventDefault();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')
    ) {
      e.preventDefault();
      showToast('Screenshots and printing are restricted.', 'warning');
    }
    if (e.key === 'F12') {
      e.preventDefault();
    }
  });
}

async function loadAndUnlockTicket() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  try {
    const studentName = currentUserAuth.profile?.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student';
    const passNameEl = document.getElementById('pass-attendee-name');
    if (passNameEl) passNameEl.textContent = studentName;

    const emailTagEl = document.getElementById('ticket-email-tag');
    if (emailTagEl) emailTagEl.textContent = userEmail;

    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.ticket_live) {
      showErrorState("Tickets are currently OFF. The organizer has not released tickets yet.");
      return;
    }

    const isLocalVerified = localStorage.getItem(`crud2026_verified_${userId}`) === 'true';
    const isSessionVerified = sessionStorage.getItem(`crud2026_verified_${userId}`) === 'true';

    let isDbVerified = false;
    try {
      const { data: verifyRecord } = await sb
        .from('verification_codes')
        .select('is_verified')
        .eq('user_id', userId)
        .eq('is_verified', true)
        .maybeSingle();

      if (verifyRecord && verifyRecord.is_verified) {
        isDbVerified = true;
      }
    } catch (e) {
      console.warn("DB verification note:", e);
    }

    const isAuthorized = isLocalVerified || isSessionVerified || isDbVerified;

    if (!isAuthorized) {
      showErrorState("Email verification required before accessing ticket.", "verify.html", "Verify Email Now");
      return;
    }

    let { data: ticket } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    if (!ticket || !ticket.storage_path) {
      const { data: detail } = await sb
        .from('student_details')
        .select('id, full_name')
        .eq('email', userEmail)
        .maybeSingle();

      if (detail) {
        if (detail.full_name && passNameEl) passNameEl.textContent = detail.full_name;

        const { data: tFallback } = await sb
          .from('tickets')
          .select('*')
          .eq('student_profile_id', detail.id)
          .maybeSingle();

        if (tFallback) ticket = tFallback;
      }
    }

    // Display Ticket ID & QR Code
    const ticketCode = ticket ? (ticket.ticket_id || 'FP26-2331') : 'FP26-2331';
    const passTicketIdEl = document.getElementById('pass-ticket-id');
    if (passTicketIdEl) passTicketIdEl.textContent = ticketCode;

    const qrImg = document.getElementById('pass-qr-image');
    if (qrImg) {
      const qrData = encodeURIComponent(`CRUD2026-ENTRY-${ticketCode}-${userEmail}`);
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
    }

  } catch (err) {
    console.error("Error unlocking ticket:", err);
    showErrorState("An unexpected error occurred while loading your ticket.");
  }
}

function showErrorState(message, redirectUrl = "dashboard.html", redirectBtnText = "Back to Dashboard") {
  const viewerContainer = document.getElementById('ticket-viewer-content');
  const errorContainer = document.getElementById('ticket-error-state');
  const errorMessage = document.getElementById('ticket-error-message');
  const redirectBtn = document.getElementById('ticket-error-redirect-btn');

  if (viewerContainer) viewerContainer.style.display = 'none';
  if (errorMessage) errorMessage.textContent = message;
  if (redirectBtn) {
    redirectBtn.href = redirectUrl;
    redirectBtn.textContent = redirectBtnText;
  }
  if (errorContainer) errorContainer.style.display = 'block';
}
