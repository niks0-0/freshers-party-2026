/* ========================================================
   FRESHERS PARTY 2026 — SECURE PROTECTED TICKET VIEWER
   ======================================================== */

let currentUserAuth = null;
let signedPdfUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  setupAntiProtectionListeners();
  await loadAndUnlockTicket();
});

// Security listeners: block right click, copy, and print shortcuts
function setupAntiProtectionListeners() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    // Block Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (Source), F12 (Inspect)
    if (
      (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u')) ||
      e.key === 'F12'
    ) {
      e.preventDefault();
      showToast('Action restricted. This digital pass is screenshot & download protected.', 'warning');
    }
  });
}

async function loadAndUnlockTicket() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  try {
    // 1. Render Student Name & Email Tag
    const nameEl = document.getElementById('ticket-student-name');
    const studentName = currentUserAuth.profile?.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student Ticket Pass';
    if (nameEl) nameEl.textContent = studentName;

    const emailTagEl = document.getElementById('ticket-email-tag');
    if (emailTagEl) emailTagEl.textContent = userEmail;

    // 2. Render Security Watermark Text with Student Details
    const watermarkEl = document.getElementById('watermark-text-display');
    if (watermarkEl) {
      watermarkEl.textContent = `CRUD 2026 • ISSUED TO: ${studentName.toUpperCase()} • ${userEmail.toUpperCase()} • DO NOT SHARE`;
    }

    // 3. Check Global LIVE State
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.ticket_live) {
      showErrorState("Tickets are currently OFF. The organizer has not released tickets yet.");
      return;
    }

    // 4. Check Verification Session Flags & Database Status
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

    // 5. Fetch Ticket Record from Database
    let { data: ticket } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    if (!ticket || !ticket.storage_path) {
      // Fallback: check by student_details id
      const { data: detail } = await sb
        .from('student_details')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();

      if (detail) {
        const { data: tFallback } = await sb
          .from('tickets')
          .select('*')
          .eq('student_profile_id', detail.id)
          .maybeSingle();

        if (tFallback) ticket = tFallback;
      }
    }

    if (!ticket || !ticket.storage_path) {
      showErrorState("Your individual ticket PDF has not been uploaded yet by administrators.");
      return;
    }

    // 6. Request Private Signed URL from Supabase Storage (Valid for 5 minutes)
    const { data: signedData, error: storageErr } = await sb
      .storage
      .from('tickets')
      .createSignedUrl(ticket.storage_path, 300, { download: false });

    if (storageErr || !signedData || !signedData.signedUrl) {
      console.error("Storage signed URL error:", storageErr);
      showErrorState("Failed to authorize private ticket access.");
      return;
    }

    signedPdfUrl = signedData.signedUrl;

    // Display Ticket ID
    const ticketIdEl = document.getElementById('display-ticket-id');
    if (ticketIdEl) {
      ticketIdEl.textContent = `Ticket ID: ${ticket.ticket_id || 'FP26-PASS'}`;
    }

    // Embed PDF into Viewer iframe with toolbar disabled
    const iframe = document.getElementById('pdf-frame');
    if (iframe) {
      // Add toolbar=0 and navpanes=0 to disable PDF viewer download/print buttons
      iframe.src = `${signedPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`;
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
