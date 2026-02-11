-- 테스트 편의용 EMPLOYEES 시드 (dev 전용)
-- H2: INSERT ... KEY 문법이 아니라 MERGE INTO ... KEY 사용

MERGE INTO employees (user_id, active, role, site_id, password) KEY(user_id) VALUES (1, TRUE, 'EMPLOYEE', 1, 'pw1');
MERGE INTO employees (user_id, active, role, site_id, password) KEY(user_id) VALUES (2, TRUE, 'EMPLOYEE', 1, 'pw2');
MERGE INTO employees (user_id, active, role, site_id, password) KEY(user_id) VALUES (3, TRUE, 'EMPLOYEE', 1, 'pw3');

MERGE INTO employees (user_id, active, role, site_id, password) KEY(user_id) VALUES (101, TRUE, 'MANAGER', 1, 'pw101');
MERGE INTO employees (user_id, active, role, site_id, password) KEY(user_id) VALUES (999, TRUE, 'ADMIN', 1, 'pw999');