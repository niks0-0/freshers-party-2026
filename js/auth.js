/* ========================================================
   CRUD 2026 — AUTHENTICATION & ROUTE GUARDS (ABSOLUTE PATH SAFE)
   ======================================================== */

// Smart Path Helper to get correct relative root
function getRootPrefix() {
  const path = window.location.pathname;
  if (path.includes('/admin/')) {
    return '../';
  }
  return '';
}

function getAdminPrefix() {
  const path = window.location.pathname;
  if (path.includes('/admin/')) {
    return '';
  }
  return 'admin/';
}

// Get current session and profile
async function getCurrentUser() {
  const sb = window.getSupabase();
  if (!sb) return null;

  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return null;

  // Fetch role and active status from profiles table
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile) {
    // Fail-safe fallback profile
    const fallbackProfile = {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
      role: session.user.email === 'admin@freshers2026.com' ? 'admin' : 'student',
      is_active: true
    };

    await sb.from('profiles').upsert([fallbackProfile], { onConflict: 'id' });
    return { session, user: session.user, profile: fallbackProfile };
  }

  return { session, user: session.user, profile };
}

// Student Route Guard
async function requireStudentAuth() {
  const authData = await getCurrentUser();
  const root = getRootPrefix();

  if (!authData || !authData.session) {
    window.location.href = `${root}login.html`;
    return null;
  }
  if (!authData.profile || !authData.profile.is_active) {
    showToast('Your account is deactivated. Please contact the administrator.', 'error');
    await logoutUser();
    return null;
  }
  return authData;
}

// Admin Route Guard (Absolute Clean Path Resolution)
async function requireAdminAuth() {
  const authData = await getCurrentUser();
  const adminPath = `${getAdminPrefix()}login.html`;

  if (!authData || !authData.session) {
    window.location.href = adminPath;
    return null;
  }
  if (!authData.profile || authData.profile.role !== 'admin' || !authData.profile.is_active) {
    showToast('Access denied. Administrator privileges required.', 'error');
    window.location.href = adminPath;
    return null;
  }
  return authData;
}

// Student & Admin Login
async function loginUser(email, password, isAdminLogin = false) {
  const sb = window.getSupabase();
  if (!sb) return { success: false, message: 'Database initialization failed.' };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, message: error.message || 'Invalid email or password.' };
  }

  // Verify Role and Active status
  let { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    profile = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || email.split('@')[0],
      role: isAdminLogin ? 'admin' : 'student',
      is_active: true
    };
    await sb.from('profiles').upsert([profile], { onConflict: 'id' });
  }

  if (!profile.is_active) {
    await sb.auth.signOut();
    return { success: false, message: 'Your account is deactivated. Contact admin.' };
  }

  if (isAdminLogin && profile.role !== 'admin') {
    await sb.auth.signOut();
    return { success: false, message: 'Unauthorized. Not an admin account.' };
  }

  return { success: true, profile, role: profile.role };
}

// Logout
async function logoutUser() {
  const sb = window.getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  const root = getRootPrefix();
  window.location.href = `${root}login.html`;
}

// Password Reset Request
async function sendPasswordReset(email) {
  const sb = window.getSupabase();
  if (!sb) return { success: false, message: 'Database connection failed.' };

  const root = getRootPrefix();
  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/')}${root}reset-password.html`;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Password reset link sent to your email.' };
}

// Update Password
async function updatePassword(newPassword) {
  const sb = window.getSupabase();
  if (!sb) return { success: false, message: 'Database connection failed.' };

  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Password updated successfully. Please login.' };
}

window.getCurrentUser = getCurrentUser;
window.requireStudentAuth = requireStudentAuth;
window.requireAdminAuth = requireAdminAuth;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.sendPasswordReset = sendPasswordReset;
window.updatePassword = updatePassword;
