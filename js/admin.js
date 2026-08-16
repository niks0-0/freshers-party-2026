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

    // Active Accounts
    const { count: activeCount } = await sb
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('is_active', true);

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
// 2. ADMIN STUDENTS MANAGEMENT
// --------------------------------------------------------
let allStudentsList = [];

async function initAdminStudentsPage() {
  await fetchAndRenderStudents();
  setupSearchAndFilters();
  setupCreateStudentModal();
}

async function fetchAndRenderStudents() {
  const sb = window.getSupabase();
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading registered students...</td></tr>`;

  try {
    const { data: students, error } = await sb
      .from('student_details')
      .select(`
        *,
        profile:profiles(id, is_active, role)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: tickets } = await sb
      .from('tickets')
      .select('student_profile_id, is_uploaded');

    const ticketMap = new Map();
    if (tickets) {
      tickets.forEach(t => ticketMap.set(t.student_profile_id, t.is_uploaded));
    }

    allStudentsList = (students || []).map(s => {
      const profileId = s.profile ? s.profile.id : s.profile_id;
      const isActive = s.profile ? s.profile.is_active : true;
      const hasTicket = profileId ? (ticketMap.get(profileId) || false) : false;
      return { ...s, profileId, isActive, hasTicket };
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
          <a href="student.html?id=${s.id}" class="btn btn-sm btn-secondary">Manage</a>
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
// 3. SINGLE STUDENT DETAIL & TICKET UPLOAD
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
      .select(`
        *,
        profile:profiles(id, email, is_active, role)
      `)
      .eq('id', detailId)
      .single();

    if (error || !student) throw error;
    currentStudentDetail = student;

    // Resolve profileId dynamically
    let profileId = student.profile ? student.profile.id : student.profile_id;
    if (!profileId) {
      const { data: pData } = await sb
        .from('profiles')
        .select('id')
        .eq('email', student.email)
        .maybeSingle();

      if (pData) {
        profileId = pData.id;
        await sb.from('student_details').update({ profile_id: profileId }).eq('id', student.id);
      }
    }

    // Render Student Details
    const nameEl = document.getElementById('detail-name');
    if (nameEl) nameEl.textContent = student.full_name;

    const emailEl = document.getElementById('detail-email');
    if (emailEl) emailEl.textContent = student.email;

    const courseEl = document.getElementById('detail-course');
    if (courseEl) courseEl.textContent = student.course;

    const mobileEl = document.getElementById('detail-mobile');
    if (mobileEl) mobileEl.textContent = student.mobile;

    if (profileId) {
      const { data: ticket } = await sb
        .from('tickets')
        .select('*')
        .eq('student_profile_id', profileId)
        .maybeSingle();

      const ticketStatusEl = document.getElementById('detail-ticket-status');
      if (ticketStatusEl) {
        if (ticket && ticket.storage_path) {
          ticketStatusEl.className = 'badge badge-live';
          ticketStatusEl.textContent = `UPLOADED (${ticket.ticket_id})`;
        } else {
          ticketStatusEl.className = 'badge badge-pending';
          ticketStatusEl.textContent = 'NOT UPLOADED';
        }
      }
    }

    setupTicketUploadForm(student, profileId);

  } catch (err) {
    console.error("Error fetching single student detail:", err);
    showToast('Failed to load student details.', 'error');
  }
}

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
      let effectiveProfileId = profileId;
      if (!effectiveProfileId) {
        const { data: pData } = await sb
          .from('profiles')
          .select('id')
          .eq('email', student.email)
          .maybeSingle();

        if (pData) {
          effectiveProfileId = pData.id;
        } else {
          effectiveProfileId = student.id;
        }
      }

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
      .select(`
        *,
        profile:profiles(id, email, full_name)
      `)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No ticket PDFs uploaded yet.</td></tr>`;
      return;
    }

    container.innerHTML = tickets.map(t => `
      <tr>
        <td><strong>${escapeHtml(t.ticket_id)}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(t.profile ? t.profile.full_name : 'N/A')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.profile ? t.profile.email : '')}</div>
        </td>
        <td>${formatDate(t.uploaded_at)}</td>
        <td><span class="badge badge-live">UPLOADED</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewPrivateTicket('${t.storage_path}')">View PDF</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error("Error loading tickets page:", err);
    container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load tickets.</td></tr>`;
  }
}

async function viewPrivateTicket(storagePath) {
  const sb = window.getSupabase();
  const { data, error } = await sb
    .storage
    .from('tickets')
    .createSignedUrl(storagePath, 300);

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
