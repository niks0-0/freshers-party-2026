/* ========================================================
   FRESHERS PARTY 2026 — ADMIN MANAGEMENT MODULE
   ======================================================== */

let adminAuth = null;
let dashboardRefreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Guard check for admin subfolder or root
  adminAuth = await requireAdminAuth();
  if (!adminAuth) return;

  // Initialize page-specific admin view based on current path
  const path = window.location.pathname;
  if (path.includes('dashboard.html')) {
    initAdminDashboard();
    // REALTIME AUTO-REFRESH EVERY 4 SECONDS
    if (!dashboardRefreshInterval) {
      dashboardRefreshInterval = setInterval(initAdminDashboard, 4000);
    }
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
// 1. ADMIN DASHBOARD STATS (REALTIME LIVE AUTO-REFRESH)
// --------------------------------------------------------
async function initAdminDashboard() {
  const sb = window.getSupabase();

  try {
    // Total Registrations (From student_details)
    const { count: totalCount } = await sb
      .from('student_details')
      .select('*', { count: 'exact', head: true });

    // Active Accounts (From student_details)
    const { count: activeCount } = await sb
      .from('student_details')
      .select('*', { count: 'exact', head: true });

    // Tickets Uploaded (From tickets where is_uploaded is true)
    const { count: ticketsUploadedCount } = await sb
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('is_uploaded', true);

    // Event Settings (Global Ticket LIVE, Email OTP & Registration)
    const { data: settings } = await sb
      .from('event_settings')
      .select('id, ticket_live, email_otp_enabled, registration_open')
      .limit(1)
      .maybeSingle();

    const isLive = settings ? settings.ticket_live : false;
    const isOtpEnabled = settings ? (settings.email_otp_enabled !== false) : true;
    const isRegOpen = settings ? (settings.registration_open !== false) : true;
    const actualTotal = totalCount || 0;
    const actualUploaded = ticketsUploadedCount || 0;
    const missingCount = Math.max(0, actualTotal - actualUploaded);

    // Render Stats to UI
    const totalEl = document.getElementById('stat-total-students');
    if (totalEl) totalEl.textContent = actualTotal;

    const activeEl = document.getElementById('stat-active-accounts');
    if (activeEl) activeEl.textContent = activeCount || 0;

    const uploadedEl = document.getElementById('stat-tickets-uploaded');
    if (uploadedEl) uploadedEl.textContent = actualUploaded;

    const missingEl = document.getElementById('stat-tickets-missing');
    if (missingEl) missingEl.textContent = missingCount;

    // 1. Render Dashboard Ticket Switch State & Badges
    const dashTicketToggle = document.getElementById('dashboard-ticket-live-toggle');
    const dashTicketBadge = document.getElementById('dash-ticket-badge');
    const dashTicketLabel = document.getElementById('dash-ticket-toggle-label');

    if (dashTicketBadge) {
      dashTicketBadge.innerHTML = isLive 
        ? `<span class="badge badge-live"><span class="badge-dot"></span> LIVE</span>` 
        : `<span class="badge badge-off"><span class="badge-dot"></span> OFF</span>`;
    }
    if (dashTicketLabel) {
      dashTicketLabel.textContent = isLive ? 'Tickets are LIVE 🟢' : 'Tickets are OFF 🔴';
    }
    if (dashTicketToggle && !dashTicketToggle.dataset.bound) {
      dashTicketToggle.checked = isLive;
      dashTicketToggle.dataset.bound = 'true';

      dashTicketToggle.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        if (dashTicketBadge) {
          dashTicketBadge.innerHTML = isChecked 
            ? `<span class="badge badge-live"><span class="badge-dot"></span> LIVE</span>` 
            : `<span class="badge badge-off"><span class="badge-dot"></span> OFF</span>`;
        }
        if (dashTicketLabel) {
          dashTicketLabel.textContent = isChecked ? 'Tickets are LIVE 🟢' : 'Tickets are OFF 🔴';
        }

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ ticket_live: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings?.id || 'd50387d3-f794-4778-9e88-d7afcee561ee');

        if (updateErr) {
          showToast('Failed to update ticket status.', 'error');
          e.target.checked = !isChecked;
        } else {
          showToast(`Global Tickets are now ${isChecked ? 'LIVE 🟢' : 'OFF 🔴'}`, isChecked ? 'success' : 'info');
        }
      });
    } else if (dashTicketToggle) {
      dashTicketToggle.checked = isLive;
    }

    // 2. Render Dashboard Email OTP Switch State & Badges
    const dashOtpToggle = document.getElementById('dashboard-email-otp-toggle');
    const dashOtpBadge = document.getElementById('dash-otp-badge');
    const dashOtpLabel = document.getElementById('dash-otp-toggle-label');

    if (dashOtpBadge) {
      dashOtpBadge.innerHTML = isOtpEnabled 
        ? `<span class="badge badge-live"><span class="badge-dot"></span> ALLOWED</span>` 
        : `<span class="badge badge-off"><span class="badge-dot"></span> BLOCKED</span>`;
    }
    if (dashOtpLabel) {
      dashOtpLabel.textContent = isOtpEnabled ? 'OTP Emails ALLOWED 🟢' : 'OTP Emails BLOCKED 🔴';
    }
    if (dashOtpToggle && !dashOtpToggle.dataset.bound) {
      dashOtpToggle.checked = isOtpEnabled;
      dashOtpToggle.dataset.bound = 'true';

      dashOtpToggle.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        if (dashOtpBadge) {
          dashOtpBadge.innerHTML = isChecked 
            ? `<span class="badge badge-live"><span class="badge-dot"></span> ALLOWED</span>` 
            : `<span class="badge badge-off"><span class="badge-dot"></span> BLOCKED</span>`;
        }
        if (dashOtpLabel) {
          dashOtpLabel.textContent = isChecked ? 'OTP Emails ALLOWED 🟢' : 'OTP Emails BLOCKED 🔴';
        }

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ email_otp_enabled: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings?.id || 'd50387d3-f794-4778-9e88-d7afcee561ee');

        if (updateErr) {
          showToast('Failed to update OTP status.', 'error');
          e.target.checked = !isChecked;
        } else {
          showToast(`Email OTP Dispatch is now ${isChecked ? 'ALLOWED 🟢' : 'BLOCKED 🔴'}`, isChecked ? 'success' : 'warning');
        }
      });
    } else if (dashOtpToggle) {
      dashOtpToggle.checked = isOtpEnabled;
    }

    // 3. Render Dashboard Student Registration Switch State & Badges
    const dashRegToggle = document.getElementById('dashboard-registration-toggle');
    const dashRegBadge = document.getElementById('dash-reg-badge');
    const dashRegLabel = document.getElementById('dash-reg-toggle-label');

    if (dashRegBadge) {
      dashRegBadge.innerHTML = isRegOpen 
        ? `<span class="badge badge-live"><span class="badge-dot"></span> OPEN</span>` 
        : `<span class="badge badge-off"><span class="badge-dot"></span> CLOSED</span>`;
    }
    if (dashRegLabel) {
      dashRegLabel.textContent = isRegOpen ? 'Registration OPEN 🟢' : 'Registration CLOSED 🔴';
    }
    if (dashRegToggle && !dashRegToggle.dataset.bound) {
      dashRegToggle.checked = isRegOpen;
      dashRegToggle.dataset.bound = 'true';

      dashRegToggle.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        if (dashRegBadge) {
          dashRegBadge.innerHTML = isChecked 
            ? `<span class="badge badge-live"><span class="badge-dot"></span> OPEN</span>` 
            : `<span class="badge badge-off"><span class="badge-dot"></span> CLOSED</span>`;
        }
        if (dashRegLabel) {
          dashRegLabel.textContent = isChecked ? 'Registration OPEN 🟢' : 'Registration CLOSED 🔴';
        }

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ registration_open: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings?.id || 'd50387d3-f794-4778-9e88-d7afcee561ee');

        if (updateErr) {
          showToast('Failed to update registration status.', 'error');
          e.target.checked = !isChecked;
        } else {
          showToast(`Student Registration is now ${isChecked ? 'OPEN 🟢' : 'CLOSED 🔴'}`, isChecked ? 'success' : 'warning');
        }
      });
    } else if (dashRegToggle) {
      dashRegToggle.checked = isRegOpen;
    }

  } catch (err) {
    console.error("Error loading admin stats:", err);
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
      .select('student_profile_id, ticket_id, is_uploaded, storage_path, ticket_url');

    const ticketMap = new Map();
    if (tickets) {
      tickets.forEach(t => {
        if (t.student_profile_id) ticketMap.set(t.student_profile_id, t);
        if (t.ticket_id) ticketMap.set(t.ticket_id.toLowerCase().trim(), t);
      });
    }

    allStudentsList = (students || []).map(s => {
      const matchedProfile = (s.profile_id ? profileMap.get(s.profile_id) : null) || (s.email ? profileMap.get(s.email.toLowerCase()) : null);
      const profileId = matchedProfile ? matchedProfile.id : (s.profile_id || s.id);
      const isActive = matchedProfile ? matchedProfile.is_active : true;
      const ticketRecord = ticketMap.get(profileId) || 
                           ticketMap.get(s.id) || 
                           ticketMap.get(s.profile_id) || 
                           (s.student_id ? ticketMap.get(s.student_id.toLowerCase().trim()) : null);
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
// EXCEL BULK IMPORT MODAL ENGINE (FAILSAFE BULK IMPORTER)
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

          // 2. Insert or Update student_details directly with 'registered' status
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
              registration_status: 'registered'
            }], { onConflict: 'email' })
            .select();

          let targetId = detailData && detailData[0] ? detailData[0].id : null;
          let targetProfileId = authUserId || (detailData && detailData[0] ? (detailData[0].profile_id || detailData[0].id) : null);

          if (!targetId) {
            const { data: existingSd } = await sb
              .from('student_details')
              .select('id, profile_id')
              .eq('email', student.email)
              .maybeSingle();

            if (existingSd) {
              targetId = existingSd.id;
              targetProfileId = authUserId || existingSd.profile_id || existingSd.id;
            }
          }

          successCount++;

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

        } catch (e) {
          console.error("Excel single import error:", e);
        }
      }

      setButtonLoading(importBtn, false);
      showToast(`Successfully processed ${successCount} student records from Excel sheet!`, 'success');
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
    // 1. Delete student details record
    const { error: detailErr } = await sb
      .from('student_details')
      .delete()
      .eq('id', detailId);

    if (detailErr) throw detailErr;

    // 2. Clean up associated tickets by profileId and detailId
    if (detailId) {
      await sb.from('tickets').delete().eq('student_profile_id', detailId);
    }
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

    // Populate Edit Form Inputs
    const nameInput = document.getElementById('edit-name');
    if (nameInput) nameInput.value = student.full_name || '';

    const emailInput = document.getElementById('edit-email');
    if (emailInput) emailInput.value = student.email || '';

    const courseSelect = document.getElementById('edit-course');
    if (courseSelect) {
      courseSelect.value = student.course || 'BCA';
      if (!Array.from(courseSelect.options).some(opt => opt.value === student.course)) {
        const opt = document.createElement('option');
        opt.value = student.course;
        opt.textContent = student.course;
        courseSelect.appendChild(opt);
        courseSelect.value = student.course;
      }
    }

    const mobileInput = document.getElementById('edit-mobile');
    if (mobileInput) mobileInput.value = (student.mobile && student.mobile !== 'N/A') ? student.mobile : '';

    const ticketUrlInput = document.getElementById('edit-ticket-url');

    let existingTicket = null;
    if (profileId || student.id) {
      let queryOr = `student_profile_id.eq.${profileId},student_profile_id.eq.${student.id}`;
      if (student.student_id) {
        queryOr += `,ticket_id.eq.${student.student_id}`;
      }
      const { data: ticket } = await sb
        .from('tickets')
        .select('*')
        .or(queryOr)
        .maybeSingle();

      if (ticket) existingTicket = ticket;
    }

    if (ticketUrlInput && existingTicket && existingTicket.ticket_url) {
      ticketUrlInput.value = existingTicket.ticket_url;
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

    setupEditProfileForm(student, profileId || student.id, existingTicket);
    setupTicketUploadForm(student, profileId || student.id);

  } catch (err) {
    console.error("Error fetching single student detail:", err);
    showToast('Failed to load student details.', 'error');
  }
}

