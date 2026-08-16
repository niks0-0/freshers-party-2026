-- ========================================================
-- FRESHERS PARTY 2026 — SUPABASE STORAGE SETUP & POLICIES
-- ========================================================

-- 1. Create Private Storage Bucket 'tickets'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tickets', 'tickets', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

-- 2. Storage RLS Policies for 'tickets' Bucket

-- Enable RLS on storage.objects if not enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Admins can upload tickets
CREATE POLICY "Admins can upload tickets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'tickets' AND public.is_admin()
    );

-- Admins can update/replace tickets
CREATE POLICY "Admins can update tickets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'tickets' AND public.is_admin()
    );

-- Admins can delete tickets
CREATE POLICY "Admins can delete tickets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'tickets' AND public.is_admin()
    );

-- Students can read their own ticket object ONLY if:
-- a) Tickets are LIVE
-- b) Student account is ACTIVE
-- c) Object path matches the student's registered ticket storage_path
CREATE POLICY "Students read own ticket PDF" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'tickets' 
        AND (
            public.is_admin()
            OR (
                public.are_tickets_live() = true
                AND EXISTS (
                    SELECT 1 FROM public.tickets t
                    JOIN public.profiles p ON p.id = t.student_profile_id
                    WHERE p.id = auth.uid()
                    AND p.is_active = true
                    AND t.storage_path = storage.objects.name
                )
            )
        )
    );
