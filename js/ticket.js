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
  const userEmail = currentUserAuth.user.email;

  try {
    // 1. Render Student Name
    const nameEl = document.getElementById('ticket-student-name');
    if (nameEl) {
      nameEl.textContent = currentUserAuth.profile?.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student Ticket Pass';
    }

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

    // 3. Check Verification Session Storage & Database
    const isSessionVerified = sessionStorage.getItem(`crud2026_verified_${userId}`) === 'true';

    const { data: verifyRecord } = await sb
      .from('verification_codes')
      .select('is_verified')
      .eq('user_id', userId)
      .eq('is_verified', true)
      .maybeSingle();

    if (!isSessionVerified && !verifyRecord) {
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

    // 5. Request Private Signed URL from Supabase Storage (Valid for 5 minutes)
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

    // Embed PDF into Viewer iframe
    const iframe = document.getElementById('pdf-frame');
    if (iframe) {
      iframe.src = signedPdfUrl;
    }

    // Configure Download Button
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (downloadBtn) {
      downloadBtn.href = signedPdfUrl;
      downloadBtn.setAttribute('download', `${ticket.ticket_id || 'CRUD_2026_Ticket'}.pdf`);
      downloadBtn.addEventListener('click', () => {
        showToast('Downloading your PDF ticket...', 'success');
      });
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
