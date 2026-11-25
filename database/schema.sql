-- Pateros Technological College — Student Attendance Monitoring System
-- MySQL Database Schema + Pre-Seeded Sample Data (UTF-8mb4)

DROP DATABASE IF EXISTS ptc_attendance_db;
CREATE DATABASE ptc_attendance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ptc_attendance_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin', 'teacher', 'student') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  student_id VARCHAR(20) PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(120) NOT NULL,
  program VARCHAR(40) NOT NULL,
  year_section VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  INDEX idx_students_section (year_section),
  CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classes (
  id VARCHAR(20) PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  section VARCHAR(40) NOT NULL,
  schedule VARCHAR(80) NOT NULL,
  room VARCHAR(40) NOT NULL DEFAULT 'Room 301',
  teacher_id INT NOT NULL,
  INDEX idx_classes_section (section),
  CONSTRAINT fk_class_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  class_id VARCHAR(20) NOT NULL,
  student_id VARCHAR(20) NOT NULL,
  session_date DATE NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
  remarks VARCHAR(255) DEFAULT '',
  recorded_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_student (student_id, class_id, session_date),
  INDEX idx_att_student (student_id),
  INDEX idx_att_class (class_id),
  INDEX idx_att_date (session_date),
  CONSTRAINT fk_att_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_att_recorder FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Users (admin and teachers only — no pre-loaded students)
INSERT INTO users (id, username, password_hash, full_name, role) VALUES
  (1, 'admin',          'admin123', 'Admin', 'admin'),
  (2, 'teacher.santos', 'teach123', 'Prof. Marco Santos',  'teacher'),
  (3, 'teacher.reyes',  'teach123', 'Prof. Elena Reyes',   'teacher');

-- No pre-seeded students — register accounts via the app to test

-- Seed 6 Classes (BSOA subjects)
INSERT INTO classes (id, code, title, section, schedule, room, teacher_id) VALUES
  ('OA301', 'OA 301', 'Database Management System', 'BSOA 3A', 'Mon/Wed 8:00–9:30 AM', 'ComLab 1', 2),
  ('OA302', 'OA 302', 'Rizal Life, Works and Writing', 'BSOA 3A', 'Tue/Thu 10:00–11:30 AM', 'Room 304', 2),
  ('OA303', 'OA 303', 'Ethics', 'BSOA 3A', 'Mon/Wed 1:00–2:30 PM', 'Room 205', 3),
  ('OA304', 'OA 304', 'Philippine Popular Culture', 'BSOA 3A', 'Fri 8:00–11:00 AM', 'Room 301', 2),
  ('OA305', 'OA 305', 'Applied Statistics', 'BSOA 3A', 'Tue/Thu 1:00–2:30 PM', 'Room 302', 3),
  ('OA306', 'OA 306', 'Research 1', 'BSOA 3A', 'Wed/Fri 1:00–2:30 PM', 'Room 303', 3);

-- No pre-seeded attendance records — will be populated as students register and teachers record sessions
