-- ========================================================
-- FRESHERS PARTY 2026 — SEED & INITIAL DATA
-- ========================================================

-- Insert Initial Event Settings (Singleton Row)
INSERT INTO public.event_settings (
    event_name,
    event_date,
    event_time,
    venue,
    college_name,
    instructions,
    ticket_live
)
VALUES (
    'FRESHERS PARTY 2026',
    '2026-08-21',
    '05:00 PM IST',
    'Grand College Auditorium',
    'College of Engineering & Technology',
    '1. Carry your physical College ID card along with your digital ticket PDF.\n2. Gate opens at 04:30 PM. Entry will strictly close at 06:00 PM.\n3. Digital ticket QR code will be scanned at the venue entrance.\n4. Strictly formal or ethnic dress code.',
    false
)
ON CONFLICT DO NOTHING;

-- INSTRUCTIONS TO CREATE FIRST ADMIN USER:
-- 1. Create a user via Supabase Auth Dashboard (e.g., admin@freshers2026.com with password).
-- 2. Execute the following query with the created Admin's email:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@freshers2026.com';
