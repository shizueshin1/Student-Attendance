/**
 * PTC Student Attendance Monitoring System — Data Store, Seed Data & API Client
 */

const STORAGE_KEY = "ptc_sams_db_v2";
const SESSION_KEY = "ptc_sams_session_v2";
const THEME_KEY = "ptc_sams_theme_v1";
const IS_HTTP_MODE = window.location.protocol === "http:" || window.location.protocol === "https:";
const API_BASE = "backend-php/api.php";

let isOnlineAPI = false;

async function apiRequest(action, method = "GET", body = null, userRole = "") {
  const headers = { "Content-Type": "application/json" };
  if (userRole) headers["X-User-Role"] = userRole;
  const res = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const SEED_DATA = {
  users: [
    { id: 1, username: "admin", password: "admin123", name: "Admin", role: "admin" },
    { id: 2, username: "teacher.santos", password: "teach123", name: "Prof. Marco Santos", role: "teacher" },
    { id: 3, username: "teacher.reyes", password: "teach123", name: "Prof. Elena Reyes", role: "teacher" }
  ],
  students: [],
  classes: [
    { id: "OA301", code: "OA 301", title: "Database Management System", section: "BSOA 3A", schedule: "Mon/Wed 8:00–9:30 AM", room: "ComLab 1", teacherId: 2, teacherName: "Prof. Marco Santos" },
    { id: "OA302", code: "OA 302", title: "Rizal Life, Works and Writing", section: "BSOA 3A", schedule: "Tue/Thu 10:00–11:30 AM", room: "Room 304", teacherId: 2, teacherName: "Prof. Marco Santos" },
    { id: "OA303", code: "OA 303", title: "Ethics", section: "BSOA 3A", schedule: "Mon/Wed 1:00–2:30 PM", room: "Room 205", teacherId: 3, teacherName: "Prof. Elena Reyes" },
    { id: "OA304", code: "OA 304", title: "Philippine Popular Culture", section: "BSOA 3A", schedule: "Fri 8:00–11:00 AM", room: "Room 301", teacherId: 2, teacherName: "Prof. Marco Santos" },
    { id: "OA305", code: "OA 305", title: "Applied Statistics", section: "BSOA 3A", schedule: "Tue/Thu 1:00–2:30 PM", room: "Room 302", teacherId: 3, teacherName: "Prof. Elena Reyes" },
    { id: "OA306", code: "OA 306", title: "Research 1", section: "BSOA 3A", schedule: "Wed/Fri 1:00–2:30 PM", room: "Room 303", teacherId: 3, teacherName: "Prof. Elena Reyes" }
  ],
  attendance: []
};

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fresh = structuredClone(SEED_DATA);
    saveDB(fresh);
    return fresh;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const fresh = structuredClone(SEED_DATA);
    saveDB(fresh);
    return fresh;
  }
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function resetDB() {
  const fresh = structuredClone(SEED_DATA);
  saveDB(fresh);
  return fresh;
}

function getSessionUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSessionUser(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}
