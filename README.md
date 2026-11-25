# Student Attendance Monitoring System — Pateros Technological College

A web-based Student Attendance Monitoring System prototype with role-based access for **Students**, **Teachers**, and **Authorized Admin Staff**, plus starter **PHP + MySQL** backend files.

## Quick Start (Frontend Prototype)
1. Open `index.html` directly in any modern web browser (no server or build tools required).
2. Use the **Quick Demo Accounts** on the login screen:
   - **Admin Staff**: `admin` / `admin123`
   - **Teacher**: `teacher.santos` / `teach123`
   - **Student**: `2026-0001` / `stud123`
3. Changes are saved automatically in `localStorage`. Click **Reset Demo Data** in the sidebar to restore the initial sample records.

## Project Structure
- `index.html` — Main application shell and login screen
- `css/styles.css` — Responsive UI styles and status badges
- `js/data.js` — Pre-seeded Pateros Technological College sample data & `localStorage` persistence
- `js/app.js` — Role-based routing, attendance recording, monitoring, flagging, and CSV/print reporting
- `database/schema.sql` — MySQL schema (`users`, `students`, `classes`, `attendance_records`)
- `backend-php/config.php` — PDO MySQL connection helper
- `backend-php/attendance_api.php` — Starter GET/POST JSON API for attendance sessions
