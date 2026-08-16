/* ========================================================
   FRESHERS PARTY 2026 — AUTHENTICATION & ROUTE GUARDS
   ======================================================== */

// Get current session and profile
async function getCurrentUser() {
  const sb = window.getSupabase();
  if (!sb) return null;

  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return null;

  // Fetch role and active status from profiles table
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileErr) {
    console.error("Error fetching user profile:", profileErr);
    return { session, user: session.user, profile: null };
  }

  return { session, user: session.user, profile };
}

// Student Route Guard
async function requireStudentAuth() {
  const authData = await getCurrentUser();
  if (!authData || !authData.session) {
    window.location.href = 'login.html';
    return null;
  }
  if (!authData.profile || !authData.profile.is_active) {
    showToast('Your account is deactivated. Please contact the administrator.', 'error');
    await logoutUser();
    return null;
  }
  return authData;
}

// Admin Route Guard
async function requireAdminAuth() {
  const authData = await getCurrentUser();
  if (!authData || !authData.session) {
    window.location.href = 'admin/login.html';
    return null;
  }
  if (!authData.profile || authData.profile.role !== 'admin' || !authData.profile.is_active) {
    showToast('Access denied. Administrator privileges required.', 'error');
    window.location.href = '../login.html';
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
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileErr || !profile) {
    return { success: false, message: 'User profile not found.' };
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
async function logoutUser(redirectTo = 'login.html') {
  const sb = window.getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  window.location.href = redirectTo;
}

// Password Reset Request
async function sendPasswordReset(email) {
  const sb = window.getSupabase();
  if (!sb) return { success: false, message: 'Database connection failed.' };

  const redirectTo = `${window.location.origin}/reset-password.html`;
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
