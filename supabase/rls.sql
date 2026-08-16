-- ========================================================
-- FRESHERS PARTY 2026 — ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTION TO CHECK IF CURRENT USER IS ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HELPER FUNCTION TO CHECK IF TICKETS ARE GLOBALLY LIVE
CREATE OR REPLACE FUNCTION public.are_tickets_live()
RETURNS BOOLEAN AS $$
DECLARE
    is_live BOOLEAN;
BEGIN
    SELECT ticket_live INTO is_live FROM public.event_settings LIMIT 1;
    RETURN COALESCE(is_live, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- 1. PROFILES POLICIES
-- --------------------------------------------------------
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Users can update their own non-critical profile info
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Admins full access to profiles
CREATE POLICY "Admins can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.is_admin() OR auth.uid() = id);

-- --------------------------------------------------------
-- 2. STUDENT DETAILS (REGISTRATIONS) POLICIES
-- --------------------------------------------------------
-- Public can submit registration (INSERT)
CREATE POLICY "Public registration submission" ON public.student_details
    FOR INSERT WITH CHECK (true);

-- Students can read their own registration details
CREATE POLICY "Students read own registration" ON public.student_details
    FOR SELECT USING (
        email = (SELECT email FROM public.profiles WHERE id = auth.uid()) 
        OR profile_id = auth.uid() 
        OR public.is_admin()
    );

-- Admins can update/delete registration details
CREATE POLICY "Admins manage registration details" ON public.student_details
    FOR ALL USING (public.is_admin());

-- --------------------------------------------------------
-- 3. TICKETS POLICIES
-- --------------------------------------------------------
-- Students can read their own ticket ONLY IF account is active AND tickets are globally LIVE
CREATE POLICY "Students view own ticket when live" ON public.tickets
    FOR SELECT USING (
        (
            student_profile_id = auth.uid() 
            AND public.are_tickets_live() = true 
            AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
        )
        OR public.is_admin()
    );

-- Admins can insert, update, delete tickets
CREATE POLICY "Admins manage tickets" ON public.tickets
    FOR ALL USING (public.is_admin());

-- --------------------------------------------------------
-- 4. EVENT SETTINGS POLICIES
-- --------------------------------------------------------
-- Everyone (anonymous + authenticated) can view event settings
CREATE POLICY "Public view event settings" ON public.event_settings
    FOR SELECT USING (true);

-- Admins can update event settings
CREATE POLICY "Admins manage event settings" ON public.event_settings
    FOR ALL USING (public.is_admin());

-- --------------------------------------------------------
-- 5. VERIFICATION CODES POLICIES
-- --------------------------------------------------------
-- Users can manage their own OTP records
CREATE POLICY "Users manage own OTP codes" ON public.verification_codes
    FOR ALL USING (user_id = auth.uid());

-- --------------------------------------------------------
-- 6. AUDIT LOGS POLICIES
-- --------------------------------------------------------
-- Admins can view and create audit logs
CREATE POLICY "Admins manage audit logs" ON public.audit_logs
    FOR ALL USING (public.is_admin());