function setupEditProfileForm(student, profileId, existingTicket) {
  const form = document.getElementById('edit-student-profile-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-profile-btn');
    const newName = document.getElementById('edit-name').value.trim();
    const newEmail = document.getElementById('edit-email').value.trim().toLowerCase();
    const newMobile = document.getElementById('edit-mobile').value.trim();
    const newCourse = document.getElementById('edit-course').value;
    const newTicketUrl = document.getElementById('edit-ticket-url').value.trim();

    if (!newName || !newEmail || !newCourse) {
      showToast('Name, Email and Course are required.', 'error');
      return;
    }

    setButtonLoading(saveBtn, true, 'Saving Changes...');
    const sb = window.getSupabase();

    try {
      // 1. Update Auth User Account & Database details atomically via SECURITY DEFINER RPC
      const targetUserId = student.profile_id || profileId || student.id;
      const { data: rpcRes, error: rpcErr } = await sb.rpc('admin_update_student_auth', {
        p_user_id: targetUserId,
        p_new_email: newEmail,
        p_new_name: newName,
        p_new_mobile: newMobile || 'N/A',
        p_new_course: newCourse,
        p_new_ticket_url: newTicketUrl || null
      });

      if (rpcErr) {
        console.warn("RPC update notice, proceeding with direct sync:", rpcErr);
      }

      // 2. Direct Table Updates Failsafe
      const { error: sdErr } = await sb
        .from('student_details')
        .update({
          full_name: newName,
          email: newEmail,
          mobile: newMobile || 'N/A',
          course: newCourse,
          semester: newCourse.includes('Sem-3') ? 'Sem 3' : 'Sem 1',
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id);

      if (sdErr) throw sdErr;

      // 3. Update profiles if profile_id exists
      if (student.profile_id) {
        await sb
          .from('profiles')
          .update({
            full_name: newName,
            email: newEmail,
            updated_at: new Date().toISOString()
          })
          .eq('id', student.profile_id);
      }

      // 4. Update or Insert Google Drive Ticket URL if provided
      if (newTicketUrl) {
        const ticketId = existingTicket?.ticket_id || student.student_id || `FP26-${Math.floor(1000 + Math.random() * 9000)}`;
        await sb
          .from('tickets')
          .upsert({
            student_profile_id: profileId,
            ticket_id: ticketId,
            ticket_url: newTicketUrl,
            storage_path: existingTicket?.storage_path || null,
            is_uploaded: true,
            uploaded_at: new Date().toISOString()
          }, { onConflict: 'student_profile_id' });
      }

      showToast('Student profile & login email updated successfully!', 'success');
      setTimeout(() => location.reload(), 1000);

    } catch (err) {
      console.error("Profile update error:", err);
      showToast(err.message || 'Failed to update student profile.', 'error');
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });
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
  const { data: signedData, error } = await sb
    .storage
    .from('tickets')
    .createSignedUrl(storagePathOrUrl, 300);

  if (error || !signedData) {
    showToast('Failed to open PDF ticket.', 'error');
    return;
  }
  window.open(signedData.signedUrl, '_blank');
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

    const otpSwitch = document.getElementById('global-email-otp-toggle');
    if (otpSwitch) {
      const isOtpEnabled = settings.email_otp_enabled !== false; // default true
      otpSwitch.checked = isOtpEnabled;
      updateOtpSwitchLabel(isOtpEnabled);

      otpSwitch.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        updateOtpSwitchLabel(isChecked);

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ email_otp_enabled: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings.id);

        if (updateErr) {
          showToast('Failed to update Email OTP status.', 'error');
          e.target.checked = !isChecked;
          updateOtpSwitchLabel(!isChecked);
        } else {
          showToast(`Email OTP Dispatch is now ${isChecked ? 'ALLOWED 🟢' : 'BLOCKED / PAUSED 🔴'}`, isChecked ? 'success' : 'warning');
        }
      });
    }

    const regSwitch = document.getElementById('global-registration-toggle');
    if (regSwitch) {
      const isRegOpen = settings.registration_open !== false; // default true
      regSwitch.checked = isRegOpen;
      updateRegSwitchLabel(isRegOpen);

      regSwitch.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        updateRegSwitchLabel(isChecked);

        const { error: updateErr } = await sb
          .from('event_settings')
          .update({ registration_open: isChecked, updated_at: new Date().toISOString() })
          .eq('id', settings.id);

        if (updateErr) {
          showToast('Failed to update registration status.', 'error');
          e.target.checked = !isChecked;
          updateRegSwitchLabel(!isChecked);
        } else {
          showToast(`Student Registration is now ${isChecked ? 'OPEN 🟢' : 'CLOSED 🔴'}`, isChecked ? 'success' : 'warning');
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

function updateOtpSwitchLabel(isEnabled) {
  const label = document.getElementById('otp-switch-status-label');
  if (!label) return;
  if (isEnabled) {
    label.className = 'badge badge-live';
    label.innerHTML = `<span class="badge-dot"></span> OTP EMAILS ALLOWED`;
  } else {
    label.className = 'badge badge-off';
    label.innerHTML = `<span class="badge-dot"></span> OTP EMAILS BLOCKED (PAUSED)`;
  }
}

function updateRegSwitchLabel(isOpen) {
  const label = document.getElementById('reg-switch-status-label');
  if (!label) return;
  if (isOpen) {
    label.className = 'badge badge-live';
    label.innerHTML = `<span class="badge-dot"></span> REGISTRATION OPEN`;
  } else {
    label.className = 'badge badge-off';
    label.innerHTML = `<span class="badge-dot"></span> REGISTRATION CLOSED`;
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
