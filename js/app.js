/**
 * PTC Student Attendance Monitoring System — Modular UI & Application Controller
 * Modules: Utils & Components | Auth & Session | Router | Student Portal | Teacher Portal | Admin Portal
 */

let db = loadDB();
let currentUser = getSessionUser();
let activeRoute = "";
let hasUnsavedAttendance = false;
let studentWarningDismissed = false;

const ABSENCE_FLAG_THRESHOLD = 3;
const AVATAR_COLORS = ["#0f5132", "#1d4ed8", "#7c3aed", "#b45309", "#be123c", "#0e7490"];

// ---------- DOM Elements ----------
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginSubmitBtn = document.getElementById("login-submit-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarNav = document.getElementById("sidebar-nav");
const pageTitle = document.getElementById("page-title");
const breadcrumbEl = document.getElementById("topbar-breadcrumb");
const mainContent = document.getElementById("main-content");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const toastContainer = document.getElementById("toast-container");

// =========================================================
// MODULE 1: UTILITIES & REUSABLE UI COMPONENTS
// =========================================================
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function getInitials(name) {
  return String(name || "U").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function avatarColor(seed) {
  let hash = 0;
  for (const ch of String(seed || "")) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span><button class="toast-close" aria-label="Close">&times;</button>`;
  el.querySelector(".toast-close").addEventListener("click", () => el.remove());
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function openModal(title, htmlContent) {
  modalTitle.textContent = title;
  modalBody.innerHTML = htmlContent;
  modalBackdrop.classList.remove("hidden");
  const firstInput = modalBody.querySelector("input, select, button");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  modalBody.innerHTML = "";
}

function animateCounts() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("[data-count-to]").forEach((el) => {
    const target = parseInt(el.getAttribute("data-count-to"), 10);
    const suffix = el.getAttribute("data-suffix") || "";
    if (Number.isNaN(target)) return;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 14));
    const timer = setInterval(() => {
      cur += step;
      if (cur >= target) {
        el.textContent = `${target}${suffix}`;
        clearInterval(timer);
      } else {
        el.textContent = `${cur}${suffix}`;
      }
    }, 18);
  });
}

function getStudentStats(studentId, records = db.attendance) {
  const list = records.filter((r) => r.studentId === studentId);
  const counts = { present: 0, absent: 0, late: 0, excused: 0, total: list.length };
  for (const r of list) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  }
  const attended = counts.present + counts.late + counts.excused;
  const rate = counts.total > 0 ? Math.round((attended / counts.total) * 100) : 100;
  return { ...counts, rate, flagged: counts.absent >= ABSENCE_FLAG_THRESHOLD };
}

function getClassById(id) { return db.classes.find((c) => c.id === id); }
function getStudentById(id) { return db.students.find((s) => s.id === id); }
function statusBadge(status) { return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`; }

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  record: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/></svg>`,
  students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  classes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
};

function renderDistributionCard(records, title = "Attendance Distribution") {
  const total = records.length || 1;
  const counts = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const r of records) if (counts[r.status] !== undefined) counts[r.status]++;
  const pct = (n) => Math.round((n / total) * 100);
  return `
    <div class="card">
      <div class="card-header">
        <h3>${escapeHtml(title)}</h3>
        <span class="stat-note">${records.length} recorded entries</span>
      </div>
      <div class="card-body">
        <div class="breakdown-bar">
          <div class="seg-present" style="width:${pct(counts.present)}%" title="Present: ${pct(counts.present)}%"></div>
          <div class="seg-late" style="width:${pct(counts.late)}%" title="Late: ${pct(counts.late)}%"></div>
          <div class="seg-excused" style="width:${pct(counts.excused)}%" title="Excused: ${pct(counts.excused)}%"></div>
          <div class="seg-absent" style="width:${pct(counts.absent)}%" title="Absent: ${pct(counts.absent)}%"></div>
        </div>
        <div class="breakdown-legend">
          <span class="legend-item"><span class="legend-dot seg-present"></span>Present: ${counts.present} (${pct(counts.present)}%)</span>
          <span class="legend-item"><span class="legend-dot seg-late"></span>Late: ${counts.late} (${pct(counts.late)}%)</span>
          <span class="legend-item"><span class="legend-dot seg-excused"></span>Excused: ${counts.excused} (${pct(counts.excused)}%)</span>
          <span class="legend-item"><span class="legend-dot seg-absent"></span>Absent: ${counts.absent} (${pct(counts.absent)}%)</span>
        </div>
      </div>
    </div>
  `;
}

// =========================================================
// MODULE 2: AUTH, THEME & SESSION
// =========================================================
const savedTheme = localStorage.getItem(THEME_KEY) || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");

document.getElementById("theme-toggle-btn").addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem(THEME_KEY, isDark ? "light" : "dark");
});

document.querySelectorAll(".role-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".role-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    const role = tab.getAttribute("data-role-tab");
    const placeholders = { admin: "e.g. admin", teacher: "e.g. teacher.santos", student: "e.g. 2026-0001" };
    loginUsername.placeholder = placeholders[role] || "Enter username";
    // Hide "Create account" link for admin
    const createLink = document.getElementById("show-register-btn")?.closest(".auth-switch");
    if (createLink) createLink.classList.toggle("hidden", role === "admin");
  });
});

document.getElementById("toggle-password-btn").addEventListener("click", () => {
  const isPass = loginPassword.type === "password";
  loginPassword.type = isPass ? "text" : "password";
});

async function refreshFromBackend() {
  if (!IS_HTTP_MODE) {
    isOnlineAPI = false;
    return;
  }
  try {
    const data = await apiRequest("bootstrap");
    db = data;
    isOnlineAPI = true;
  } catch {
    isOnlineAPI = false;
  }
}

function updateModeBadge() {
  const badge = document.getElementById("mode-badge");
  if (!badge) return;
  if (isOnlineAPI) {
    badge.textContent = "MySQL Connected";
    badge.classList.remove("offline");
  } else {
    badge.textContent = "Offline mode";
    badge.classList.add("offline");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  loginError.classList.add("hidden");
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.querySelector(".btn-spinner").classList.remove("hidden");

  try {
    let user = null;
    if (IS_HTTP_MODE) {
      try {
        const res = await apiRequest("login", "POST", { username, password });
        user = res.user;
        await refreshFromBackend();
      } catch (err) {
        if (!isOnlineAPI) {
          user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        } else {
          throw err;
        }
      }
    } else {
      user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    }

    if (!user) throw new Error("Invalid username or password.");
    currentUser = user;
    setSessionUser(user);
    enterApp();
  } catch (err) {
    loginError.textContent = err.message || "Invalid username or password.";
    loginError.classList.remove("hidden");
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.querySelector(".btn-spinner").classList.add("hidden");
  }
});

document.querySelectorAll("[data-demo-user]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const uname = btn.getAttribute("data-demo-user");
    const passwords = { admin: "admin123", "teacher.santos": "teach123", "2026-0001": "stud123" };
    loginUsername.value = uname;
    loginPassword.value = passwords[uname] || "";
    loginForm.requestSubmit();
  });
});

// Create Account Toggle & Submission
const signinSection = document.getElementById("signin-section");
const registerSection = document.getElementById("register-section");
const authHeading = document.getElementById("auth-heading");
const authSubheading = document.getElementById("auth-subheading");
const regRoleSelect = document.getElementById("reg-role");
const regStudentFields = document.getElementById("reg-student-fields");
const regUsernameInput = document.getElementById("reg-username");
const regStudentIdInput = document.getElementById("reg-student-id");
const regEmailInput = document.getElementById("reg-email");
const regCourseSelect = document.getElementById("reg-course");
const regSectionInput = document.getElementById("reg-section");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const registerSubmitBtn = document.getElementById("register-submit-btn");

// Auto-generate on role change
regRoleSelect.addEventListener("change", () => {
  const isStudent = regRoleSelect.value === "student";
  regStudentFields.classList.toggle("hidden", !isStudent);
  regEmailInput.required = isStudent;
  regSectionInput.required = isStudent;
  regStudentIdInput.required = isStudent;
  if (regCourseSelect) regCourseSelect.required = isStudent;
  regUsernameInput.placeholder = isStudent ? "Choose a login username" : "e.g. teacher.cruz";
});

// Show register form
document.getElementById("show-register-btn").addEventListener("click", () => {
  signinSection.classList.add("hidden");
  registerSection.classList.remove("hidden");
  authHeading.textContent = "Create an account";
  authSubheading.textContent = "Register as a PTC student or faculty member.";
  regRoleSelect.value = "student";
  regStudentFields.classList.remove("hidden");
  regEmailInput.required = true;
  regSectionInput.required = true;
  regStudentIdInput.required = true;
  if (regCourseSelect) regCourseSelect.required = true;
});

// Back to sign-in
document.getElementById("show-signin-btn").addEventListener("click", () => {
  registerSection.classList.add("hidden");
  signinSection.classList.remove("hidden");
  authHeading.textContent = "Sign in to your account";
  authSubheading.textContent = "Select your role and enter your credentials.";
  registerForm.reset();
  regStudentFields.classList.remove("hidden");
  regStudentIdInput.value = "";
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.classList.add("hidden");
  registerSubmitBtn.disabled = true;
  registerSubmitBtn.querySelector(".btn-spinner").classList.remove("hidden");

  const role = regRoleSelect.value;
  const username = regUsernameInput.value.trim();
  const studentId = role === "student" ? regStudentIdInput.value.trim() : null;
  const fullName = document.getElementById("reg-fullname").value.trim();
  const course = role === "student" && regCourseSelect ? regCourseSelect.value : "";
  const sectionNum = regSectionInput.value.trim();
  const yearSection = course ? `${course} ${sectionNum}` : sectionNum;
  const email = regEmailInput.value.trim();
  const password = document.getElementById("reg-password").value;

  try {
    let user = null;
    if (isOnlineAPI) {
      const res = await apiRequest("register", "POST", { role, username, studentId, fullName, yearSection, email, password });
      user = res.user;
      await refreshFromBackend();
    } else {
      // Check username uniqueness
      if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error("That username is already taken.");
      }
      // Check student ID uniqueness (student only)
      if (role === "student" && db.students.some((s) => s.id === studentId)) {
        throw new Error("That Student ID is already in use. Click '↺ New ID' to generate another.");
      }

      user = { id: Date.now(), username, password, name: fullName, role, studentId: studentId || null };
      db.users.push(user);
      if (role === "student") {
        db.students.push({
          id: studentId,
          name: fullName,
          program: course || yearSection.split(" ")[0] || "BSOA",
          yearSection,
          email
        });
      }
      saveDB(db);
    }

    registerForm.reset();
    regStudentFields.classList.remove("hidden");
    currentUser = user;
    setSessionUser(user);
    showToast("Account created! Welcome to PTC SAMS.");
    enterApp();
  } catch (err) {
    registerError.textContent = err.message || "Could not create account.";
    registerError.classList.remove("hidden");
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.querySelector(".btn-spinner").classList.add("hidden");
  }
});

function doLogout() {
  currentUser = null;
  setSessionUser(null);
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  loginForm.reset();
}

document.getElementById("menu-logout-btn").addEventListener("click", doLogout);

// =========================================================
// MODULE 3: ROUTER & SHELL INTERACTIONS
// =========================================================
const ROLE_ROUTES = {
  student: [
    { id: "student-dashboard", label: "My Attendance", icon: "dashboard" },
    { id: "student-history", label: "Attendance History", icon: "reports" }
  ],
  teacher: [
    { id: "teacher-dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "record-attendance", label: "Record Attendance", icon: "record" },
    { id: "monitor-attendance", label: "Monitor & Summaries", icon: "monitor" }
  ],
  admin: [
    { id: "admin-dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "manage-students", label: "Students", icon: "students" },
    { id: "manage-classes", label: "Classes", icon: "classes" },
    { id: "reports", label: "Reports & Export", icon: "reports" }
  ]
};

document.getElementById("collapse-sidebar-btn").addEventListener("click", () => sidebar.classList.toggle("collapsed"));
document.getElementById("open-sidebar-btn").addEventListener("click", () => {
  sidebar.classList.add("open");
  sidebarOverlay.classList.remove("hidden");
});
function closeMobileSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
}
document.getElementById("close-sidebar-btn").addEventListener("click", closeMobileSidebar);
sidebarOverlay.addEventListener("click", closeMobileSidebar);

document.getElementById("modal-close-btn").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeModal(); });

const notifBtn = document.getElementById("notif-btn");
const notifMenu = document.getElementById("notif-menu");
const avatarBtn = document.getElementById("avatar-menu-btn");
const avatarMenu = document.getElementById("avatar-menu");

notifBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  avatarMenu.classList.add("hidden");
  notifMenu.classList.toggle("hidden");
});
avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  notifMenu.classList.add("hidden");
  avatarMenu.classList.toggle("hidden");
});
document.addEventListener("click", () => {
  notifMenu.classList.add("hidden");
  avatarMenu.classList.add("hidden");
});

function populateNotifications() {
  const flagged = db.students.filter((s) => getStudentStats(s.id).flagged);
  const countEl = document.getElementById("notif-count");
  if (flagged.length > 0 && currentUser.role !== "student") {
    countEl.textContent = flagged.length;
    countEl.classList.remove("hidden");
    notifMenu.innerHTML = `<div class="dropdown-header"><strong>Absence Alerts (${flagged.length})</strong><span>Students with 3+ absences</span></div>` +
      flagged.map((s) => `<div class="dropdown-item">${escapeHtml(s.name)} (${getStudentStats(s.id).absent} absences)</div>`).join("");
  } else {
    countEl.classList.add("hidden");
    notifMenu.innerHTML = `<div class="dropdown-header"><strong>Notifications</strong><span>All caught up</span></div>`;
  }
}

function enterApp() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  updateModeBadge();

  const initials = getInitials(currentUser.name);
  ["user-avatar", "sidebar-avatar"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });
  document.getElementById("user-display-name").textContent = currentUser.name;
  document.getElementById("user-role-badge").textContent = currentUser.role;
  document.getElementById("sidebar-user-name").textContent = currentUser.name;
  document.getElementById("sidebar-user-role").textContent = currentUser.role;
  document.getElementById("menu-user-name").textContent = currentUser.name;
  document.getElementById("menu-user-role").textContent = currentUser.role;

  document.getElementById("topbar-date").textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  populateNotifications();

  const routes = ROLE_ROUTES[currentUser.role] || [];
  activeRoute = routes[0]?.id || "";
  renderSidebar();
  renderRoute();
}

function navigateTo(routeId) {
  if (hasUnsavedAttendance && !confirm("You have unsaved attendance changes. Leave without saving?")) return;
  hasUnsavedAttendance = false;
  activeRoute = routeId;
  closeMobileSidebar();
  renderSidebar();
  renderRoute();
}

function renderSidebar() {
  const routes = ROLE_ROUTES[currentUser.role] || [];
  sidebarNav.innerHTML = routes
    .map((r) => `<button class="nav-item ${r.id === activeRoute ? "active" : ""}" data-route="${r.id}">${ICONS[r.icon] || ""}<span>${escapeHtml(r.label)}</span></button>`)
    .join("");
  sidebarNav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.getAttribute("data-route")));
  });
}

function renderRoute() {
  const routes = ROLE_ROUTES[currentUser.role] || [];
  const meta = routes.find((r) => r.id === activeRoute) || { label: "Dashboard" };
  pageTitle.textContent = meta.label;
  breadcrumbEl.textContent = `PTC SAMS / ${currentUser.role.toUpperCase()} / ${meta.label}`;

  switch (activeRoute) {
    case "student-dashboard": return renderStudentDashboard();
    case "student-history": return renderStudentHistory();
    case "teacher-dashboard": return renderStaffDashboard("teacher");
    case "record-attendance": return renderRecordAttendance();
    case "monitor-attendance": return renderMonitorAttendance();
    case "admin-dashboard": return renderStaffDashboard("admin");
    case "manage-students": return renderManageStudents();
    case "manage-classes": return renderManageClasses();
    case "reports": return renderReports();
  }
}

// =========================================================
// MODULE 4: STUDENT PORTAL
// =========================================================
function renderStudentDashboard() {
  const studentId = currentUser.studentId;
  const student = getStudentById(studentId);
  const stats = getStudentStats(studentId);
  const myRecords = db.attendance.filter((r) => r.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));

  const rateColor = stats.rate >= 90 ? "" : stats.rate >= 75 ? "amber" : "red";
  const rateLabel = stats.rate >= 90 ? "Excellent Standing" : stats.rate >= 75 ? "Needs Attention" : "Critical";

  const affectedSubjects = db.classes
    .filter((c) => myRecords.some((r) => r.classId === c.id && r.status === "absent"))
    .map((c) => c.code)
    .join(", ");

  const subjectRows = db.classes
    .filter((c) => !student || c.section === student.yearSection)
    .map((c) => ({ cls: c, st: getStudentStats(studentId, myRecords.filter((r) => r.classId === c.id)) }));

  mainContent.innerHTML = `
    ${stats.flagged && !studentWarningDismissed ? `
      <div class="alert alert-warning" id="stu-warn-banner">
        <div><strong>Absence Warning:</strong> You have ${stats.absent} absences (Affected: ${escapeHtml(affectedSubjects || "Multiple subjects")}).</div>
        <button class="icon-btn" id="dismiss-warn-btn" aria-label="Dismiss warning">&times;</button>
      </div>` : ""}

    <div class="hero-card">
      <div>
        <h3>Welcome, ${escapeHtml(currentUser.name)}</h3>
        <p>ID: ${escapeHtml(studentId)} &bull; ${escapeHtml(student?.yearSection || "")} &bull; ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>
      <div class="hero-rate">
        <div class="hero-rate-val" data-count-to="${stats.rate}" data-suffix="%">${stats.rate}%</div>
        <div class="progress-track" style="margin-top:6px; background:rgba(255,255,255,0.2);">
          <div class="progress-fill ${rateColor}" style="width:${stats.rate}%"></div>
        </div>
        <span class="hero-rate-badge">${rateLabel}</span>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Present</span><span class="stat-icon">${ICONS.record}</span></div><div class="stat-value" style="color:var(--present-text)" data-count-to="${stats.present}">${stats.present}</div><div class="stat-note">Sessions attended</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Late</span><span class="stat-icon">${ICONS.monitor}</span></div><div class="stat-value" style="color:var(--late-text)" data-count-to="${stats.late}">${stats.late}</div><div class="stat-note">Tardy arrivals</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Excused</span><span class="stat-icon">${ICONS.classes}</span></div><div class="stat-value" style="color:var(--excused-text)" data-count-to="${stats.excused}">${stats.excused}</div><div class="stat-note">Approved absences</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Absent</span><span class="stat-icon">${ICONS.reports}</span></div><div class="stat-value" style="color:var(--absent-text)" data-count-to="${stats.absent}">${stats.absent}</div><div class="stat-note">${stats.flagged ? "Flagged (3+)" : "Within limit"}</div></div>
    </div>

    ${renderDistributionCard(myRecords, "My Attendance Distribution")}

    <div class="card">
      <div class="card-header"><h3>Subject Breakdown</h3></div>
      <div class="card-body">
        ${subjectRows.map(({ cls, st }) => {
          const barClass = st.rate >= 90 ? "" : st.rate >= 75 ? "amber" : "red";
          return `<div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
              <strong>${escapeHtml(cls.code)} — ${escapeHtml(cls.title)}</strong>
              <span>${st.rate}% (${st.present + st.late + st.excused}/${st.total})</span>
            </div>
            <div class="progress-track"><div class="progress-fill ${barClass}" style="width:${st.rate}%"></div></div>
          </div>`;
        }).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Recent Attendance Timeline</h3><button class="btn btn-outline btn-sm" id="stu-all-hist">View All</button></div>
      <div class="card-body">
        <div class="timeline">
          ${myRecords.length ? myRecords.slice(0, 5).map((r) => {
            const cls = getClassById(r.classId);
            return `<div class="timeline-item">
              <div><strong>${escapeHtml(cls ? cls.code : r.classId)}</strong> &bull; <span class="stat-note">${escapeHtml(r.date)}</span><div class="stat-note">${escapeHtml(r.remarks || "No remarks")}</div></div>
              ${statusBadge(r.status)}
            </div>`;
          }).join("") : `<div class="empty-state">No attendance records yet.</div>`}
        </div>
      </div>
    </div>
  `;

  animateCounts();
  document.getElementById("dismiss-warn-btn")?.addEventListener("click", () => {
    studentWarningDismissed = true;
    document.getElementById("stu-warn-banner")?.remove();
  });
  document.getElementById("stu-all-hist")?.addEventListener("click", () => navigateTo("student-history"));
}

function renderStudentHistory() {
  const studentId = currentUser.studentId;
  let page = 1;
  const pageSize = 8;

  mainContent.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Attendance History</h3><span id="sh-count" class="stat-note"></span></div>
      <div class="card-body">
        <div class="toolbar">
          <div class="form-group"><label for="sh-class">Subject</label><select id="sh-class"><option value="">All Subjects</option>${db.classes.map((c) => `<option value="${c.id}">${escapeHtml(c.code)} — ${escapeHtml(c.title)}</option>`).join("")}</select></div>
          <div class="form-group"><label for="sh-status">Status</label><select id="sh-status"><option value="">All</option><option value="present">Present</option><option value="late">Late</option><option value="excused">Excused</option><option value="absent">Absent</option></select></div>
          <div class="form-group"><label for="sh-from">From</label><input type="date" id="sh-from" /></div>
          <div class="form-group"><label for="sh-to">To</label><input type="date" id="sh-to" /></div>
        </div>
        <div class="table-wrap">
          <table class="responsive-table">
            <thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody id="sh-tbody"></tbody>
          </table>
        </div>
        <div class="pagination" id="sh-pager"></div>
      </div>
    </div>
  `;

  const renderRows = () => {
    const cls = document.getElementById("sh-class").value;
    const st = document.getElementById("sh-status").value;
    const from = document.getElementById("sh-from").value;
    const to = document.getElementById("sh-to").value;

    const all = db.attendance
      .filter((r) => r.studentId === studentId)
      .filter((r) => (!cls || r.classId === cls) && (!st || r.status === st) && (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => b.date.localeCompare(a.date));

    document.getElementById("sh-count").textContent = `${all.length} results`;
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    if (page > totalPages) page = totalPages;
    const slice = all.slice((page - 1) * pageSize, page * pageSize);

    document.getElementById("sh-tbody").innerHTML = slice.length
      ? slice.map((r) => {
          const c = getClassById(r.classId);
          return `<tr>
            <td data-label="Date">${escapeHtml(r.date)}</td>
            <td data-label="Subject">${escapeHtml(c ? `${c.code} — ${c.title}` : r.classId)}</td>
            <td data-label="Status">${statusBadge(r.status)}</td>
            <td data-label="Remarks">${escapeHtml(r.remarks || "—")}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="4"><div class="empty-state">No matching records found.</div></td></tr>`;

    document.getElementById("sh-pager").innerHTML = `
      <span>Page ${page} of ${totalPages}</span>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-outline btn-sm" id="sh-prev" ${page <= 1 ? "disabled" : ""}>Previous</button>
        <button class="btn btn-outline btn-sm" id="sh-next" ${page >= totalPages ? "disabled" : ""}>Next</button>
      </div>`;
    document.getElementById("sh-prev").addEventListener("click", () => { if (page > 1) { page--; renderRows(); } });
    document.getElementById("sh-next").addEventListener("click", () => { if (page < totalPages) { page++; renderRows(); } });
  };

  ["sh-class", "sh-status", "sh-from", "sh-to"].forEach((id) => document.getElementById(id).addEventListener("change", () => { page = 1; renderRows(); }));
  renderRows();
}

// =========================================================
// MODULE 5: TEACHER & ADMIN DASHBOARD + RECORDING + MONITORING
// =========================================================
function renderStaffDashboard(role) {
  const totalStudents = db.students.length;
  const totalClasses = db.classes.length;
  const totalRecords = db.attendance.length;
  const attended = db.attendance.filter((r) => r.status !== "absent").length;
  const overallRate = totalRecords ? Math.round((attended / totalRecords) * 100) : 100;
  const flagged = db.students.map((s) => ({ student: s, stats: getStudentStats(s.id) })).filter((x) => x.stats.flagged);

  mainContent.innerHTML = `
    <div class="hero-card">
      <div>
        <h3>Welcome back, ${escapeHtml(currentUser.name)}</h3>
        <p>${role === "teacher" ? "Manage your class sessions and monitor at-risk students." : "School-wide attendance overview across Pateros Technological College."}</p>
      </div>
      <button class="btn btn-outline" style="background:#fff; color:var(--primary);" id="hero-action-btn">
        ${role === "teacher" ? "+ Record Attendance" : "Open Reports"}
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Total Students</span><span class="stat-icon">${ICONS.students}</span></div><div class="stat-value" data-count-to="${totalStudents}">${totalStudents}</div><div class="stat-note">Active roster</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Active Classes</span><span class="stat-icon">${ICONS.classes}</span></div><div class="stat-value" data-count-to="${totalClasses}">${totalClasses}</div><div class="stat-note">Current term</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">Overall Attendance</span><span class="stat-icon">${ICONS.monitor}</span></div><div class="stat-value" data-count-to="${overallRate}" data-suffix="%">${overallRate}%</div><div class="stat-note">${totalRecords} total logs</div></div>
      <div class="stat-card"><div class="stat-head"><span class="stat-label">At-Risk Students</span><span class="stat-icon">${ICONS.reports}</span></div><div class="stat-value" style="color:var(--absent-text)" data-count-to="${flagged.length}">${flagged.length}</div><div class="stat-note">3+ absences</div></div>
    </div>

    ${renderDistributionCard(db.attendance, "Overall Attendance Distribution")}

    <div class="card">
      <div class="card-header"><h3>${role === "teacher" ? "At-Risk Students" : "Flagged Students"}</h3></div>
      <div class="table-wrap">
        <table class="responsive-table">
          <thead><tr><th>Student</th><th>Section</th><th>Absences</th><th>Rate</th><th>Severity</th></tr></thead>
          <tbody>
            ${flagged.length ? flagged.map(({ student, stats }) => `
              <tr>
                <td data-label="Student"><div class="student-cell"><span class="mini-avatar" style="background:${avatarColor(student.id)}">${getInitials(student.name)}</span><div><strong>${escapeHtml(student.name)}</strong><div class="stat-note">${escapeHtml(student.id)}</div></div></div></td>
                <td data-label="Section">${escapeHtml(student.yearSection)}</td>
                <td data-label="Absences"><strong style="color:var(--absent-text)">${stats.absent}</strong></td>
                <td data-label="Rate">${stats.rate}%</td>
                <td data-label="Severity"><span class="badge badge-flag">${stats.absent >= 4 ? "High Risk" : "Flagged"}</span></td>
              </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state">No flagged students.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>${role === "teacher" ? "My Classes Today" : "Class Directory"}</h3></div>
      <div class="card-body">
        <div class="class-grid">
          ${db.classes.map((c) => `
            <div class="class-card">
              <strong>${escapeHtml(c.code)} — ${escapeHtml(c.title)}</strong>
              <span class="stat-note">${escapeHtml(c.section)} &bull; ${escapeHtml(c.room || "Room TBA")}</span>
              <span class="stat-note">${escapeHtml(c.schedule)}</span>
              <span class="stat-note">Instructor: ${escapeHtml(c.teacherName)}</span>
            </div>`).join("")}
        </div>
      </div>
    </div>
  `;

  animateCounts();
  document.getElementById("hero-action-btn").addEventListener("click", () => navigateTo(role === "teacher" ? "record-attendance" : "reports"));
}

function renderRecordAttendance() {
  const defaultClass = db.classes[0]?.id || "";
  mainContent.innerHTML = `
    <div class="steps-bar">
      <span class="step-pill">1. Choose Class</span>
      <span class="step-pill">2. Choose Date</span>
      <span class="step-pill">3. Mark Students & Save</span>
    </div>
    <div class="card">
      <div class="card-header"><h3>Record Class Session</h3></div>
      <div class="card-body">
        <div class="toolbar">
          <div class="form-group"><label for="rec-class">Class / Subject</label><select id="rec-class">${db.classes.map((c) => `<option value="${c.id}">${escapeHtml(c.code)} — ${escapeHtml(c.title)} (${escapeHtml(c.section)})</option>`).join("")}</select></div>
          <div class="form-group"><label for="rec-date">Session Date</label><input type="date" id="rec-date" value="${todayISO()}" /></div>
        </div>
        <div id="rec-note" class="alert alert-info"></div>
        <div class="table-wrap">
          <table class="responsive-table">
            <thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody id="rec-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="sticky-action-bar">
      <div id="live-counters" style="font-size:13px; font-weight:600;"></div>
      <div style="display:flex; gap:8px;">
        <button type="button" id="mark-all-present-btn" class="btn btn-outline btn-sm">Mark All Present</button>
        <button type="button" id="save-attendance-btn" class="btn btn-primary btn-sm">Save Session</button>
      </div>
    </div>
  `;

  const classSelect = document.getElementById("rec-class");
  const dateInput = document.getElementById("rec-date");
  classSelect.value = defaultClass;
  let draftMap = {};

  function updateCounters() {
    const vals = Object.values(draftMap);
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    vals.forEach((v) => c[v.status]++);
    document.getElementById("live-counters").textContent = `${c.present} Present · ${c.absent} Absent · ${c.late} Late · ${c.excused} Excused`;
  }

  function loadSession() {
    const classId = classSelect.value;
    const date = dateInput.value;
    const cls = getClassById(classId);
    const enrolled = db.students.filter((s) => !cls || s.yearSection === cls.section);
    const existing = db.attendance.filter((r) => r.classId === classId && r.date === date);
    hasUnsavedAttendance = false;

    document.getElementById("rec-note").innerHTML = existing.length
      ? `<span><strong>Editing Saved Session:</strong> ${existing.length} entries loaded for ${escapeHtml(cls?.code || classId)} (${escapeHtml(date)}).</span>`
      : `<span><strong>New Session:</strong> ${enrolled.length} students in ${escapeHtml(cls?.section || "")}.</span>`;

    draftMap = {};
    enrolled.forEach((s) => {
      const found = existing.find((r) => r.studentId === s.id);
      draftMap[s.id] = { status: found ? found.status : "present", remarks: found ? found.remarks : "" };
    });

    const tbody = document.getElementById("rec-tbody");
    tbody.innerHTML = enrolled.map((s) => `
      <tr>
        <td data-label="Student"><div class="student-cell"><span class="mini-avatar" style="background:${avatarColor(s.id)}">${getInitials(s.name)}</span><div><strong>${escapeHtml(s.name)}</strong><div class="stat-note">${escapeHtml(s.id)}</div></div></div></td>
        <td data-label="Status"><div class="status-group">${["present", "absent", "late", "excused"].map((st) => `<button type="button" class="status-btn ${draftMap[s.id].status === st ? "active" : ""}" data-status="${st}" data-student="${s.id}">${st.charAt(0).toUpperCase() + st.slice(1)}</button>`).join("")}</div></td>
        <td data-label="Remarks"><input type="text" class="remark-input" data-student="${s.id}" value="${escapeHtml(draftMap[s.id].remarks)}" placeholder="Optional note..." /></td>
      </tr>`).join("");

    tbody.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-student");
        draftMap[sid].status = btn.getAttribute("data-status");
        hasUnsavedAttendance = true;
        btn.closest("tr").querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        updateCounters();
      });
    });
    tbody.querySelectorAll(".remark-input").forEach((inp) => {
      inp.addEventListener("input", () => {
        draftMap[inp.getAttribute("data-student")].remarks = inp.value;
        hasUnsavedAttendance = true;
      });
    });
    updateCounters();
  }

  document.getElementById("mark-all-present-btn").addEventListener("click", () => {
    Object.keys(draftMap).forEach((sid) => { draftMap[sid].status = "present"; });
    hasUnsavedAttendance = true;
    document.querySelectorAll("#rec-tbody tr").forEach((row) => {
      row.querySelectorAll(".status-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-status") === "present"));
    });
    updateCounters();
    showToast("All students marked Present.", "info");
  });

  document.getElementById("save-attendance-btn").addEventListener("click", async () => {
    const classId = classSelect.value;
    const date = dateInput.value;
    const entries = Object.entries(draftMap).map(([studentId, e]) => ({ studentId, status: e.status, remarks: e.remarks.trim() }));

    if (isOnlineAPI) {
      try {
        await apiRequest("save_attendance", "POST", { classId, date, recordedBy: currentUser.id, entries }, currentUser.role);
        await refreshFromBackend();
      } catch (err) {
        showToast(err.message, "error");
        return;
      }
    } else {
      db.attendance = db.attendance.filter((r) => !(r.classId === classId && r.date === date));
      entries.forEach((e) => db.attendance.push({ id: `a-${Date.now()}-${e.studentId}`, classId, studentId: e.studentId, date, status: e.status, remarks: e.remarks }));
      saveDB(db);
    }
    hasUnsavedAttendance = false;
    populateNotifications();
    showToast("Attendance session saved!");
    loadSession();
  });

  classSelect.addEventListener("change", loadSession);
  dateInput.addEventListener("change", loadSession);
  loadSession();
}

function renderMonitorAttendance() {
  mainContent.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Monitor Attendance</h3><button id="mon-csv-btn" class="btn btn-outline btn-sm">Export CSV</button></div>
      <div class="card-body">
        <div class="toolbar">
          <div class="form-group"><label for="mon-class">Class</label><select id="mon-class"><option value="">All Classes</option>${db.classes.map((c) => `<option value="${c.id}">${escapeHtml(c.code)}</option>`).join("")}</select></div>
          <div class="form-group"><label for="mon-search">Student Search</label><input type="text" id="mon-search" placeholder="Name or ID..." /></div>
          <div class="form-group"><label for="mon-status">Status</label><select id="mon-status"><option value="">All</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></div>
          <div class="form-group"><label for="mon-from">From</label><input type="date" id="mon-from" /></div>
          <div class="form-group"><label for="mon-to">To</label><input type="date" id="mon-to" /></div>
        </div>
        <div id="mon-chips" class="stat-note" style="margin-bottom:12px;"></div>
        <div class="table-wrap">
          <table class="responsive-table">
            <thead><tr><th>Date</th><th>Class</th><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody id="mon-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let currentFiltered = [];
  const renderRows = () => {
    const cId = document.getElementById("mon-class").value;
    const q = document.getElementById("mon-search").value.trim().toLowerCase();
    const st = document.getElementById("mon-status").value;
    const from = document.getElementById("mon-from").value;
    const to = document.getElementById("mon-to").value;

    currentFiltered = db.attendance.filter((r) => {
      const stu = getStudentById(r.studentId);
      const matchQ = !q || r.studentId.toLowerCase().includes(q) || (stu && stu.name.toLowerCase().includes(q));
      return (!cId || r.classId === cId) && (!st || r.status === st) && (!from || r.date >= from) && (!to || r.date <= to) && matchQ;
    }).sort((a, b) => b.date.localeCompare(a.date));

    document.getElementById("mon-chips").textContent = `Showing ${currentFiltered.length} records`;
    document.getElementById("mon-tbody").innerHTML = currentFiltered.length
      ? currentFiltered.map((r) => {
          const cls = getClassById(r.classId);
          const stu = getStudentById(r.studentId);
          return `<tr>
            <td data-label="Date">${escapeHtml(r.date)}</td>
            <td data-label="Class">${escapeHtml(cls ? cls.code : r.classId)}</td>
            <td data-label="Student">${escapeHtml(stu ? stu.name : r.studentId)}</td>
            <td data-label="Status">${statusBadge(r.status)}</td>
            <td data-label="Remarks">${escapeHtml(r.remarks || "—")}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="5"><div class="empty-state">No records match your filters.</div></td></tr>`;
  };

  document.getElementById("mon-csv-btn").addEventListener("click", () => {
    const csv = ["Date,Class,Student ID,Student Name,Status,Remarks", ...currentFiltered.map((r) => {
      const s = getStudentById(r.studentId);
      return `${r.date},${r.classId},${r.studentId},"${(s?.name || "").replace(/"/g, '""')}",${r.status},"${(r.remarks || "").replace(/"/g, '""')}"`;
    })].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `attendance-logs-${todayISO()}.csv`;
    a.click();
    showToast("CSV exported.");
  });

  ["mon-class", "mon-status", "mon-from", "mon-to"].forEach((id) => document.getElementById(id).addEventListener("change", renderRows));
  document.getElementById("mon-search").addEventListener("input", renderRows);
  renderRows();
}

// =========================================================
// MODULE 6: ADMIN PORTAL (STUDENTS, CLASSES, REPORTS)
// =========================================================
function renderManageStudents() {
  let sortKey = "id";
  let sortAsc = true;
  const sections = [...new Set(db.students.map((s) => s.yearSection))];

  mainContent.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Student Management</h3><button id="add-student-btn" class="btn btn-primary btn-sm">+ Add Student</button></div>
      <div class="card-body">
        <div class="toolbar">
          <div class="form-group"><label for="stu-search">Search</label><input type="text" id="stu-search" placeholder="Name or ID..." /></div>
          <div class="form-group"><label for="stu-sec">Course / Section</label><select id="stu-sec"><option value="">All Sections</option>${sections.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}</select></div>
        </div>
        <div class="table-wrap">
          <table class="responsive-table">
            <thead><tr>
              <th class="sortable" data-sort="id">ID</th>
              <th class="sortable" data-sort="name">Student</th>
              <th class="sortable" data-sort="yearSection">Section</th>
              <th>Email</th>
              <th>Absences</th>
              <th>Actions</th>
            </tr></thead>
            <tbody id="stu-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const renderTable = () => {
    const q = document.getElementById("stu-search").value.trim().toLowerCase();
    const sec = document.getElementById("stu-sec").value;
    const list = db.students
      .filter((s) => (!sec || s.yearSection === sec) && (s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)))
      .sort((a, b) => (sortAsc ? a[sortKey].localeCompare(b[sortKey]) : b[sortKey].localeCompare(a[sortKey])));

    document.getElementById("stu-tbody").innerHTML = list.map((s) => {
      const st = getStudentStats(s.id);
      return `<tr>
        <td data-label="ID">${escapeHtml(s.id)}</td>
        <td data-label="Student"><div class="student-cell"><span class="mini-avatar" style="background:${avatarColor(s.id)}">${getInitials(s.name)}</span><strong>${escapeHtml(s.name)}</strong></div></td>
        <td data-label="Section">${escapeHtml(s.yearSection)}</td>
        <td data-label="Email">${escapeHtml(s.email)}</td>
        <td data-label="Absences">${st.absent} ${st.flagged ? `<span class="badge badge-flag">Flagged</span>` : ""}</td>
        <td data-label="Actions">
          <button class="btn btn-outline btn-sm edit-stu-btn" data-id="${escapeHtml(s.id)}">Edit</button>
          <button class="btn btn-danger btn-sm del-stu-btn" data-id="${escapeHtml(s.id)}">Delete</button>
        </td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".edit-stu-btn").forEach((b) => b.addEventListener("click", () => openStudentModal(b.getAttribute("data-id"))));
    document.querySelectorAll(".del-stu-btn").forEach((b) => b.addEventListener("click", () => {
      const id = b.getAttribute("data-id");
      openModal("Confirm Delete", `<p>Delete student <strong>${escapeHtml(id)}</strong> and all their attendance records?</p>
        <div class="modal-actions"><button class="btn btn-outline" id="del-cancel">Cancel</button><button class="btn btn-danger" id="del-confirm">Delete</button></div>`);
      document.getElementById("del-cancel").addEventListener("click", closeModal);
      document.getElementById("del-confirm").addEventListener("click", async () => {
        if (isOnlineAPI) {
          await apiRequest("delete_student", "POST", { id }, currentUser.role);
          await refreshFromBackend();
        } else {
          db.students = db.students.filter((s) => s.id !== id);
          db.attendance = db.attendance.filter((a) => a.studentId !== id);
          saveDB(db);
        }
        closeModal();
        showToast("Student deleted.", "warning");
        renderTable();
      });
    }));
  };

  function openStudentModal(existingId = null) {
    const existing = existingId ? getStudentById(existingId) : null;
    openModal(existing ? "Edit Student" : "Add Student", `
      <form id="student-form">
        <div class="form-group"><label for="sf-id">Student ID</label><input type="text" id="sf-id" value="${escapeHtml(existing?.id || "")}" ${existing ? "readonly" : ""} placeholder="e.g. 2026-0016" required /></div>
        <div class="form-group"><label for="sf-name">Full Name</label><input type="text" id="sf-name" value="${escapeHtml(existing?.name || "")}" required /></div>
        <div class="form-group"><label for="sf-sec">Course & Year Section</label><input type="text" id="sf-sec" value="${escapeHtml(existing?.yearSection || "BSOA 3A")}" required /></div>
        <div class="form-group"><label for="sf-email">Email</label><input type="email" id="sf-email" value="${escapeHtml(existing?.email || "")}" required /></div>
        <div id="sf-err" class="form-error hidden"></div>
        <div class="modal-actions"><button type="button" class="btn btn-outline" id="sf-cancel">Cancel</button><button type="submit" class="btn btn-primary">${existing ? "Save Changes" : "Create Student"}</button></div>
      </form>
    `);
    document.getElementById("sf-cancel").addEventListener("click", closeModal);
    document.getElementById("student-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("sf-id").value.trim();
      const name = document.getElementById("sf-name").value.trim();
      const yearSection = document.getElementById("sf-sec").value.trim();
      const email = document.getElementById("sf-email").value.trim();

      try {
        if (isOnlineAPI) {
          await apiRequest("save_student", "POST", { id, name, yearSection, email, isEdit: Boolean(existing) }, currentUser.role);
          await refreshFromBackend();
        } else if (existing) {
          existing.name = name; existing.yearSection = yearSection; existing.email = email;
          saveDB(db);
        } else {
          if (getStudentById(id)) throw new Error("Student ID already exists.");
          db.students.push({ id, name, program: yearSection.split(" ")[0] || "BSOA", yearSection, email });
          db.users.push({ id: Date.now(), username: id, password: "stud123", name, role: "student", studentId: id });
          saveDB(db);
        }
        closeModal();
        if (!existing) {
          openModal("Student Account Created", `<p>Student <strong>${escapeHtml(name)}</strong> has been added.</p><p><strong>Username:</strong> ${escapeHtml(id)}<br/><strong>Default Password:</strong> <code>stud123</code></p><div class="modal-actions"><button class="btn btn-primary" id="cred-ok">Done</button></div>`);
          document.getElementById("cred-ok").addEventListener("click", closeModal);
        } else {
          showToast("Student updated.");
        }
        renderTable();
      } catch (err) {
        const errEl = document.getElementById("sf-err");
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
  }

  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.getAttribute("data-sort");
      sortAsc = sortKey === k ? !sortAsc : true;
      sortKey = k;
      renderTable();
    });
  });
  document.getElementById("stu-search").addEventListener("input", renderTable);
  document.getElementById("stu-sec").addEventListener("change", renderTable);
  document.getElementById("add-student-btn").addEventListener("click", () => openStudentModal());
  renderTable();
}

function renderManageClasses() {
  mainContent.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Classes & Subjects</h3><button id="add-class-btn" class="btn btn-primary btn-sm">+ Add Class</button></div>
      <div class="card-body">
        <div class="class-grid" id="cls-grid"></div>
      </div>
    </div>
  `;

  const renderCards = () => {
    document.getElementById("cls-grid").innerHTML = db.classes.map((c) => {
      const enrolled = db.students.filter((s) => s.yearSection === c.section).length;
      return `<div class="class-card">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <strong>${escapeHtml(c.code)} — ${escapeHtml(c.title)}</strong>
          <button class="btn btn-danger btn-sm del-cls-btn" data-id="${escapeHtml(c.id)}">Remove</button>
        </div>
        <span class="stat-note">Section: ${escapeHtml(c.section)} (${enrolled} students)</span>
        <span class="stat-note">Room: ${escapeHtml(c.room || "TBA")} &bull; ${escapeHtml(c.schedule)}</span>
        <span class="stat-note">Instructor: ${escapeHtml(c.teacherName)}</span>
      </div>`;
    }).join("");

    document.querySelectorAll(".del-cls-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("Remove this class and its attendance records?")) return;
        if (isOnlineAPI) {
          await apiRequest("delete_class", "POST", { id }, currentUser.role);
          await refreshFromBackend();
        } else {
          db.classes = db.classes.filter((c) => c.id !== id);
          db.attendance = db.attendance.filter((a) => a.classId !== id);
          saveDB(db);
        }
        showToast("Class removed.", "warning");
        renderCards();
      });
    });
  };

  document.getElementById("add-class-btn").addEventListener("click", () => {
    const teachers = db.users.filter((u) => u.role === "teacher");
    openModal("Add New Class", `
      <form id="class-form">
        <div class="form-group"><label for="cf-code">Code</label><input type="text" id="cf-code" placeholder="e.g. IT 306" required /></div>
        <div class="form-group"><label for="cf-title">Title</label><input type="text" id="cf-title" required /></div>
        <div class="form-group"><label for="cf-sec">Section</label><input type="text" id="cf-sec" value="BSOA 3A" required /></div>
        <div class="form-group"><label for="cf-room">Room</label><input type="text" id="cf-room" value="ComLab 1" required /></div>
        <div class="form-group"><label for="cf-sched">Schedule</label><input type="text" id="cf-sched" placeholder="e.g. Fri 1:00–4:00 PM" required /></div>
        <div class="form-group"><label for="cf-teacher">Instructor</label><select id="cf-teacher">${teachers.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}</select></div>
        <div class="modal-actions"><button type="button" class="btn btn-outline" id="cf-cancel">Cancel</button><button type="submit" class="btn btn-primary">Create Class</button></div>
      </form>
    `);
    document.getElementById("cf-cancel").addEventListener("click", closeModal);
    document.getElementById("class-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("cf-code").value.trim();
      const title = document.getElementById("cf-title").value.trim();
      const section = document.getElementById("cf-sec").value.trim();
      const room = document.getElementById("cf-room").value.trim();
      const schedule = document.getElementById("cf-sched").value.trim();
      const teacherId = document.getElementById("cf-teacher").value;
      const teacher = teachers.find((t) => String(t.id) === String(teacherId));

      if (isOnlineAPI) {
        await apiRequest("save_class", "POST", { code, title, section, room, schedule, teacherId }, currentUser.role);
        await refreshFromBackend();
      } else {
        db.classes.push({ id: `${code.replace(/\s+/g, "")}-${Date.now().toString().slice(-3)}`, code, title, section, room, schedule, teacherId, teacherName: teacher?.name || "Faculty" });
        saveDB(db);
      }
      closeModal();
      showToast("Class added.");
      renderCards();
    });
  });
  renderCards();
}

function renderReports() {
  mainContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Attendance Summary Report</h3>
        <div class="no-print" style="display:flex; gap:8px;">
          <button id="export-csv-btn" class="btn btn-outline btn-sm">Export CSV</button>
          <button id="print-report-btn" class="btn btn-primary btn-sm">Print summary</button>
        </div>
      </div>
      <div class="card-body">
        <div class="toolbar no-print">
          <div class="form-group"><label for="rep-class">Class</label><select id="rep-class"><option value="">All Classes</option>${db.classes.map((c) => `<option value="${c.id}">${escapeHtml(c.code)} — ${escapeHtml(c.title)}</option>`).join("")}</select></div>
          <div class="form-group"><label for="rep-from">From</label><input type="date" id="rep-from" /></div>
          <div class="form-group"><label for="rep-to">To</label><input type="date" id="rep-to" /></div>
        </div>
        <div class="table-wrap">
          <table class="responsive-table">
            <thead><tr><th>Student ID</th><th>Name</th><th>Section</th><th>Sessions</th><th>Present</th><th>Late</th><th>Excused</th><th>Absent</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody id="rep-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let rowsData = [];
  const build = () => {
    const classId = document.getElementById("rep-class").value;
    const from = document.getElementById("rep-from").value;
    const to = document.getElementById("rep-to").value;
    const scoped = db.attendance.filter((r) => (!classId || r.classId === classId) && (!from || r.date >= from) && (!to || r.date <= to));
    const cls = classId ? getClassById(classId) : null;
    const targetStudents = cls ? db.students.filter((s) => s.yearSection === cls.section) : db.students;
    rowsData = targetStudents.map((s) => ({ student: s, stats: getStudentStats(s.id, scoped) }));

    document.getElementById("rep-tbody").innerHTML = rowsData.map(({ student, stats }) => `
      <tr>
        <td data-label="ID">${escapeHtml(student.id)}</td>
        <td data-label="Name"><strong>${escapeHtml(student.name)}</strong></td>
        <td data-label="Section">${escapeHtml(student.yearSection)}</td>
        <td data-label="Sessions">${stats.total}</td>
        <td data-label="Present">${stats.present}</td>
        <td data-label="Late">${stats.late}</td>
        <td data-label="Excused">${stats.excused}</td>
        <td data-label="Absent">${stats.absent}</td>
        <td data-label="Rate"><strong>${stats.rate}%</strong></td>
        <td data-label="Status">${stats.flagged ? `<span class="badge badge-flag">Flagged</span>` : `<span class="badge badge-ok">Good</span>`}</td>
      </tr>`).join("");
  };

  document.getElementById("export-csv-btn").addEventListener("click", () => {
    const csv = ["Student ID,Name,Section,Sessions,Present,Late,Excused,Absent,Rate (%),Flagged",
      ...rowsData.map(({ student, stats }) => `${student.id},"${student.name.replace(/"/g, '""')}","${student.yearSection}",${stats.total},${stats.present},${stats.late},${stats.excused},${stats.absent},${stats.rate},${stats.flagged ? "Yes" : "No"}`)
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ptc-attendance-summary-${todayISO()}.csv`;
    a.click();
    showToast("CSV summary downloaded.");
  });
  document.getElementById("print-report-btn").addEventListener("click", () => window.print());
  ["rep-class", "rep-from", "rep-to"].forEach((id) => document.getElementById(id).addEventListener("change", build));
  build();
}

// ---------- Boot ----------
(async () => {
  await refreshFromBackend();
  if (currentUser) enterApp();
})();
