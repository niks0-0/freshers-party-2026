/* ========================================================
   FRESHERS PARTY 2026 — ADMIN MANAGEMENT MODULE
   ======================================================== */

let adminAuth = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Guard check for admin subfolder or root
  adminAuth = await requireAdminAuth();
  if (!adminAuth) return;

  // Initialize page-specific admin view based on current path
  const path = window.location.pathname;
  if (path.includes('dashboard.html')) {
    initAdminDashboard();
  } else if (path.includes('students.html')) {
    initAdminStudentsPage();
  } else if (path.includes('student.html')) {
    initAdminSingleStudentPage();
  } else if (path.includes('tickets.html')) {
    initAdminTicketsPage();
  } else if (path.includes('settings.html')) {
    initAdminSettingsPage();
  }
});

// --------------------------------------------------------
// 1. ADMIN DASHBOARD STATS
// --------------------------------------------------------
async function initAdminDashboard() {
  const sb = window.getSupabase();

  try {
    // Total Registrations
    const { count: totalCount } = await sb
      .from('student_details')
      .select('*', { count: 'exact', head: true });

    // Active Accounts (From student_details)
    const { count: activeCount } = await sb
      .from('student_details')
      .select('*', { count: 'exact', head: true });

    // Tickets Uploaded
    const { count: ticketsUploadedCount } = await sb
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('is_uploaded', true);

    // Event Settings (Global Ticket LIVE)
    const { data: settings } = await sb
      .from('event_settings')
      .select('ticket_live')
      .limit(1)
      .maybeSingle();

    const isLive = settings ? settings.ticket_live : false;
    const missingCount = Math.max(0, (totalCount || 0) - (ticketsUploadedCount || 0));

    // Render Stats to UI
    const totalEl = document.getElementById('stat-total-students');
    if (totalEl) totalEl.textContent = totalCount || 0;

    const activeEl = document.getElementById('stat-active-accounts');
    if (activeEl) activeEl.textContent = activeCount || 0;

    const uploadedEl = document.getElementById('stat-tickets-uploaded');
    if (uploadedEl) uploadedEl.textContent = ticketsUploadedCount || 0;

    const missingEl = document.getElementById('stat-tickets-missing');
    if (missingEl) missingEl.textContent = missingCount;

    const statusBadgeEl = document.getElementById('stat-ticket-live-status');
    if (statusBadgeEl) {
      if (isLive) {
        statusBadgeEl.className = 'badge badge-live';
        statusBadgeEl.innerHTML = `<span class="badge-dot"></span> LIVE`;
      } else {
        statusBadgeEl.className = 'badge badge-off';
        statusBadgeEl.innerHTML = `<span class="badge-dot"></span> OFF`;
      }
    }

  } catch (err) {
    console.error("Error loading admin stats:", err);
    showToast('Failed to load live statistics.', 'error');
  }
}

// --------------------------------------------------------
// 2. ADMIN STUDENTS MANAGEMENT & EXCEL BULK IMPORT
// --------------------------------------------------------
let allStudentsList = [];
let parsedExcelStudents = [];

async function initAdminStudentsPage() {
  await fetchAndRenderStudents();
  setupSearchAndFilters();
  setupCreateStudentModal();
  setupExcelImportModal();
}

