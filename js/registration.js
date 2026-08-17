/* ========================================================
   FRESHERS PARTY 2026 — PUBLIC LANDING & REGISTRATION LOGIC
   ======================================================== */

const FIXED_STUDENT_PASSWORD = "Freshers@2026";
let isRegistrationOpen = true;

document.addEventListener('DOMContentLoaded', () => {
  loadEventSettings();
  setupRegistrationForm();
});

// Fetch event details dynamically from Supabase event_settings table
async function loadEventSettings() {
  const sb = window.getSupabase();
  if (!sb) return;

  try {
    const { data: settings, error } = await sb
      .from('event_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !settings) {
      console.warn("Using default event settings fallback:", error);
      return;
    }

    // 1. Check Registration Status (OPEN / CLOSED)
    isRegistrationOpen = settings.registration_open !== false;

    const heroRegBadge = document.getElementById('hero-reg-badge');
    const formWrapper = document.getElementById('registration-form-wrapper');
    const closedBox = document.getElementById('registration-closed-box');
    const navRegItem = document.getElementById('nav-reg-item');

    if (isRegistrationOpen) {
      if (heroRegBadge) {
        heroRegBadge.className = 'badge badge-live';
        heroRegBadge.innerHTML = `<span class="badge-dot"></span> 🎉 REGISTRATION OPEN FOR BATCH 2026`;
      }
      if (formWrapper) formWrapper.style.display = 'block';
      if (closedBox) closedBox.style.display = 'none';
      if (navRegItem) navRegItem.style.display = 'inline-block';
    } else {
      if (heroRegBadge) {
        heroRegBadge.className = 'badge badge-off';
        heroRegBadge.innerHTML = `<span class="badge-dot"></span> 🔒 REGISTRATIONS CLOSED`;
      }
      if (formWrapper) formWrapper.style.display = 'none';
      if (closedBox) closedBox.style.display = 'block';
      if (navRegItem) navRegItem.style.display = 'none';
    }

    // 2. Update Hero & Event Details UI
    const eventNameEls = document.querySelectorAll('.event-name-display');
    eventNameEls.forEach(el => el.textContent = settings.event_name);

    const eventDateEl = document.getElementById('display-event-date');
    if (eventDateEl && settings.event_date) {
      eventDateEl.textContent = formatDate(settings.event_date);
    }

    const eventTimeEl = document.getElementById('display-event-time');
    if (eventTimeEl && settings.event_time) {
      eventTimeEl.textContent = settings.event_time;
    }

    const venueEl = document.getElementById('display-event-venue');
    if (venueEl && settings.venue) {
      venueEl.textContent = settings.venue;
    }

    const collegeEl = document.getElementById('display-college-name');
    if (collegeEl && settings.college_name) {
      collegeEl.textContent = settings.college_name;
    }

    const instructionsEl = document.getElementById('display-instructions');
    if (instructionsEl && settings.instructions) {
      instructionsEl.textContent = settings.instructions;
    }

    const mapsLinkEl = document.getElementById('display-maps-link');
    if (mapsLinkEl && settings.google_maps_url) {
      mapsLinkEl.href = settings.google_maps_url;
    }
  } catch (err) {
    console.error("Error loading event settings:", err);
  }
}

// Setup Form Submission
function setupRegistrationForm() {
  const form = document.getElementById('registration-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('register-submit-btn');

    if (!isRegistrationOpen) {
      showToast('Registrations for CRUD 2026 are currently closed by administrators.', 'error', 6000);
      return;
    }

    // Collect inputs
    const fullName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const course = document.getElementById('reg-course').value;

    // Validation
    if (!fullName || !email || !mobile || !course) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    // Email regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    // Phone regex check
    if (mobile.length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    setButtonLoading(submitBtn, true, 'Submitting Registration...');

    const sb = window.getSupabase();
    if (!sb) {
      showToast('Database client connection error.', 'error');
      setButtonLoading(submitBtn, false);
      return;
    }

    try {
      // 1. Check duplicate email in student_details
      const { data: existingEmail } = await sb
        .from('student_details')
        .select('id, profile_id')
        .eq('email', email)
        .maybeSingle();

      if (existingEmail && existingEmail.profile_id) {
        showToast('This email is already registered and active. Please log in.', 'info', 6000);
        setButtonLoading(submitBtn, false);
        return;
      }

      // 2. Create Auth User directly with fixed password 'Freshers@2026'
      let userId = null;
      const { data: authData } = await sb.auth.signUp({
        email: email,
        password: FIXED_STUDENT_PASSWORD,
        options: {
          data: { full_name: fullName, role: 'student' }
        }
      });

      if (authData && authData.user) {
        userId = authData.user.id;
      }

      const autoStudentId = `FP26-${Math.floor(100000 + Math.random() * 900000)}`;

      // 3. Save or update registration in PostgreSQL student_details table
      if (existingEmail) {
        await sb
          .from('student_details')
          .update({
            profile_id: userId,
            full_name: fullName,
            mobile: mobile,
            course: course,
            registration_status: 'account_created'
          })
          .eq('id', existingEmail.id);
      } else {
        const { error: insertErr } = await sb
          .from('student_details')
          .insert([{
            profile_id: userId,
            full_name: fullName,
            email: email,
            student_id: autoStudentId,
            mobile: mobile,
            course: course,
            semester: course.includes('Sem-3') ? 'Sem 3' : 'Sem 1',
            division: 'N/A',
            registration_status: 'account_created'
          }]);

        if (insertErr) throw insertErr;
      }

      // Success
      showToast('Registration successful! Your login password is: Freshers@2026', 'success', 7000);
      form.reset();

      // Show success alert box
      const successBox = document.getElementById('registration-success-box');
      if (successBox) {
        successBox.style.display = 'block';
        successBox.scrollIntoView({ behavior: 'smooth' });
      }

    } catch (err) {
      console.error("Registration error:", err);
      showToast(err.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}
