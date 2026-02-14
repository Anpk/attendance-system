-- 테스트 편의용 EMPLOYEES 시드 (dev 전용)
-- H2: INSERT ... KEY 문법이 아니라 MERGE INTO ... KEY 사용

MERGE INTO employees (user_id, username, password, active, role, site_id) KEY(user_id) VALUES (1, 'user-1', 'pw1', TRUE, 'EMPLOYEE', 1);
MERGE INTO employees (user_id, username, password, active, role, site_id) KEY(user_id) VALUES (2, 'user-2', 'pw2', TRUE, 'EMPLOYEE', 1);
MERGE INTO employees (user_id, username, password, active, role, site_id) KEY(user_id) VALUES (3, 'user-3', 'pw3', TRUE, 'EMPLOYEE', 1);

MERGE INTO employees (user_id, username, password, active, role, site_id) KEY(user_id) VALUES (101, 'manager-101', 'pw101', TRUE, 'MANAGER', 1);
MERGE INTO employees (user_id, username, password, active, role, site_id) KEY(user_id) VALUES (999, 'admin-999', 'pw999', TRUE, 'ADMIN', 1);