async function fetchAndRenderStudents() {
  const sb = window.getSupabase();
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading registered students...</td></tr>`;

  try {
    const { data: students, error } = await sb
      .from('student_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, is_active, role');

    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(p => {
        profileMap.set(p.id, p);
        if (p.email) profileMap.set(p.email.toLowerCase(), p);
      });
    }

    const { data: tickets } = await sb
      .from('tickets')
      .select('student_profile_id, is_uploaded, storage_path, ticket_url');

    const ticketMap = new Map();
    if (tickets) {
      tickets.forEach(t => {
        ticketMap.set(t.student_profile_id, t);
      });
    }

    allStudentsList = (students || []).map(s => {
      const matchedProfile = (s.profile_id ? profileMap.get(s.profile_id) : null) || (s.email ? profileMap.get(s.email.toLowerCase()) : null);
      const profileId = matchedProfile ? matchedProfile.id : (s.profile_id || s.id);
      const isActive = matchedProfile ? matchedProfile.is_active : true;
      const ticketRecord = ticketMap.get(profileId) || ticketMap.get(s.id) || ticketMap.get(s.profile_id);
      const hasTicket = ticketRecord ? (ticketRecord.is_uploaded || !!ticketRecord.ticket_url) : false;
      return { ...s, profileId, isActive, hasTicket, ticketRecord };
    });

    renderStudentsTable(allStudentsList);

  } catch (err) {
    console.error("Error fetching students:", err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to load students list.</td></tr>`;
  }
}

function renderStudentsTable(students) {
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;

  if (students.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;">No students found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = students.map(s => `
    <tr>
      <td>
        <div style="font-weight: 600;">${escapeHtml(s.full_name)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(s.email)}</div>
      </td>
      <td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc;">${escapeHtml(s.course)}</span></td>
      <td>${escapeHtml(s.mobile)}</td>
      <td>
        ${s.isActive 
          ? `<span class="badge badge-live">Active</span>` 
          : `<span class="badge badge-off">Inactive</span>`}
      </td>
      <td>
        ${s.hasTicket 
          ? `<span class="badge badge-live">Uploaded</span>` 
          : `<span class="badge badge-pending">Missing</span>`}
      </td>
      <td>
        <div class="table-actions">
          <a href="student.html?id=${s.id}" class="btn btn-sm btn-secondary">Manage Profile & Ticket</a>
          <button class="btn btn-sm ${s.isActive ? 'btn-danger' : 'btn-success'}" onclick="toggleAccountStatus('${s.profileId || s.id}', '${s.email}', ${!s.isActive})">
            ${s.isActive ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.id}', '${s.profileId || ''}', '${escapeHtml(s.full_name)}')">
            Delete 🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById('student-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allStudentsList.filter(s => 
      s.full_name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.course.toLowerCase().includes(query)
    );
    renderStudentsTable(filtered);
  });
}

