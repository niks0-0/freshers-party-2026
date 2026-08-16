/* ========================================================
   FRESHERS PARTY 2026 — PURE SCREENSHOT & CAPTURE PREVENTOR
   ======================================================== */

let currentUserAuth = null;
let signedPdfUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  setupPureScreenshotProtection();
  await loadAndUnlockTicket();
});

// Pure anti-screenshot & anti-capture protection engine
function setupPureScreenshotProtection() {
  // 1. Disable Right Click, Text Select & Drag
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  // 2. Keyboard Screenshot & Record Key Combinations Blocker
  document.addEventListener('keyup', e => {
    if (e.key === 'PrintScreen') {
      triggerInstantBlurShield();
      navigator.clipboard.writeText(''); // Clear clipboard immediately
      showToast('Screenshot blocked! Copying ticket is restricted.', 'warning');
    }
  });

  document.addEventListener('keydown', e => {
    // PrintScreen key
    if (e.key === 'PrintScreen') {
      triggerInstantBlurShield();
      navigator.clipboard.writeText('');
      e.preventDefault();
      return;
    }

    // Ctrl/Cmd + P (Print), S (Save), U (Source), Shift+I/S (DevTools / Snipping Tool), Mac Cmd+Shift+3/4/5
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')
    ) {
      e.preventDefault();
      triggerInstantBlurShield();
      showToast('Action restricted. Screenshots & printing are protected.', 'warning');
    }

    if (e.key === 'F12') {
      e.preventDefault();
    }
  });

  // 3. Instant Window Blur Shield (Triggers when OS screenshot / App switcher / Snipping tool opens)
  window.addEventListener('blur', () => {
    document.body.classList.add('screen-protected');
  });

  window.addEventListener('focus', () => {
    document.body.classList.remove('screen-protected');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('screen-protected');
    } else {
      document.body.classList.remove('screen-protected');
    }
  });
}

function triggerInstantBlurShield() {
  document.body.classList.add('screen-protected');
  setTimeout(() => {
    document.body.classList.remove('screen-protected');
  }, 2000);
}

async function loadAndUnlockTicket() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  try {
    // 1. Render Student Name & Email Tag
    const studentName = currentUserAuth.profile?.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student';
    const nameEl = document.getElementById('ticket-student-name');
    if (nameEl) nameEl.textContent = studentName;

    const passNameEl = document.getElementById('pass-attendee-name');
    if (passNameEl) passNameEl.textContent = studentName;

    const emailTagEl = document.getElementById('ticket-email-tag');
    if (emailTagEl) emailTagEl.textContent = userEmail;

    // 2. Check Global LIVE State
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.ticket_live) {
      showErrorState("Tickets are currently OFF. The organizer has not released tickets yet.");
      return;
    }

    // 3. Check Verification Session Flags & Database Status
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
      console.warn("DB verification check note:", e);
    }

    const isAuthorized = isLocalVerified || isSessionVerified || isDbVerified;

    if (!isAuthorized) {
      showErrorState("Email verification required before accessing ticket.", "verify.html", "Verify Email Now");
      return;
    }

    // 4. Fetch Ticket Record from Database
    let { data: ticket } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    if (!ticket || !ticket.storage_path) {
      // Fallback: check by student_details id
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
    const ticketCode = ticket ? (ticket.ticket_id || 'FR002') : 'FR002';
    const passTicketIdEl = document.getElementById('pass-ticket-id');
    if (passTicketIdEl) passTicketIdEl.textContent = ticketCode;

    const qrImg = document.getElementById('pass-qr-image');
    if (qrImg) {
      const qrData = encodeURIComponent(`CRUD2026-ENTRY-${ticketCode}-${userEmail}`);
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
    }

    if (!ticket || !ticket.storage_path) {
      return;
    }

    // 5. Request Private Signed URL from Supabase Storage if PDF exists
    const { data: signedData, error: storageErr } = await sb
      .storage
      .from('tickets')
      .createSignedUrl(ticket.storage_path, 300, { download: false });

    if (!storageErr && signedData && signedData.signedUrl) {
      signedPdfUrl = signedData.signedUrl;
      const iframe = document.getElementById('pdf-frame');
      if (iframe) {
        iframe.src = `${signedPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`;
        iframe.style.display = 'block';
      }
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
