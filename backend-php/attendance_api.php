<?php
/**
 * Starter Attendance API endpoint (PHP + MySQL)
 * Supports GET (fetch attendance by class/date/student) and POST (save/update session).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $classId = $_GET['class_id'] ?? null;
    $date    = $_GET['date'] ?? null;

    $sql = "SELECT a.id, a.class_id, a.student_id, s.full_name, a.session_date, a.status, a.remarks
            FROM attendance_records a
            JOIN students s ON s.student_id = a.student_id
            WHERE 1=1";
    $params = [];

    if ($classId) {
        $sql .= " AND a.class_id = :class_id";
        $params[':class_id'] = $classId;
    }
    if ($date) {
        $sql .= " AND a.session_date = :session_date";
        $params[':session_date'] = $date;
    }

    $sql .= " ORDER BY a.session_date DESC, s.full_name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['records' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload) || empty($payload['class_id']) || empty($payload['session_date']) || empty($payload['entries'])) {
        http_response_code(400);
        echo json_encode(['error' => 'class_id, session_date, and entries are required']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO attendance_records (class_id, student_id, session_date, status, remarks, recorded_by)
         VALUES (:class_id, :student_id, :session_date, :status, :remarks, :recorded_by)
         ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), recorded_by = VALUES(recorded_by)"
    );

    $pdo->beginTransaction();
    try {
        foreach ($payload['entries'] as $entry) {
            $stmt->execute([
                ':class_id'     => $payload['class_id'],
                ':student_id'   => $entry['student_id'],
                ':session_date' => $payload['session_date'],
                ':status'       => $entry['status'] ?? 'present',
                ':remarks'      => $entry['remarks'] ?? '',
                ':recorded_by'  => (int)($payload['recorded_by'] ?? 1),
            ]);
        }
        $pdo->commit();
        echo json_encode(['ok' => true, 'saved' => count($payload['entries'])]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save attendance session']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