// --------------------------------------------------------
// EXCEL BULK IMPORT MODAL ENGINE (BULK TICKET URL IMPORTER)
// --------------------------------------------------------
function setupExcelImportModal() {
  const fileInput = document.getElementById('excel-file-input');
  const importBtn = document.getElementById('import-excel-submit-btn');
  const previewArea = document.getElementById('excel-preview-area');
  const countEl = document.getElementById('excel-parsed-count');
  const sampleEl = document.getElementById('excel-parsed-sample');

  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        parsedExcelStudents = [];

        rawJson.forEach((row, idx) => {
          let name = '';
          let email = '';
          let mobile = 'N/A';
          let course = 'BCA';
          let ticketUrl = '';
          let ticketId = '';

          // STRICT & FLEXIBLE KEY MATCHING (WITH GOOGLE DRIVE TICKET URL MATCH)
          Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase().trim();
            const val = String(row[key] || '').trim();

            if (!name && (lowerKey === 'name' || lowerKey === 'full name' || lowerKey === 'fullname' || lowerKey === 'student name')) {
              name = val;
            }
            if (!email && (lowerKey === 'email' || lowerKey.includes('email') || lowerKey.includes('mail'))) {
              email = val.toLowerCase();
            }
            if (lowerKey.includes('mobile') || lowerKey.includes('phone') || lowerKey.includes('contact') || lowerKey.includes('no')) {
              if (val && val !== 'N/A') mobile = val;
            }
            if (lowerKey.includes('course') || lowerKey.includes('stream') || lowerKey.includes('branch')) {
              if (val) course = val;
            }
            // Match Column H (Merged Doc URL / Google Drive Ticket URL)
            if (lowerKey.includes('merged doc url') || lowerKey.includes('ticket url') || lowerKey.includes('link to merged doc') || lowerKey.includes('doc url') || (val.startsWith('http') && !lowerKey.includes('qr'))) {
              if (val && val.startsWith('http')) ticketUrl = val;
            }
            if (lowerKey.includes('ticket id') || lowerKey.includes('ticketid')) {
              if (val) ticketId = val;
            }
          });

          // Fallback name search if key wasn't named exact
          if (!name && row['name']) name = String(row['name']).trim();
          if (!name && row['Name']) name = String(row['Name']).trim();

          // Fallback email generation if name exists
          if (name && !email) {
            const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            email = `${cleanName || 'student'}${idx + 1}@freshers2026.com`;
          }

          if (name && email) {
            parsedExcelStudents.push({
              fullName: name,
              email: email,
              mobile: mobile || 'N/A',
              course: course || 'BCA',
              ticketUrl: ticketUrl || '',
              ticketId: ticketId || `FP26-${Math.floor(1000 + Math.random() * 9000)}`
            });
          }
        });

        if (parsedExcelStudents.length > 0) {
          if (previewArea) previewArea.style.display = 'block';
          if (countEl) countEl.textContent = `✅ Ready to import/update ${parsedExcelStudents.length} student ticket records`;
          if (sampleEl) {
            sampleEl.innerHTML = parsedExcelStudents.slice(0, 5).map(s => `
              <div>• <strong>${escapeHtml(s.fullName)}</strong> (${escapeHtml(s.email)}) — ${escapeHtml(s.course)} ${s.ticketUrl ? '📄 [Google Drive Ticket Link Found]' : ''}</div>
            `).join('') + (parsedExcelStudents.length > 5 ? `<div style="margin-top:0.3rem;">...and ${parsedExcelStudents.length - 5} more records</div>` : '');
          }
          if (importBtn) importBtn.disabled = false;
        } else {
          showToast('No valid student rows found in Excel sheet.', 'error');
          if (importBtn) importBtn.disabled = true;
        }

      } catch (err) {
        console.error("Excel parse error:", err);
        showToast('Failed to read Excel file format.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  });

  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      if (parsedExcelStudents.length === 0) return;

      setButtonLoading(importBtn, true, `Processing ${parsedExcelStudents.length} Students...`);
      const sb = window.getSupabase();
      let successCount = 0;

      for (const student of parsedExcelStudents) {
        try {
          // 1. Create Auth User Account in background if possible
          let authUserId = null;
          try {
            const { data: authData } = await sb.auth.signUp({
              email: student.email,
              password: 'Freshers@2026',
              options: {
                data: { full_name: student.fullName, role: 'student' }
              }
            });
            if (authData && authData.user) authUserId = authData.user.id;
          } catch (e) {
            console.warn("Auth signup note:", e);
          }

          // 2. Insert or Update student_details directly
          const { data: detailData, error: detailErr } = await sb
            .from('student_details')
            .upsert([{
              profile_id: authUserId || null,
              student_id: student.ticketId || `FP26-${Math.floor(100000 + Math.random() * 900000)}`,
              full_name: student.fullName,
              email: student.email,
              mobile: student.mobile,
              course: student.course,
              semester: student.course.includes('Sem-3') ? 'Sem 3' : 'Sem 1',
              registration_status: 'excel_imported'
            }], { onConflict: 'email' })
            .select();

          if (detailErr) {
            console.error("student_details upsert error:", detailErr);
          } else {
            successCount++;
            const targetId = detailData && detailData[0] ? detailData[0].id : null;
            const targetProfileId = authUserId || (detailData && detailData[0] ? (detailData[0].profile_id || detailData[0].id) : null);

            // 3. Upsert Ticket URL directly linked to Student Detail ID & Profile ID
            if (student.ticketUrl) {
              if (targetProfileId) {
                await sb
                  .from('tickets')
                  .upsert({
                    student_profile_id: targetProfileId,
                    ticket_id: student.ticketId || `FP26-${Math.floor(1000 + Math.random() * 9000)}`,
                    ticket_url: student.ticketUrl,
                    storage_path: null,
                    is_uploaded: true,
                    uploaded_at: new Date().toISOString()
                  }, { onConflict: 'student_profile_id' });
              }

              if (targetId && targetId !== targetProfileId) {
                await sb
                  .from('tickets')
                  .upsert({
                    student_profile_id: targetId,
                    ticket_id: student.ticketId || `FP26-${Math.floor(1000 + Math.random() * 9000)}`,
                    ticket_url: student.ticketUrl,
                    storage_path: null,
                    is_uploaded: true,
                    uploaded_at: new Date().toISOString()
                  }, { onConflict: 'student_profile_id' });
              }
            }
          }

        } catch (e) {
          console.error("Excel single import error:", e);
        }
      }

      setButtonLoading(importBtn, false);
      showToast(`Successfully processed ${successCount} student tickets from Excel sheet!`, 'success');
      closeModal('excel-import-modal');

      // Re-fetch and re-render directory table immediately
      await fetchAndRenderStudents();
    });
  }
}

