/* ========================================================
   FRESHERS PARTY 2026 — DIGITAL TICKET VIEWER & IFRAME PREVIEW
   ======================================================== */

let currentUserAuth = null;
let signedPdfUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUserAuth = await requireStudentAuth();
  if (!currentUserAuth) return;

  await loadAndUnlockTicket();

  // Single-Use Security: Clear verification token when student leaves ticket page
  window.addEventListener('beforeunload', () => {
    if (currentUserAuth && currentUserAuth.user) {
      sessionStorage.removeItem(`crud2026_verified_${currentUserAuth.user.id}`);
      localStorage.removeItem(`crud2026_verified_${currentUserAuth.user.id}`);
    }
  });
});

// Helper to convert any Google Drive URL into a clean iframe preview URL
function getGoogleDriveEmbedUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  
  let fileId = null;
  const matchFileD = url.match(/\/file\/d\/([^\/\?#]+)/);
  if (matchFileD) {
    fileId = matchFileD[1];
  } else {
    const matchId = url.match(/id=([^\&]+)/);
    if (matchId) fileId = matchId[1];
  }

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  return url;
}

async function loadAndUnlockTicket() {
  const sb = window.getSupabase();
  const userId = currentUserAuth.user.id;
  const userEmail = currentUserAuth.user.email;

  try {
    const nameEl = document.getElementById('ticket-student-name');
    if (nameEl) {
      nameEl.textContent = currentUserAuth.profile?.full_name || currentUserAuth.user.user_metadata?.full_name || 'Student Ticket Pass';
    }

    // CHECK 1: Master Admin Ticket Release Switch
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.ticket_live) {
      localStorage.removeItem(`crud2026_verified_${userId}`);
      sessionStorage.removeItem(`crud2026_verified_${userId}`);
      showErrorState("Tickets are currently locked by the administrator. Please wait for official release.", "dashboard.html", "Back to Dashboard");
      return;
    }

    // Failsafe Ticket Lookup by Auth ID or Details ID or Email
    let { data: ticket } = await sb
      .from('tickets')
      .select('*')
      .eq('student_profile_id', userId)
      .maybeSingle();

    const { data: detail } = await sb
      .from('student_details')
      .select('id, profile_id')
      .eq('email', userEmail)
      .maybeSingle();

    if (!ticket && detail) {
      const { data: tFallback } = await sb
        .from('tickets')
        .select('*')
        .or(`student_profile_id.eq.${detail.id},student_profile_id.eq.${detail.profile_id || userId}`)
        .maybeSingle();

      if (tFallback) ticket = tFallback;
    }

    if (!ticket || (!ticket.storage_path && !ticket.ticket_url)) {
      showErrorState("Your individual ticket PDF has not been uploaded yet by administrators.", "dashboard.html", "Back to Dashboard");
      return;
    }

    // CHECK 2: Authorization: Must have completed active OTP verification
    const isSessionVerified = sessionStorage.getItem(`crud2026_verified_${userId}`) === 'true';

    if (!isSessionVerified) {
      showErrorState("Security OTP verification required. Please verify via email OTP to view your ticket pass.", "dashboard.html", "Go to Verification 🔐");
      return;
    }

    // Resolve PDF URL (from ticket_url or storage_path)
    let pdfDisplayUrl = ticket.ticket_url || null;

    if (!pdfDisplayUrl && ticket.storage_path) {
      const { data: signedData, error: storageErr } = await sb
        .storage
        .from('tickets')
        .createSignedUrl(ticket.storage_path, 300, { download: false });

      if (!storageErr && signedData && signedData.signedUrl) {
        pdfDisplayUrl = signedData.signedUrl;
      }
    }

    if (!pdfDisplayUrl) {
      showErrorState("Failed to authorize private ticket access.", "dashboard.html", "Back to Dashboard");
      return;
    }

    signedPdfUrl = pdfDisplayUrl;

    const ticketIdEl = document.getElementById('display-ticket-id');
    if (ticketIdEl) {
      ticketIdEl.textContent = `Ticket ID: ${ticket.ticket_id || 'FP26-PASS'}`;
    }

    const directOpenBtn = document.getElementById('direct-pdf-open-btn');
    if (directOpenBtn) {
      directOpenBtn.href = signedPdfUrl;
      directOpenBtn.style.display = 'inline-flex';
    }

    const downloadBtn = document.getElementById('direct-pdf-download-btn');
    if (downloadBtn) {
      if (signedPdfUrl.includes('drive.google.com')) {
        let fileId = null;
        const matchFileD = signedPdfUrl.match(/\/file\/d\/([^\/\?#]+)/);
        if (matchFileD) fileId = matchFileD[1];
        downloadBtn.href = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : signedPdfUrl;
      } else {
        downloadBtn.href = signedPdfUrl;
      }
      downloadBtn.style.display = 'inline-flex';
    }

    // Check if URL is a Google Drive link -> Render in direct embedded Iframe!
    if (pdfDisplayUrl.includes('drive.google.com')) {
      const embedUrl = getGoogleDriveEmbedUrl(pdfDisplayUrl);
      const loadingEl = document.getElementById('pdf-loading-spinner');
      const canvas = document.getElementById('pdf-render-canvas');
      const iframe = document.getElementById('pdf-frame');

      if (loadingEl) loadingEl.style.display = 'none';
      if (canvas) canvas.style.display = 'none';
      if (iframe) {
        iframe.src = embedUrl;
        iframe.style.display = 'block';
        iframe.style.height = '600px';
      }
      return;
    }

    // Otherwise render Supabase uploaded PDF using PDF.js
    await renderPdfWithPdfJs(signedPdfUrl);

  } catch (err) {
    console.error("Error unlocking ticket:", err);
    showErrorState("An unexpected error occurred while loading your ticket.", "dashboard.html", "Back to Dashboard");
  }
}

async function renderPdfWithPdfJs(url) {
  const canvas = document.getElementById('pdf-render-canvas');
  const loadingEl = document.getElementById('pdf-loading-spinner');
  const iframe = document.getElementById('pdf-frame');

  if (!window.pdfjsLib || !canvas) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (iframe) {
      iframe.src = `${url}#toolbar=0&navpanes=0&scrollbar=0`;
      iframe.style.display = 'block';
      iframe.style.height = '600px';
    }
    return;
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2.0 });
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    if (loadingEl) loadingEl.style.display = 'none';
    canvas.style.display = 'block';

  } catch (err) {
    console.error("PDF.js render error, fallback to iframe:", err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (iframe) {
      iframe.src = `${url}#toolbar=0&navpanes=0&scrollbar=0`;
      iframe.style.display = 'block';
      iframe.style.height = '600px';
    }
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
