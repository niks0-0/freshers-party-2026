# FRESHERS PARTY 2026 — DIGITAL TICKET & REGISTRATION PORTAL (`crud-2026`)

A complete, production-ready, mobile-first **Digital Registration & Secure Ticket Portal** for Freshers Party 2026. Built with pure HTML5, CSS3 (Glassmorphism dark theme), Vanilla JavaScript, and Supabase (PostgreSQL Database, Auth, Storage, and Row Level Security).

---

## 🌟 Key Features

### 1. Public Event Landing Page & Registration
- Dynamic event metadata (Date, Time, Venue, Instructions) retrieved live from Supabase `event_settings`.
- Instant registration form validation with duplicate Email & Student Enrollment ID prevention.

### 2. Student Portal & Security Checklist
- Secure Student Auth (Email + Password).
- Student Dashboard displaying registration status and ticket preview state.
- **Master Ticket Access Enforcement Rule**: Access to the ticket PDF is unlocked ONLY when:
  1. Student is authenticated.
  2. Student account is active (`is_active = true`).
  3. Tickets are globally LIVE (`ticket_live = true`).
  4. Student ticket PDF has been uploaded by organizers.
  5. Student identity matches session.
  6. Email OTP verification is completed (`is_verified = true`).

### 3. Email OTP Verification Flow
- Masked email display (`r*****@gmail.com`).
- Cryptographically secure 6-digit OTP entry with auto-focus movement.
- Resend cooldown timer (60s) and attempt limiting (max 5 attempts).

### 4. Admin Management Portal
- Admin Dashboard with real-time statistics (Total Registered, Active Accounts, Uploaded Tickets, Missing Tickets, Global Ticket LIVE Status).
- Student search by Name, Email, or Enrollment ID.
- Create Student Login Accounts & toggle account activation (`Enable` / `Disable`).
- Upload individual PDF tickets directly to private Supabase Storage bucket (`tickets`) with automatic replacement handling.
- **Global Ticket LIVE/OFF Toggle Switch**: Turn student ticket availability ON/OFF at any moment.

---

## 🚀 Quick Setup & Database Migration Guide

### Step 1: Set Up Supabase Project
1. Create a free project at [Supabase.com](https://supabase.com).
2. Go to your project's **SQL Editor**.
3. Execute the SQL scripts in this order:
   - `supabase/schema.sql` (Creates tables, indexes, triggers)
   - `supabase/rls.sql` (Sets up Row Level Security policies)
   - `supabase/storage.sql` (Creates private `tickets` storage bucket & policies)
   - `supabase/seed.sql` (Inserts initial event settings)

### Step 2: Configure Supabase Credentials
1. In Supabase, go to **Project Settings -> API**.
2. Copy your **Project URL** and **anon / public Key**.
3. Open `js/config.js` and paste your credentials:
   ```javascript
   const SUPABASE_CONFIG = {
     SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
     SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"
   };
   ```

### Step 3: Create First Administrator Account
1. In Supabase, go to **Authentication -> Users** and click **Add User**.
2. Create an admin user (e.g. `admin@freshers2026.com` with a strong password).
3. In SQL Editor, run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@freshers2026.com';
   ```

---

## 💻 Running Locally

No Node.js backend server, Docker, or complex build tools are required!

### Option A: VS Code Live Server
1. Open the project folder (`crud-2026`) in VS Code.
2. Right-click `index.html` and select **Open with Live Server**.

### Option B: Python HTTP Server
Open your terminal in the `crud-2026` directory and run:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

---

## 🌐 Hosting & Deployment (Vercel)

This application is 100% static frontend compatible:
1. Push the code repository to GitHub.
2. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your repository.
4. Leave framework preset as **Other** or **Static**.
5. Click **Deploy**!

---

## 📂 Project Structure

```text
crud-2026/
├── index.html                # Public Landing Page & Registration Form
├── login.html                # Student Login Page
├── forgot-password.html      # Password Reset Request
├── reset-password.html       # Password Reset Update
├── dashboard.html            # Student Portal & Ticket Card Preview
├── verify.html               # Email OTP Verification Page
├── ticket.html               # Secure Private PDF Ticket Viewer & Downloader
│
├── admin/
│   ├── login.html            # Admin Login
│   ├── dashboard.html        # Admin Stats & Control Overview
│   ├── students.html         # Student Search, List & Account Creation
│   ├── student.html          # Individual Student Details & PDF Ticket Upload
│   ├── tickets.html          # Storage Bucket Tickets Overview
│   └── settings.html         # Event Metadata & Global Ticket LIVE/OFF Switch
│
├── css/
│   ├── style.css             # Glassmorphic Design System & Responsive Utilities
│   ├── auth.css              # Authentication Form Styles
│   ├── dashboard.css         # Student Dashboard & OTP Styles
│   └── admin.css             # Admin Tables, Badges, Modals & Switches
│
├── js/
│   ├── config.js             # Supabase Credentials Configuration
│   ├── supabase.js           # Supabase SDK Initializer
│   ├── ui-helpers.js         # Toasts, Spinners, Modals, Formatters
│   ├── auth.js               # Route Guards, Login, Logout & Session Management
│   ├── registration.js       # Dynamic Event Settings & Form Validation
│   ├── dashboard.js          # Student Profile & Ticket Availability Logic
│   ├── verify.js             # Email OTP Verification Flow
│   ├── ticket.js             # Signed URL Access & PDF Viewer
│   └── admin.js              # Admin Dashboard Stats, CRUD & Global LIVE Toggle
│
├── supabase/
│   ├── schema.sql            # PostgreSQL Database Schema
│   ├── rls.sql               # Security Policies
│   ├── storage.sql           # Storage Bucket Policies
│   └── seed.sql              # Seed Data & Setup Queries
│
├── .env.example
├── vercel.json
├── README.md
└── .gitignore
```