// Enable or Disable Account
async function toggleAccountStatus(profileId, email, newStatus) {
  const sb = window.getSupabase();
  try {
    if (profileId) {
      await sb.from('profiles').update({ is_active: newStatus }).eq('id', profileId);
    } else {
      await sb.from('profiles').update({ is_active: newStatus }).eq('email', email);
    }

    showToast(`Account status updated to ${newStatus ? 'Active' : 'Disabled'}.`, 'success');
    await fetchAndRenderStudents();
  } catch (err) {
    console.error("Error toggling account status:", err);
    showToast('Failed to update account status.', 'error');
  }
}
window.toggleAccountStatus = toggleAccountStatus;

// DELETE STUDENT ACTION
async function deleteStudent(detailId, profileId, studentName) {
  if (!confirm(`Are you sure you want to permanently delete student "${studentName}"?`)) {
    return;
  }

  const sb = window.getSupabase();
  try {
    const { error: detailErr } = await sb
      .from('student_details')
      .delete()
      .eq('id', detailId);

    if (detailErr) throw detailErr;

    if (profileId) {
      await sb.from('tickets').delete().eq('student_profile_id', profileId);
      await sb.from('verification_codes').delete().eq('user_id', profileId);
      await sb.from('profiles').delete().eq('id', profileId);
    }

    showToast(`Student "${studentName}" deleted successfully!`, 'success');
    await fetchAndRenderStudents();

  } catch (err) {
    console.error("Error deleting student:", err);
    showToast('Failed to delete student record.', 'error');
  }
}
window.deleteStudent = deleteStudent;

