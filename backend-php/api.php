<?php
/**
 * PTC Student Attendance Monitoring System — Unified PHP + MySQL API
 * Supports role checks, password_hash / password_verify, and prepared statements.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireRole(array $allowedRoles): string {
    $role = strtolower(trim((string)($_SERVER['HTTP_X_USER_ROLE'] ?? '')));
    if (!in_array($role, $allowedRoles, true)) {
        jsonResponse(['error' => 'Unauthorized: insufficient role permissions.'], 403);
    }
    return $role;
}

try {
    $pdo = getPDO();
} catch (Throwable $e) {
    jsonResponse(['error' => 'Database connection failed: ' . $e->getMessage()], 500);
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body   = json_decode(file_get_contents('php://input') ?: '[]', true);
if (!is_array($body)) {
    $body = [];
}

if ($method === 'GET' && $action === 'bootstrap') {
    $users = $pdo->query(
        "SELECT u.id, u.username, u.full_name AS name, u.role, s.student_id AS studentId
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         ORDER BY u.id ASC"
    )->fetchAll();

    $students = $pdo->query(
        "SELECT student_id AS id, full_name AS name, program, year_section AS yearSection, email
         FROM students
         ORDER BY student_id ASC"
    )->fetchAll();

    $classes = $pdo->query(
        "SELECT c.id, c.code, c.title, c.section, c.schedule, c.room, c.teacher_id AS teacherId, u.full_name AS teacherName
         FROM classes c
         JOIN users u ON u.id = c.teacher_id
         ORDER BY c.code ASC"
    )->fetchAll();

    $attendance = $pdo->query(
        "SELECT id, class_id AS classId, student_id AS studentId, session_date AS date, status, remarks
         FROM attendance_records
         ORDER BY session_date DESC, student_id ASC"
    )->fetchAll();

    jsonResponse([
        'users'      => $users,
        'students'   => $students,
        'classes'    => $classes,
        'attendance' => $attendance,
    ]);
}

if ($method === 'POST' && $action === 'login') {
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    $stmt = $pdo->prepare(
        "SELECT u.id, u.username, u.password_hash, u.full_name AS name, u.role, s.student_id AS studentId
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         WHERE LOWER(u.username) = LOWER(:username)
         LIMIT 1"
    );
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch();

    $valid = $user && ($password === $user['password_hash'] || password_verify($password, $user['password_hash']));
    if (!$valid) {
        jsonResponse(['error' => 'Invalid username or password.'], 401);
    }

    unset($user['password_hash']);
    jsonResponse(['user' => $user]);
}

if ($method === 'POST' && $action === 'register') {
    $role        = strtolower(trim((string)($body['role'] ?? 'student')));
    $username    = trim((string)($body['username'] ?? ''));
    $studentId   = trim((string)($body['studentId'] ?? $username)); // separate student ID, falls back to username
    $fullName    = trim((string)($body['fullName'] ?? ''));
    $password    = (string)($body['password'] ?? '');
    $yearSection = trim((string)($body['yearSection'] ?? 'BSOA 3A'));
    $email       = trim((string)($body['email'] ?? ''));

    if (!in_array($role, ['student', 'teacher'], true)) {
        jsonResponse(['error' => 'Only student or teacher accounts can be self-registered.'], 400);
    }
    if ($username === '' || $fullName === '' || strlen($password) < 4) {
        jsonResponse(['error' => 'Username, full name, and a password (4+ chars) are required.'], 400);
    }
    if ($role === 'student' && $email === '') {
        jsonResponse(['error' => 'Email is required for student accounts.'], 400);
    }
    if ($role === 'student' && $studentId === '') {
        jsonResponse(['error' => 'Student ID is required for student accounts.'], 400);
    }

    // Check username uniqueness
    $check = $pdo->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(:u) LIMIT 1");
    $check->execute([':u' => $username]);
    if ($check->fetch()) {
        jsonResponse(['error' => 'That username is already taken.'], 409);
    }

    // Check student ID uniqueness (student only)
    if ($role === 'student') {
        $checkId = $pdo->prepare("SELECT student_id FROM students WHERE student_id = :id LIMIT 1");
        $checkId->execute([':id' => $studentId]);
        if ($checkId->fetch()) {
            jsonResponse(['error' => 'That Student ID is already in use.'], 409);
        }
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $pdo->beginTransaction();
    try {
        $uStmt = $pdo->prepare(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (:u, :p, :n, :r)"
        );
        $uStmt->execute([':u' => $username, ':p' => $hashed, ':n' => $fullName, ':r' => $role]);
        $userId = (int)$pdo->lastInsertId();

        $finalStudentId = null;
        if ($role === 'student') {
            $program = explode(' ', $yearSection)[0] ?: 'BSOA';
            $sStmt = $pdo->prepare(
                "INSERT INTO students (student_id, user_id, full_name, program, year_section, email)
                 VALUES (:id, :uid, :name, :program, :ys, :email)"
            );
            $sStmt->execute([
                ':id' => $studentId, ':uid' => $userId, ':name' => $fullName,
                ':program' => $program, ':ys' => $yearSection, ':email' => $email
            ]);
            $finalStudentId = $studentId;
        }

        $pdo->commit();
        jsonResponse([
            'user' => [
                'id'        => $userId,
                'username'  => $username,
                'name'      => $fullName,
                'role'      => $role,
                'studentId' => $finalStudentId,
            ]
        ], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Registration failed: ' . $e->getMessage()], 409);
    }
}

if ($method === 'POST' && $action === 'save_attendance') {
    requireRole(['teacher', 'admin']);
    $classId    = (string)($body['classId'] ?? '');
    $date       = (string)($body['date'] ?? '');
    $recordedBy = (int)($body['recordedBy'] ?? 2);
    $entries    = $body['entries'] ?? [];

    if ($classId === '' || $date === '' || !is_array($entries)) {
        jsonResponse(['error' => 'classId, date, and entries are required.'], 400);
    }

    $stmt = $pdo->prepare(
        "INSERT INTO attendance_records (class_id, student_id, session_date, status, remarks, recorded_by)
         VALUES (:class_id, :student_id, :session_date, :status, :remarks, :recorded_by)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           remarks = VALUES(remarks),
           recorded_by = VALUES(recorded_by)"
    );

    $pdo->beginTransaction();
    try {
        foreach ($entries as $entry) {
            $stmt->execute([
                ':class_id'     => $classId,
                ':student_id'   => (string)$entry['studentId'],
                ':session_date' => $date,
                ':status'       => (string)($entry['status'] ?? 'present'),
                ':remarks'      => trim((string)($entry['remarks'] ?? '')),
                ':recorded_by'  => $recordedBy,
            ]);
        }
        $pdo->commit();
        jsonResponse(['ok' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to save attendance: ' . $e->getMessage()], 500);
    }
}

if ($method === 'POST' && $action === 'save_student') {
    requireRole(['admin']);
    $id          = trim((string)($body['id'] ?? ''));
    $name        = trim((string)($body['name'] ?? ''));
    $yearSection = trim((string)($body['yearSection'] ?? ''));
    $email       = trim((string)($body['email'] ?? ''));
    $isEdit      = (bool)($body['isEdit'] ?? false);

    if ($id === '' || $name === '' || $yearSection === '' || $email === '') {
        jsonResponse(['error' => 'All student fields are required.'], 400);
    }

    $program = explode(' ', $yearSection)[0] ?: 'BSOA';

    if ($isEdit) {
        $stmt = $pdo->prepare(
            "UPDATE students SET full_name = :name, program = :program, year_section = :ys, email = :email WHERE student_id = :id"
        );
        $stmt->execute([':name' => $name, ':program' => $program, ':ys' => $yearSection, ':email' => $email, ':id' => $id]);
        jsonResponse(['ok' => true]);
    }

    $generatedPassword = 'stud123';
    $hashedPassword = password_hash($generatedPassword, PASSWORD_DEFAULT);

    $pdo->beginTransaction();
    try {
        $uStmt = $pdo->prepare(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (:u, :p, :n, 'student')"
        );
        $uStmt->execute([':u' => $id, ':p' => $hashedPassword, ':n' => $name]);
        $userId = (int)$pdo->lastInsertId();

        $sStmt = $pdo->prepare(
            "INSERT INTO students (student_id, user_id, full_name, program, year_section, email)
             VALUES (:id, :uid, :name, :program, :ys, :email)"
        );
        $sStmt->execute([
            ':id' => $id, ':uid' => $userId, ':name' => $name,
            ':program' => $program, ':ys' => $yearSection, ':email' => $email
        ]);
        $pdo->commit();
        jsonResponse(['ok' => true, 'credentials' => ['username' => $id, 'password' => $generatedPassword]]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to add student: ' . $e->getMessage()], 409);
    }
}

if ($method === 'POST' && $action === 'delete_student') {
    requireRole(['admin']);
    $id = trim((string)($body['id'] ?? ''));
    $stmt = $pdo->prepare("DELETE FROM students WHERE student_id = :id");
    $stmt->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $action === 'save_class') {
    requireRole(['admin']);
    $code      = trim((string)($body['code'] ?? ''));
    $title     = trim((string)($body['title'] ?? ''));
    $section   = trim((string)($body['section'] ?? ''));
    $schedule  = trim((string)($body['schedule'] ?? ''));
    $room      = trim((string)($body['room'] ?? 'Room 301'));
    $teacherId = (int)($body['teacherId'] ?? 2);
    $id        = strtoupper(preg_replace('/\s+/', '', $code)) . '-' . substr((string)time(), -3);

    $stmt = $pdo->prepare(
        "INSERT INTO classes (id, code, title, section, schedule, room, teacher_id)
         VALUES (:id, :code, :title, :section, :schedule, :room, :tid)"
    );
    $stmt->execute([
        ':id' => $id, ':code' => $code, ':title' => $title,
        ':section' => $section, ':schedule' => $schedule, ':room' => $room, ':tid' => $teacherId
    ]);
    jsonResponse(['ok' => true, 'id' => $id]);
}

if ($method === 'POST' && $action === 'delete_class') {
    requireRole(['admin']);
    $id = trim((string)($body['id'] ?? ''));
    $stmt = $pdo->prepare("DELETE FROM classes WHERE id = :id");
    $stmt->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unknown endpoint'], 404);
