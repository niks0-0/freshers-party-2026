/* ========================================================
   FRESHERS PARTY 2026 — SECURE TICKET VIEWER & DOWNLOADER
   ======================================================== */

let currentUserAuth = null;
let signedPdfUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  await loadAndUnlockTicket();
});

async function loadAndUnlockTicket() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;

  const loadingSpinner = document.getElementById('ticket-loading-state');
  const errorContainer = document.getElementById('ticket-error-state');
  const viewerContainer = document.getElementById('ticket-viewer-content');

  try {
    // 1. Check Global LIVE State
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .single();

    if (!settings || !settings.ticket_live) {
      showErrorState("Tickets are currently OFF. The organizer has not released tickets yet.");
      return;
    }

    // 2. Check Email Verification Status
    const { data: verifyRecord } = await sb
      .from('verification_codes')
      .select('is_verified')
      .eq('user_id', userId)
      .eq('is_verified', true)
      .maybeSingle();

    if (!verifyRecord) {
      showErrorState("Email verification required before accessing ticket.", "verify.html", "Verify Email Now");
      return;
    }

    // 3. Fetch Ticket Record from Database
    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .single();

    if (ticketErr || !ticket || !ticket.storage_path) {
      showErrorState("Your individual ticket PDF has not been uploaded yet by administrators.");
      return;
    }

    // 4. Request Private Signed URL from Supabase Storage (Valid for 5 minutes)
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

    // Display Ticket Info
    const ticketIdEl = document.getElementById('display-ticket-id');
    if (ticketIdEl) ticketIdEl.textContent = ticket.ticket_id || 'FP26-TICKET';

    // Embed PDF into Viewer iframe
    const iframe = document.getElementById('pdf-frame');
    if (iframe) {
      iframe.src = signedPdfUrl;
    }

    // Configure Download Button
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (downloadBtn) {
      downloadBtn.href = signedPdfUrl;
      downloadBtn.setAttribute('download', `${ticket.ticket_id || 'Freshers_Party_2026_Ticket'}.pdf`);
      downloadBtn.addEventListener('click', () => {
        showToast('Downloading your PDF ticket...', 'success');
      });
    }

    // Show Viewer Container
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (viewerContainer) viewerContainer.style.display = 'block';

  } catch (err) {
    console.error("Error unlocking ticket:", err);
    showErrorState("An unexpected error occurred while loading your ticket.");
  }
}

function showErrorState(message, redirectUrl = "dashboard.html", redirectBtnText = "Back to Dashboard") {
  const loadingSpinner = document.getElementById('ticket-loading-state');
  const errorContainer = document.getElementById('ticket-error-state');
  const errorMessage = document.getElementById('ticket-error-message');
  const redirectBtn = document.getElementById('ticket-error-redirect-btn');

  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (errorMessage) errorMessage.textContent = message;
  if (redirectBtn) {
    redirectBtn.href = redirectUrl;
    redirectBtn.textContent = redirectBtnText;
  }
  if (errorContainer) errorContainer.style.display = 'block';
}