// Create Account Modal Logic
function setupCreateStudentModal() {
  const modalForm = document.getElementById('create-student-account-form');
  if (!modalForm) return;

  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('create-account-submit-btn');

    const email = document.getElementById('create-email').value.trim().toLowerCase();
    const password = document.getElementById('create-password').value.trim();
    const fullName = document.getElementById('create-fullname').value.trim();
    const course = document.getElementById('create-course').value;

    if (!email || !password || !fullName || !course) {
      showToast('Please fill all fields.', 'error');
      return;
    }

    setButtonLoading(submitBtn, true, 'Creating Account...');
    const sb = window.getSupabase();

    try {
      const { data: authUser } = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName, role: 'student' }
        }
      });

      const autoStudentId = `FP26-${Math.floor(100000 + Math.random() * 900000)}`;

      const { data: existingDetail } = await sb
        .from('student_details')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingDetail) {
        await sb
          .from('student_details')
          .update({
            profile_id: authUser?.user?.id || null,
            registration_status: 'account_created',
            course: course
          })
          .eq('id', existingDetail.id);
      } else {
        await sb
          .from('student_details')
          .insert([{
            profile_id: authUser?.user?.id || null,
            student_id: autoStudentId,
            full_name: fullName,
            email: email,
            mobile: 'N/A',
            course: course,
            semester: course.includes('Sem-3') ? 'Sem 3' : 'Sem 1',
            registration_status: 'account_created'
          }]);
      }

      showToast('Student account created successfully!', 'success');
      closeModal('create-student-modal');
      modalForm.reset();
      await fetchAndRenderStudents();

    } catch (err) {
      console.error("Create student account error:", err);
      showToast(err.message || 'Failed to create student account.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

// --------------------------------------------------------
// 3. SINGLE STUDENT DETAIL & TICKET UPLOAD / DELETE
// --------------------------------------------------------
let currentStudentDetail = null;

async function initAdminSingleStudentPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const detailId = urlParams.get('id');

  if (!detailId) {
    window.location.href = 'students.html';
    return;
  }

  const sb = window.getSupabase();
  try {
    const { data: student, error } = await sb
      .from('student_details')
      .select('*')
      .eq('id', detailId)
      .single();

    if (error || !student) throw error;
    currentStudentDetail = student;

    // Resolve profileId dynamically
    let profileId = student.profile_id || student.id;

    // Render Student Details
    const nameEl = document.getElementById('detail-name');
    if (nameEl) nameEl.textContent = student.full_name;

    const emailEl = document.getElementById('detail-email');
    if (emailEl) emailEl.textContent = student.email;

    const courseEl = document.getElementById('detail-course');
    if (courseEl) courseEl.textContent = student.course;

    const mobileEl = document.getElementById('detail-mobile');
    if (mobileEl) mobileEl.textContent = student.mobile;

    let existingTicket = null;
    if (profileId || student.id) {
      const { data: ticket } = await sb
        .from('tickets')
        .select('*')
        .or(`student_profile_id.eq.${profileId},student_profile_id.eq.${student.id}`)
        .maybeSingle();

      if (ticket) existingTicket = ticket;
    }

    // Update UI elements for Ticket Status & File Box
    const ticketStatusEl = document.getElementById('detail-ticket-status');
    const infoBox = document.getElementById('uploaded-file-info-box');
    const filenameEl = document.getElementById('uploaded-filename-text');
    const uploadLabel = document.getElementById('upload-file-label');

    if (existingTicket && (existingTicket.storage_path || existingTicket.ticket_url)) {
      const fileNameOnly = existingTicket.storage_path ? existingTicket.storage_path.split('/').pop() : (existingTicket.ticket_url ? 'Google Drive PDF Link' : 'ticket.pdf');

      if (ticketStatusEl) {
        ticketStatusEl.className = 'badge badge-live';
        ticketStatusEl.textContent = `UPLOADED (${existingTicket.ticket_id})`;
      }

      if (infoBox) infoBox.style.display = 'block';
      if (filenameEl) filenameEl.textContent = `📄 ${fileNameOnly}`;
      if (uploadLabel) uploadLabel.textContent = `Select New PDF File to Replace Existing Ticket (.pdf) *`;

      // Setup View PDF button
      const viewBtn = document.getElementById('view-current-ticket-btn');
      if (viewBtn) {
        viewBtn.onclick = () => viewPrivateTicket(existingTicket.storage_path || existingTicket.ticket_url);
      }

      // Setup Delete Ticket button
      const deleteBtn = document.getElementById('delete-current-ticket-btn');
      if (deleteBtn) {
        deleteBtn.onclick = () => deleteStudentTicket(profileId || student.id, existingTicket.storage_path);
      }

    } else {
      if (ticketStatusEl) {
        ticketStatusEl.className = 'badge badge-pending';
        ticketStatusEl.textContent = 'NOT UPLOADED';
      }
      if (infoBox) infoBox.style.display = 'none';
      if (uploadLabel) uploadLabel.textContent = `Select PDF File (.pdf, Max 10MB) *`;
    }

    setupTicketUploadForm(student, profileId || student.id);

  } catch (err) {
    console.error("Error fetching single student detail:", err);
    showToast('Failed to load student details.', 'error');
  }
}

// DELETE STUDENT TICKET FUNCTION
async function deleteStudentTicket(profileId, storagePath) {
  if (!confirm("Are you sure you want to delete this student's uploaded PDF ticket?")) {
    return;
  }

  const sb = window.getSupabase();
  try {
    if (storagePath) {
      await sb.storage.from('tickets').remove([storagePath]);
    }
    await sb.from('tickets').delete().eq('student_profile_id', profileId);

    showToast('Ticket PDF deleted successfully!', 'success');
    setTimeout(() => location.reload(), 1000);

  } catch (err) {
    console.error("Error deleting ticket:", err);
    showToast('Failed to delete ticket.', 'error');
  }
}
window.deleteStudentTicket = deleteStudentTicket;

function setupTicketUploadForm(student, profileId) {
  const uploadForm = document.getElementById('ticket-upload-form');
  if (!uploadForm) return;

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uploadBtn = document.getElementById('upload-ticket-submit-btn');
    const pdfFileInput = document.getElementById('ticket-pdf-file');

    const file = pdfFileInput.files[0];
    if (!file) {
      showToast('Please select a PDF file to upload.', 'error');
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showToast('Only PDF files are allowed.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB.', 'error');
      return;
    }

    setButtonLoading(uploadBtn, true, 'Uploading Ticket PDF...');
    const sb = window.getSupabase();

    try {
      let effectiveProfileId = profileId || student.id;

      const ticketId = `FP26-${Math.floor(1000 + Math.random() * 9000)}`;
      const storagePath = `student_${effectiveProfileId}/${ticketId}_ticket.pdf`;

      const { error: storageErr } = await sb
        .storage
        .from('tickets')
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (storageErr) throw storageErr;

      const { error: ticketDbErr } = await sb
        .from('tickets')
        .upsert({
          student_profile_id: effectiveProfileId,
          ticket_id: ticketId,
          storage_path: storagePath,
          ticket_url: null,
          is_uploaded: true,
          uploaded_at: new Date().toISOString()
        }, { onConflict: 'student_profile_id' });

      if (ticketDbErr) {
        console.warn("DB record note:", ticketDbErr);
      }

      showToast(`Ticket PDF (${ticketId}) uploaded successfully!`, 'success');
      setTimeout(() => location.reload(), 1200);

    } catch (err) {
      console.error("Ticket upload error:", err);
      showToast(err.message || 'Ticket upload failed.', 'error');
    } finally {
      setButtonLoading(uploadBtn, false);
    }
  });
}

// --------------------------------------------------------
// 4. ADMIN TICKETS OVERVIEW PAGE
// --------------------------------------------------------
async function initAdminTicketsPage() {
  const sb = window.getSupabase();
  const container = document.getElementById('tickets-overview-table-body');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading tickets list...</td></tr>`;

  try {
    const { data: tickets, error } = await sb
      .from('tickets')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No ticket PDFs uploaded yet.</td></tr>`;
      return;
    }

    container.innerHTML = tickets.map(t => {
      const fileNameOnly = t.storage_path ? t.storage_path.split('/').pop() : (t.ticket_url ? 'Google Drive PDF Link' : 'ticket.pdf');
      const targetPath = t.storage_path || t.ticket_url;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(t.ticket_id)}</strong> <br>
            <span style="font-size: 0.78rem; color: #34d399; font-family: monospace;">📄 ${escapeHtml(fileNameOnly)}</span>
          </td>
          <td>
            <div style="font-weight: 600;">Student Ticket Pass</div>
          </td>
          <td>${formatDate(t.uploaded_at)}</td>
          <td><span class="badge badge-live">UPLOADED</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-secondary" onclick="viewPrivateTicket('${targetPath}')">👁️ View PDF</button>
              <button class="btn btn-sm btn-danger" onclick="deleteStudentTicket('${t.student_profile_id}', '${t.storage_path}')">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loading tickets page:", err);
    container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load tickets.</td></tr>`;
  }
}

async function viewPrivateTicket(storagePathOrUrl) {
  const sb = window.getSupabase();
  if (storagePathOrUrl.startsWith('http')) {
    window.open(storagePathOrUrl, '_blank');
    return;
  }
  const { data, error } = await sb
    .storage
    .from('tickets')
    .createSignedUrl(storagePathOrUrl, 300);

  if (error || !data) {
    showToast('Failed to open PDF ticket.', 'error');
    return;
  }
  window.open(data.signedUrl, '_blank');
}
window.viewPrivateTicket = viewPrivateTicket;

// --------------------------------------------------------
// 5. ADMIN SETTINGS & GLOBAL LIVE/OFF SWITCH
// --------------------------------------------------------
async function initAdminSettingsPage() {
  const sb = window.getSupabase();

  try {
    const { data: settings, error } = await sb
      .from('event_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !settings) throw error;

    document.getElementById('event-name-input').value = settings.event_name || '';
    document.getElementById('event-date-input').value = settings.event_date || '';
    document.getElementById('event-time-input').value = settings.event_time || '';
    document.getElementById('event-venue-input').value = settings.venue || '';
    document.getElementById('event-college-input').value = settings.college_name || '';
    document.getElementById('event-instructions-input').value = settings.instructions || '';

    const liveSwitch = document.getElementById('global-ticket-live-toggle');
    if (liveSwitch) {
      liveSwitch.checked = settings.ticket_live;
      updateSwitchLabel(settings.ticket_live);

      liveSwitch.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        updateSwitchLabel(isChecked);

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ ticket_live: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings.id);

        if (updateErr) {
          showToast('Failed to update ticket LIVE status.', 'error');
          e.target.checked = !isChecked;
          updateSwitchLabel(!isChecked);
        } else {
          showToast(`Global Tickets are now ${isChecked ? 'LIVE 🟢' : 'OFF 🔴'}`, isChecked ? 'success' : 'info');
        }
      });
    }

    const form = document.getElementById('event-settings-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-settings-submit-btn');

        setButtonLoading(submitBtn, true, 'Saving Settings...');

        const updatedData = {
          event_name: document.getElementById('event-name-input').value.trim(),
          event_date: document.getElementById('event-date-input').value,
          event_time: document.getElementById('event-time-input').value.trim(),
          venue: document.getElementById('event-venue-input').value.trim(),
          college_name: document.getElementById('event-college-input').value.trim(),
          instructions: document.getElementById('event-instructions-input').value.trim(),
          updated_at: new Date().toISOString()
        };

        const { error: saveErr } = await sb
          .from('event_settings')
          .update(updatedData)
          .eq('id', settings.id);

        setButtonLoading(submitBtn, false);

        if (saveErr) {
          showToast('Failed to save event settings.', 'error');
        } else {
          showToast('Event settings saved successfully!', 'success');
        }
      });
    }

  } catch (err) {
    console.error("Error loading settings page:", err);
    showToast('Failed to load event settings.', 'error');
  }
}

function updateSwitchLabel(isLive) {
  const label = document.getElementById('switch-status-label');
  if (!label) return;
  if (isLive) {
    label.className = 'badge badge-live';
    label.innerHTML = `<span class="badge-dot"></span> TICKETS LIVE`;
  } else {
    label.className = 'badge badge-off';
    label.innerHTML = `<span class="badge-dot"></span> TICKETS OFF`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
